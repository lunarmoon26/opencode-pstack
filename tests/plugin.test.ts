import { describe, test, expect } from "bun:test"
import { Agent, Model } from "@opencode/plugin"
import pstack from "../plugin/pstack.ts"
import { loadCatalog } from "../plugin/catalog.ts"
import { harness } from "./harness.ts"

describe("native pstack runtime", () => {
  test("commands register before deferred session skill transforms are replayed", async () => {
    const h = harness({}, true)
    const dispose = await pstack.setup(h.context)
    expect(h.skills.size).toBe(0)
    expect(h.commands.has("poteto-mode")).toBe(true)
    expect(h.commands.has("setup-pstack")).toBe(true)
    for (const transform of h.transforms) transform()
    expect(h.skills.has("poteto-mode")).toBe(true)
    await dispose?.()
  })
  test("registers a single tool and all skills without changing config or activating routing", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    expect([...h.tools.keys()]).toEqual(["pstack"])
    expect(h.skills.size).toBe(loadCatalog().skills.length)
    expect(h.skills.get("poteto-mode")?.autoinvoke).toBe(false)
    expect(h.agents.get("poteto")?.mode).toBe("primary")
    expect(h.agents.get("comment-sicko")?.mode).toBe("subagent")
    expect(h.agents.get("poteto")?.system).toBeUndefined()
    expect(h.agents.get("pstack-code")?.model).toBeUndefined()
    expect(h.prompts).toHaveLength(0)
    expect(h.storage.size).toBe(0)
    const event = { sessionID: "ses_test", agent: "build", system: [], messages: [] }
    await h.emit("session", "context", event)
    expect(event.system).toEqual([])
    expect((await h.call({ action: "status" })).options.loops).toBe(false)
    await dispose?.()
  })

  test("preserves user skills, agents and commands on collisions", async () => {
    const h = harness()
    const existingSkill = { ...loadCatalog().skills[0]!, id: "poteto-mode", name: "User skill", path: "/user/SKILL.md" } as any
    h.skills.set("poteto-mode", existingSkill)
    const existingAgent = { ...Agent.Info.default(Agent.ID.make("poteto")), description: "My own agent" }
    h.agents.set("poteto", existingAgent)
    const command = { name: "how", execute: async () => {} }
    h.commands.set("how", command)
    const dispose = await pstack.setup(h.context)
    expect(h.skills.get("poteto-mode")).toBe(existingSkill)
    expect(h.agents.get("poteto")?.description).toBe("My own agent")
    expect(h.commands.get("how")).toBe(command)
    expect((await h.call({ action: "status" })).conflicts).toEqual(expect.arrayContaining(["skill:poteto-mode", "agent:poteto", "command:how"]))
    const event = { sessionID: "ses_test", agent: "poteto", system: [] }
    await h.emit("session", "context", event)
    expect(event.system).toEqual([])
    await dispose?.()
  })

  test("rejects duplicate runtimes and unknown options before partial registration", async () => {
    const h = harness({ allowAll: true })
    await expect(pstack.setup(h.context)).rejects.toThrow()
    expect(h.skills.size).toBe(0)
    const duplicate = harness()
    duplicate.tools.set("pstack", { name: "pstack" } as any)
    await expect(pstack.setup(duplicate.context)).rejects.toThrow("already registered")
    expect(duplicate.skills.size).toBe(0)
  })

  test("routing and command registration are independently opt-in", async () => {
    const h = harness({ routing: true, commands: false })
    const dispose = await pstack.setup(h.context)
    expect(h.commands.size).toBe(0)
    const event = { sessionID: "ses_test", agent: "build", system: [] as any[] }
    await h.emit("session", "context", event)
    expect(event.system[0].text).toContain("routing is enabled")
    expect(event.system[0].text).not.toContain("Private session store")
    await dispose?.()
  })

  test("checklists are validated, session-scoped, and reinjected only when active", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    const todos = [{ content: "Verify", status: "in_progress" }]
    await h.call({ action: "todos", todos })
    expect(await h.call({ action: "todos" }, "ses_other")).toEqual([])
    const event = { sessionID: "ses_test", agent: "build", system: [] as any[] }
    await h.emit("session", "context", event)
    expect(event.system[0].text).toContain("[~] Verify")
    expect(event.system[0].text).toContain("Operator instructions")
    await expect(h.call({ action: "todos", todos: [...todos, ...todos] })).rejects.toThrow("At most one")
    await expect(h.call({ action: "todos", todos: [{ content: "", status: "completed" }] })).rejects.toThrow()
    await h.call({ action: "todos", todos: [] })
    expect(await h.call({ action: "todos" })).toEqual([])
    await dispose?.()
  })

  test("commands preserve attachments and requested delivery and explicitly activate", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    const files = [{ uri: "file:///test/input.txt" }]
    await h.commands.get("poteto-mode")!.execute({ sessionID: "ses_test", delivery: "queue", prompt: { text: "fix this", files } } as any)
    expect(h.prompts[0]).toMatchObject({ delivery: "queue", text: "fix this", files, skills: [{ id: "poteto-mode" }] })
    expect(h.storage.get("active/ses_test")).toBe(true)
    const event = { sessionID: "ses_test", agent: "build", system: [] as any[] }
    await h.emit("session", "compaction", event)
    expect(event.system[0].text).toContain("approval boundaries")
    await dispose?.()
  })

  test("direct skill activation and native skill loads activate the host adapter", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    await h.emit("session", "prompt", { sessionID: "ses_direct", prompt: { skills: [{ id: "poteto-mode" }] } })
    await h.emit("tool", "execute.after", { sessionID: "ses_loaded", tool: "skill", status: "completed", input: { id: "how" } })
    expect(h.storage.get("active/ses_direct")).toBe(true)
    expect(h.storage.get("active/ses_loaded")).toBe(true)
    await dispose?.()
  })

  test("comment-sicko's read-only boundary rejects external and code-mode escape tools", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    for (const tool of ["shell", "patch", "notion", "execute", "subagent", "pstack"]) {
      await expect(h.emit("tool", "execute.before", { agent: "comment-sicko", tool })).rejects.toThrow("read-only")
    }
    await h.emit("tool", "execute.before", { agent: "comment-sicko", tool: "read" })
    await dispose?.()
  })

  test("role models are exact, available preferences; unconfigured roles inherit", async () => {
    const h = harness({ models: { code: "test/vendor/code#high" } })
    h.modelInventory.push({ providerID: "test", id: "vendor/code", variants: [{ id: "high" }], enabled: true })
    const dispose = await pstack.setup(h.context)
    expect(h.agents.get("pstack-code")?.model).toEqual(Model.Ref.parse("test/vendor/code#high"))
    expect(h.agents.get("pstack-judgment")?.model).toBeUndefined()
    const bad = harness({ models: { code: "test/vendor/code#max" } })
    bad.modelInventory.push(...h.modelInventory)
    await expect(pstack.setup(bad.context)).rejects.toThrow("unavailable")
    expect(bad.tools.size).toBe(0)
    await dispose?.()
  })

  test("denied transcript export performs no session reads; scheduling is off by default", async () => {
    const h = harness()
    const dispose = await pstack.setup(h.context)
    const denied = new Error("Policy denied")
    h.deny(denied)
    await expect(h.call({ action: "transcripts" })).rejects.toBe(denied)
    expect(h.sessionReads).toEqual([])
    expect(h.assertions).toHaveLength(1)
    await expect(h.call({ action: "loop", operation: "schedule", prompt: "check until green", every: "5m" })).rejects.toThrow("disabled")
    expect(await h.call({ action: "loop", operation: "list" })).toEqual([])
    await expect(h.call({ action: "transcripts", scope: "all" })).rejects.toThrow()
    await dispose?.()
  })

  test("denied, malformed and cancelled schedules never arm", async () => {
    const h = harness({ loops: true })
    const dispose = await pstack.setup(h.context)
    await expect(h.call({ action: "loop", operation: "schedule", every: "0s", prompt: "check" })).rejects.toThrow("30 seconds")
    expect(h.assertions).toHaveLength(0)
    h.deny()
    await expect(h.call({ action: "loop", operation: "schedule", every: "5m", prompt: "check" })).rejects.toThrow("Denied")
    expect(await h.call({ action: "loop", operation: "list" })).toEqual([])
    const context = { ...h.callContext(), signal: AbortSignal.abort() }
    await expect(h.tools.get("pstack")!.execute({ action: "todos", todos: [] }, context)).rejects.toThrow()
    await dispose?.()
  })

  test("cleanup rejects stale executors and clears scheduled work", async () => {
    const h = harness({ loops: true })
    const dispose = await pstack.setup(h.context)
    await h.call({ action: "loop", operation: "schedule", every: "1h", prompt: "check until green" })
    expect((await h.call({ action: "loop", operation: "list" }))[0].maxRuns).toBe(3)
    await dispose?.()
    await expect(h.call({ action: "status" })).rejects.toThrow("unloaded")
  })
})
