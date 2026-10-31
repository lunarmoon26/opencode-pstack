import type { Plugin } from "@opencode/plugin"

const day = 86_400_000
export function duration(text: string) {
  const match = /^(\d+(?:\.\d+)?)(s|m|h|d)$/.exec(text.trim())
  if (!match) throw new Error("Use a duration such as 30s, 5m, or 1h")
  const ms = Number(match[1]) * ({ s: 1000, m: 60_000, h: 3_600_000, d: day }[match[2]!]!)
  if (!Number.isFinite(ms) || ms < 30_000 || ms >= day) throw new Error("Delay must be at least 30 seconds and less than 24 hours")
  return ms
}

export type Schedule = {
  sessionID: string; prompt: string; every?: number; nextAt: number;
  expiresAt: number; maxRuns: number; runs: number;
  state: "scheduled" | "dispatching" | "completed" | "stopped" | "failed" | "expired";
  error?: string;
}
export type Clock = {
  now(): number
  set(callback: () => void, ms: number): unknown
  clear(timer: unknown): void
}
const realClock: Clock = {
  now: Date.now,
  set: (callback, ms) => { const timer = setTimeout(callback, ms); timer.unref(); return timer },
  clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}

export function createLoops(ctx: Plugin.Context, clock: Clock = realClock) {
  const schedules = new Map<string, { value: Schedule; timer?: unknown; controller: AbortController }>()
  let disposed = false
  const active = (entry: { value: Schedule }) => entry.value.state === "scheduled" || entry.value.state === "dispatching"

  function arm(entry: { value: Schedule; timer?: unknown; controller: AbortController }, authorize: () => Promise<void>) {
    entry.timer = clock.set(() => { void fire(entry, authorize) }, Math.max(0, entry.value.nextAt - clock.now()))
  }
  async function fire(entry: { value: Schedule; timer?: unknown; controller: AbortController }, authorize: () => Promise<void>) {
    const value = entry.value
    if (disposed || !active(entry) || schedules.get(value.sessionID) !== entry) return
    if (clock.now() >= value.expiresAt) { value.state = "expired"; return }
    value.state = "dispatching"
    try {
      await authorize()
      if (disposed || entry.controller.signal.aborted || !active(entry)) return
      const current = await ctx.session.get({ sessionID: value.sessionID }, { signal: entry.controller.signal })
      if (current.location.directory !== ctx.location.directory) throw new Error("Session moved; schedule stopped")
      if (clock.now() >= value.expiresAt) { value.state = "expired"; return }
      entry.controller.signal.throwIfAborted()
      await ctx.session.prompt({
        sessionID: value.sessionID,
        text: `[pstack scheduled wake-up ${value.runs + 1}/${value.maxRuns}]\n${value.prompt}\n\nStop this session's pstack loop when its finish condition passes.`,
        delivery: "queue",
      }, { signal: entry.controller.signal })
      value.runs++
      // Admission is not completion. Wait so a slow model turn cannot build up queued ticks.
      await ctx.session.wait({ sessionID: value.sessionID }, { signal: entry.controller.signal })
      if (disposed || entry.controller.signal.aborted || !active(entry)) return
      if (!value.every || value.runs >= value.maxRuns) { value.state = "completed"; return }
      value.nextAt = clock.now() + value.every
      if (value.nextAt >= value.expiresAt) { value.state = "expired"; return }
      value.state = "scheduled"
      arm(entry, authorize)
    } catch (error) {
      if (disposed || entry.controller.signal.aborted) return
      value.state = "failed"
      value.error = error instanceof Error ? error.message : String(error)
    }
  }
  return {
    list(sessionID: string) {
      const value = schedules.get(sessionID)?.value
      return value ? [{ ...value }] : []
    },
    schedule(sessionID: string, prompt: string, delay: number, every: number | undefined, maxRuns: number, authorize: () => Promise<void>) {
      if (disposed) throw new Error("Pstack plugin was unloaded")
      const existing = schedules.get(sessionID)
      if (existing && active(existing)) throw new Error("Stop the existing session schedule first")
      if (schedules.size >= 100 && !existing) throw new Error("This plugin instance has reached its schedule limit")
      const value: Schedule = {
        sessionID, prompt, every, nextAt: clock.now() + delay, expiresAt: clock.now() + day,
        maxRuns, runs: 0, state: "scheduled",
      }
      const entry = { value, controller: new AbortController() }
      schedules.set(sessionID, entry)
      arm(entry, authorize)
      return { ...value }
    },
    stop(sessionID: string) {
      const entry = schedules.get(sessionID)
      if (entry && active(entry)) {
        entry.value.state = "stopped"
        clock.clear(entry.timer)
        entry.controller.abort()
      }
      return this.list(sessionID)
    },
    dispose() {
      disposed = true
      for (const entry of schedules.values()) { clock.clear(entry.timer); entry.controller.abort() }
      schedules.clear()
    },
  }
}
