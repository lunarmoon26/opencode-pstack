import { Agent, Plugin, Skill } from "@opencode/plugin"
import { z } from "zod"
import { join } from "node:path"
import { loadCatalog, dist } from "./catalog.ts"
import { optionsSchema, resolveModels, renderRoles } from "./options.ts"
import { inputSchema, todosSchema, renderTodos } from "./schema.ts"
import { createLoops, duration } from "./loops.ts"
import { exportTranscripts, storeDirectory } from "./transcripts.ts"

const todoKey = (sessionID: string) => `todos/${sessionID}`
const activeKey = (sessionID: string) => `active/${sessionID}`
const readTools = new Set(["read", "glob", "grep", "skill", "webfetch", "websearch"])

export default Plugin.define({
  id: "pstack",
  async setup(ctx) {
    const options = optionsSchema.parse(ctx.options)
    const catalog = loadCatalog()
    const inventory = Object.keys(options.models).length ? (await ctx.model.list()).data : []
    const models = resolveModels(options, inventory)
    const loops = createLoops(ctx)
    const conflicts = new Set<string>()
    const ownedAgents = new Map<string, string>()
    // Skill transforms are replayed in a session catalog, not necessarily during
    // setup. Commands must not depend on that first replay having happened.
    const ownedSkills = new Set(catalog.skills.map((skill) => skill.id))
    let disposed = false

    // If this tool name is already in use, fail before registering a partial port.
    if ((await ctx.tool.list()).some((tool) => tool.id === "pstack")) throw new Error("The pstack tool is already registered; load only one pstack runtime")

    await ctx.skill.transform((editor) => {
      for (const skill of catalog.skills) {
        if (editor.get(skill.id)) { ownedSkills.delete(skill.id); conflicts.add(`skill:${skill.id}`); continue }
        ownedSkills.add(skill.id)
        editor.add({
          id: Skill.ID.make(skill.id), name: Skill.Name.make(skill.name),
          description: skill.description, autoinvoke: false,
          path: Skill.Info.fields.path.make(join(dist, skill.file)), content: skill.content,
        })
      }
    })

    const delegate = catalog.agents.find((agent) => agent.id === "poteto-agent")!
    const agents = [
      ...catalog.agents,
      { ...delegate, id: "pstack-code", name: "Pstack Code", description: "Pstack delegate using the operator's code model preference." },
      { ...delegate, id: "pstack-judgment", name: "Pstack Judgment", description: "Pstack delegate using the operator's judgment model preference." },
    ]
    await ctx.agent.transform((editor) => {
      ownedAgents.clear()
      for (const entry of agents) {
        if (editor.get(entry.id)) { conflicts.add(`agent:${entry.id}`); continue }
        ownedAgents.set(entry.id, entry.content)
        editor.update(entry.id, (agent) => {
          agent.name = Agent.Name.make(entry.name ?? entry.id)
          agent.description = entry.description
          agent.mode = entry.id === "poteto" ? "primary" : "subagent"
          if (entry.color) agent.color = entry.color
          if (entry.id === "pstack-code" && models.code) agent.model = models.code
          if (entry.id === "pstack-judgment" && models.judgment) agent.model = models.judgment
          if (agent.mode === "subagent") agent.permissions.push({ action: "question", resource: "*", effect: "deny" })
          if (entry.id === "comment-sicko") {
            for (const action of ["edit", "shell", "subagent"]) agent.permissions.push({ action, resource: "*", effect: "deny" })
          }
        })
      }
    })

    // Enforce the read-only reviewer's tool allowlist without adding permission grants.
    await ctx.tool.hook("execute.before", (event) => {
      if (ownedAgents.has("comment-sicko") && event.agent === "comment-sicko" && !readTools.has(event.tool)) {
        throw new Error(`comment-sicko is read-only; ${event.tool} is not permitted`)
      }
    })
    await ctx.tool.hook("execute.after", async (event) => {
      if (event.tool !== "skill" || event.status !== "completed") return
      const input = z.object({ id: z.string() }).safeParse(event.input)
      if (input.success && ownedSkills.has(input.data.id)) await ctx.storage.set(activeKey(event.sessionID), true)
    })

    await ctx.tool.transform((editor) => {
      if (editor.get("pstack")) throw new Error("The pstack tool is already registered")
      editor.add({
        name: "pstack",
        description: "Pstack host operations. action=status reports options, capabilities and conflicts; models lists available models; todos reads/replaces this session's checklist; transcripts exports private session context with permission; loop schedules/lists/stops bounded, opt-in model wake-ups. This tool does not execute upstream scripts or edit OpenCode config.",
        input: { ...z.toJSONSchema(inputSchema, { io: "input" }), type: "object" },
        async execute(input, context) {
          context.signal.throwIfAborted()
          if (disposed) throw new Error("Pstack plugin was unloaded")
          const args = inputSchema.parse(input)
          const authorize = async (action: string) => {
            await ctx.permission.assert({
              sessionID: context.sessionID, agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
              action, resources: [context.sessionID], save: [context.sessionID],
              metadata: { action: args.action, arguments: args },
            })
          }
          let value: unknown
          switch (args.action) {
            case "status":
              value = {
                upstream: catalog.upstream, options, skills: catalog.skills.length,
                registeredSkills: ownedSkills.size, registeredAgents: [...ownedAgents.keys()],
                conflicts: [...conflicts].sort(),
                capabilities: { todos: true, transcripts: "permission-gated, exact-directory only", scheduling: options.loops, cloudAgents: false, hostedAutomations: false },
              }
              break
            case "models": {
              const result = await ctx.model.list({}, { signal: context.signal })
              value = result.data.filter((model) => model.enabled).map((model) => ({
                id: `${model.providerID}/${model.id}`, name: model.name, variants: model.variants.map((variant) => variant.id), cost: model.cost,
              }))
              break
            }
            case "todos":
              if (args.todos) {
                await ctx.storage.set(todoKey(context.sessionID), args.todos)
                await ctx.storage.set(activeKey(context.sessionID), true)
              }
              value = todosSchema.parse(await ctx.storage.get(todoKey(context.sessionID)) ?? [])
              break
            case "transcripts":
              await authorize("pstack.transcripts")
              context.signal.throwIfAborted()
              if (disposed) throw new Error("Pstack plugin was unloaded")
              value = await exportTranscripts(ctx, context.sessionID, args.scope, args.limit, context.signal)
              break
            case "loop":
              if (args.operation === "list") { value = loops.list(context.sessionID); break }
              if (args.operation === "stop") { value = loops.stop(context.sessionID); break }
              if (!options.loops) throw new Error("Scheduled work is disabled. The operator must explicitly set plugin option loops=true.")
              if (!args.prompt || (!args.every && !args.after)) throw new Error("Scheduling needs a prompt and every or after")
              const every = args.every ? duration(args.every) : undefined
              const delay = args.after ? duration(args.after) : every!
              await authorize("pstack.schedule")
              context.signal.throwIfAborted()
              value = loops.schedule(context.sessionID, args.prompt, delay, every, args.maxRuns, () => authorize("pstack.schedule"))
              break
          }
          return { content: JSON.stringify(value, null, 2) }
        },
      })
    })

    const commands = new Set((await ctx.command.list()).data.map((command) => command.name))
    await ctx.command.transform((editor) => {
      if (!options.commands) return
      for (const skill of catalog.skills) {
        if (skill.id.startsWith("principle-") || !ownedSkills.has(skill.id)) continue
        if (commands.has(skill.id)) { conflicts.add(`command:${skill.id}`); continue }
        editor.add({
          name: skill.id, description: `pstack: ${skill.description ?? skill.name}`.slice(0, 200),
          async execute({ sessionID, prompt, delivery }) {
            await ctx.storage.set(activeKey(sessionID), true)
            await ctx.session.prompt({
              ...prompt, sessionID, delivery,
              text: prompt.text.trim() || `Run ${skill.id}.`,
              skills: [...(prompt.skills ?? []), { id: Skill.ID.make(skill.id) }],
            })
          },
        })
      }
      if (!commands.has("pstack-loop")) editor.add({
        name: "pstack-loop", description: "Ask for a bounded, permission-gated pstack schedule. Does not schedule automatically.",
        async execute({ sessionID, prompt, delivery }) {
          await ctx.session.prompt({ ...prompt, sessionID, delivery,
            text: `Inspect pstack status, then request a bounded schedule through the pstack tool only if enabled and authorized. Explain its run limit and expiry. User request: ${prompt.text}`,
          })
        },
      })
      else conflicts.add("command:pstack-loop")
    })

    await ctx.session.hook("prompt", async (event) => {
      if (event.prompt.skills?.some((skill) => ownedSkills.has(skill.id))) await ctx.storage.set(activeKey(event.sessionID), true)
    })
    await ctx.session.hook("context", async (event) => {
      const agentPrompt = ownedAgents.get(event.agent)
      const active = agentPrompt || await ctx.storage.get(activeKey(event.sessionID)) === true
      if (!active && !options.routing) return
      if (!active) {
        event.system.push({ type: "text", text: "Pstack routing is enabled by the operator. For substantive engineering tasks, load poteto-mode before work. Explicit user instructions take precedence." })
        return
      }
      const effective = (await ctx.agent.list()).data
      const code = effective.find((agent) => agent.id === "pstack-code")?.model
      const judgment = effective.find((agent) => agent.id === "pstack-judgment")?.model
      const todos = todosSchema.parse(await ctx.storage.get(todoKey(event.sessionID)) ?? [])
      const roles = renderRoles(code, judgment)
      const notes = [
        ...(agentPrompt ? [agentPrompt] : []),
        catalog.host,
        `Session: ${event.sessionID}. Private session store: ${storeDirectory(ctx.location.directory, event.sessionID)}.`,
        roles,
        ...(todos.length ? [`Current checklist:\n${renderTodos(todos)}`] : []),
      ]
      event.system.push({ type: "text", text: `<pstack-host>\n${notes.join("\n\n")}\n</pstack-host>` })
    })
    await ctx.session.hook("compaction", async (event) => {
      if (ownedAgents.has(event.agent) || await ctx.storage.get(activeKey(event.sessionID)) === true) {
        event.system.push({ type: "text", text: "Preserve the active pstack playbook, verification evidence, delegated work, user approval boundaries, and next action in the summary. Pstack's checklist is stored separately and will be reinjected." })
      }
    })
    return () => { disposed = true; loops.dispose() }
  },
})
