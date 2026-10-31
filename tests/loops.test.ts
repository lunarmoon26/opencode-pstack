import { test, expect } from "bun:test"
import { createLoops, duration, type Clock } from "../plugin/loops.ts"
import { harness } from "./harness.ts"

function clock() {
  let now = 1000
  const pending = new Map<object, () => void>()
  const value: Clock = {
    now: () => now,
    set: (fn) => { const id = {}; pending.set(id, fn); return id },
    clear: (id) => { pending.delete(id as object) },
  }
  return {
    value, pending,
    async tick(ms = 30_000) {
      now += ms
      const [id, fn] = pending.entries().next().value ?? []
      if (id) pending.delete(id)
      fn?.()
      for (let i = 0; i < 12; i++) await Promise.resolve()
    },
  }
}

test("duration rejects unbounded, zero, malformed and subminimum waits", () => {
  for (const input of ["0s", "1s", "-1h", "1e9s", "99d", "NaNh", "Infinityh", "1hour"]) expect(() => duration(input)).toThrow()
  expect(duration("30s")).toBe(30_000)
  expect(duration("23h")).toBe(82_800_000)
  expect(() => duration("1d")).toThrow("less than 24 hours")
})

test("schedules are bounded, queued, reauthorized, and stop at their run limit", async () => {
  const h = harness()
  const c = clock()
  const loops = createLoops(h.context, c.value)
  let checks = 0
  loops.schedule("ses_test", "check until green", 30_000, 30_000, 2, async () => { checks++ })
  await c.tick()
  expect(h.prompts).toHaveLength(1)
  expect(h.prompts[0].delivery).toBe("queue")
  await c.tick()
  expect(h.prompts).toHaveLength(2)
  expect(checks).toBe(2)
  expect(loops.list("ses_test")[0]?.state).toBe("completed")
  expect(c.pending.size).toBe(0)
  loops.dispose()
})

test("separate instances never share timers; stop and cleanup prevent dispatch", async () => {
  const a = harness(), b = harness(), c = clock()
  const first = createLoops(a.context, c.value), second = createLoops(b.context, c.value)
  first.schedule("ses_test", "one", 30_000, undefined, 1, async () => {})
  second.schedule("ses_test", "two", 30_000, undefined, 1, async () => {})
  first.stop("ses_test")
  first.dispose()
  await c.tick()
  expect(a.prompts).toHaveLength(0)
  expect(b.prompts).toHaveLength(1)
  second.dispose()
  expect(c.pending.size).toBe(0)
})

test("a policy rejection at fire time stops without retry or model work", async () => {
  const h = harness(), c = clock(), loops = createLoops(h.context, c.value)
  loops.schedule("ses_test", "check", 30_000, 30_000, 3, async () => { throw new Error("Policy changed") })
  await c.tick()
  expect(h.prompts).toHaveLength(0)
  expect(loops.list("ses_test")[0]).toMatchObject({ state: "failed", error: "Policy changed" })
  expect(c.pending.size).toBe(0)
})

test("stopping during authorization cannot queue a stale wake-up", async () => {
  const h = harness(), c = clock(), loops = createLoops(h.context, c.value)
  let release!: () => void
  loops.schedule("ses_test", "check", 30_000, 30_000, 3, () => new Promise<void>((resolve) => { release = resolve }))
  await c.tick()
  loops.stop("ses_test")
  release()
  for (let i = 0; i < 10; i++) await Promise.resolve()
  expect(h.prompts).toHaveLength(0)
  expect(loops.list("ses_test")[0]?.state).toBe("stopped")
})

test("moved sessions and expired schedules never dispatch", async () => {
  const h = harness(), c = clock(), loops = createLoops(h.context, c.value)
  loops.schedule("ses_test", "check", 30_000, undefined, 1, async () => {})
  h.self.location.directory = "/different/project"
  await c.tick()
  expect(h.prompts).toHaveLength(0)
  expect(loops.list("ses_test")[0]?.state).toBe("failed")
  loops.schedule("ses_test", "check", 30_000, undefined, 1, async () => {})
  await c.tick(86_400_000)
  expect(h.prompts).toHaveLength(0)
  expect(loops.list("ses_test")[0]?.state).toBe("expired")
})
