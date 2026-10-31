import { Agent, type Plugin } from "@opencode/plugin"
import type { Info as ToolInfo, ToolContext } from "@opencode/plugin/promise/tool"
import type { CommandDefinition } from "@opencode/plugin/promise/command"
import type { Catalog } from "../plugin/catalog.ts"

type SkillEditor = Parameters<Parameters<Plugin.Context["skill"]["transform"]>[0]>[0]
type AgentEditor = Parameters<Parameters<Plugin.Context["agent"]["transform"]>[0]>[0]
type MutableAgent = Parameters<Parameters<AgentEditor["update"]>[1]>[0]
type Hook = (event: any) => unknown

export function harness(options: Record<string, unknown> = {}, deferSkills = false) {
  const skills = new Map<string, Parameters<SkillEditor["add"]>[0]>()
  const agents = new Map<string, MutableAgent>()
  const tools = new Map<string, ToolInfo>()
  const commands = new Map<string, CommandDefinition>()
  const storage = new Map<string, unknown>()
  const hooks = new Map<string, Hook[]>()
  const assertions: unknown[] = []
  const prompts: any[] = []
  const sessionReads: string[] = []
  const modelInventory: any[] = []
  const messages: any[] = []
  const sessions: any[] = []
  let permissionError: Error | undefined
  const self = { id: "ses_test", projectID: "project-1", location: { directory: "/test/project" } }
  const register = async (name: string, callback: Hook) => {
    hooks.set(name, [...hooks.get(name) ?? [], callback])
    return { dispose: async () => {} }
  }
  const transforms: (() => void)[] = []
  const skillEditor: SkillEditor = {
    list: () => [...skills.values()], get: (id) => skills.get(id), add: (skill) => { skills.set(skill.id, skill) },
    update: (id, fn) => { const skill = skills.get(id); if (skill) fn(skill) }, remove: (id) => { skills.delete(id) },
  }
  const agentEditor: AgentEditor = {
    list: () => [...agents.values()], get: (id) => agents.get(id),
    update(id, fn) { const agent = agents.get(id) ?? Agent.Info.default(Agent.ID.make(id)); fn(agent); agents.set(id, agent) },
    remove: (id) => { agents.delete(id) }, default: () => { throw new Error("Do not change the default agent") },
  }
  const context = {
    options, location: { directory: self.location.directory, project: { id: self.projectID } },
    skill: { transform: async (fn: (editor: SkillEditor) => void) => { transforms.push(() => fn(skillEditor)); if (!deferSkills) fn(skillEditor) } },
    agent: {
      transform: async (fn: (editor: AgentEditor) => void) => { fn(agentEditor) },
      list: async () => ({ data: [...agents.values()] }),
    },
    tool: {
      list: async () => [...tools].map(([id, tool]) => ({ id, ...tool })),
      transform: async (fn: (editor: any) => void) => fn({ get: (id: string) => tools.get(id), add: (tool: ToolInfo) => tools.set(tool.name, tool) }),
      hook: (name: string, fn: Hook) => register(`tool:${name}`, fn),
    },
    command: {
      list: async () => ({ data: [...commands.values()] }),
      transform: async (fn: (editor: any) => void) => fn({ add: (command: CommandDefinition) => commands.set(command.name, command) }),
    },
    model: { list: async () => ({ data: modelInventory }) },
    storage: {
      get: async (key: string) => structuredClone(storage.get(key)),
      set: async (key: string, value: unknown) => { storage.set(key, structuredClone(value)) },
    },
    permission: { assert: async (input: unknown) => { assertions.push(input); if (permissionError) throw permissionError } },
    session: {
      hook: (name: string, fn: Hook) => register(`session:${name}`, fn),
      prompt: async (input: unknown) => { prompts.push(input) },
      get: async ({ sessionID }: { sessionID: string }) => { sessionReads.push(sessionID); return sessions.find((session) => session.id === sessionID) ?? self },
      list: async () => ({ data: sessions, cursor: {} }),
      context: async () => messages,
      wait: async () => {},
    },
  } as unknown as Plugin.Context
  const callContext = (sessionID = "ses_test") => ({ sessionID, agent: "build", messageID: "msg_test", id: "call_1", signal: new AbortController().signal }) as ToolContext
  return {
    context, skills, agents, tools, commands, storage, assertions, prompts, modelInventory,
    sessionReads, messages, sessions, self, transforms, callContext,
    deny(error = new Error("Denied")) { permissionError = error },
    async emit(domain: "tool" | "session", name: string, event: any) { for (const hook of hooks.get(`${domain}:${name}`) ?? []) await hook(event) },
    async call(input: unknown, sessionID = "ses_test") {
      const result = await tools.get("pstack")!.execute(input, callContext(sessionID))
      return JSON.parse(result.content as string)
    },
  }
}
