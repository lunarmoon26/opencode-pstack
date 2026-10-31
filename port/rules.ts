// Mechanical rewrites from Cursor vocabulary to OpenCode V2. Rules run in order on every shipped
// markdown file (or on `files` when set). Each rule must match at least `count` times (default 1),
// so an upstream rewrite that removes the target fails the build instead of silently shipping
// stale text. Prefer exact strings; use a global regex only for repeated phrasings.
export type Rule = {
  find: string | RegExp
  replace: string
  files?: RegExp
  count?: number
  why: string
}


export const rules: Rule[] = [
  // ── Model sheet: ~/.cursor/rules/pstack-models.mdc → plugin-injected pstack model sheet ──────────
  {
    find: "No `~/.cursor/rules/pstack-models.mdc` means `/setup-pstack` hasn't run for this user, so every role uses its default model.",
    replace: "No pstack model sheet in the system prompt means `/setup-pstack` hasn't run for this user, so every role uses its default model.",
    why: "the plugin injects the sheet into every request, so its absence is visible in the prompt",
  },
  {
    find: /`~\/\.cursor\/rules\/pstack-models\.mdc`/g,
    replace: "the pstack model sheet",
    why: "the model sheet lives at ~/.config/opencode/pstack/models.md and the plugin injects it",
  },
  {
    find: /the `(?:pstack-models\.mdc|\/setup-pstack)` rule/g,
    replace: "the pstack model sheet",
    why: "same sheet, different upstream phrasing",
  },
  {
    find: /If the rule or (that|the) line is missing/g,
    replace: "If the sheet or $1 line is missing",
    why: "the rule is now a sheet",
  },
  {
    find: "When the model rule is missing",
    replace: "When the model sheet is missing",
    why: "the rule is now a sheet",
  },

  // ── Default models: Cursor slugs → sheet aliases resolved by the plugin ───────────────────────────
  {
    find: /`grok-4\.7-xhigh-fast`/g,
    replace: "`code-default`",
    count: 10,
    why: "OpenCode model IDs depend on the user's providers; the sheet maps code-default to one",
  },
  {
    find: /`claude-opus-5-5-xhigh`/g,
    replace: "`judgment-default`",
    count: 8,
    why: "OpenCode model IDs depend on the user's providers; the sheet maps judgment-default to one",
  },
  {
    find: "Families go by prefix: `claude-*`, and `grok-*` with `cursor-grok-*` and `composer-*`. A refused `composer-*` entry runs on `code-default`.",
    replace: "Families go by the vendor segment of the model ID (`anthropic` in `vercel/anthropic/claude-opus-5.5`, or the provider ID when the model ID has no vendor segment). A family's default is whichever of `judgment-default` and `code-default` resolves to a model of that family.",
    why: "OpenCode model IDs carry the vendor, not a Cursor slug prefix, and the defaults are the sheet's two aliases",
  },
  {
    find: "With the default pool, a Claude parent gets `code-default`. A parent from any other family gets `judgment-default` first. If the Task tool rejects an entry, use a valid slug of the same model at the closest level or speed from the error message, or move to the next entry when there is none.",
    replace: "With the default pool, the judge runs on the first of `judgment-default` and `code-default` that resolves to another family. If the `subagent` tool rejects an entry, use the same model at the closest variant or speed that the `models` tool lists, or move to the next entry when there is none.",
    why: "the default pool is the sheet's two aliases, which can resolve to any family, and OpenCode lists valid models through the models tool",
  },
  {
    find: "If you do not know the parent's model, try the pool's real slugs in pool order",
    replace: "If you do not know the parent's model, try the pool's entries other than `auto` and `inherit-parent` in pool order",
    why: "OpenCode pool entries are model refs or the sheet's aliases, not slugs",
  },
  {
    find: /use the closest valid slug of the same family from its error message/g,
    replace: "use the closest valid model of the same family that the `models` tool lists",
    why: "OpenCode's subagent error points at the models tool instead of listing slugs",
  },
  {
    find: /rejects a slug/g,
    replace: "rejects a model",
    why: "OpenCode passes `provider/model#variant` refs, not slugs",
  },
  {
    find: "**Match the model to the job.** Before each spawn, start from the role's line or default and pick the reasoning level and speed the job needs. The `/setup-pstack` budget sets each role's starting level, xhigh by default. Raise it one step, up to max, for the hardest or subtlest work. Lower it one step for judgment and two or more steps for routine work. Use fast mode only when the job is urgent, meaning CI or trunk is red or a person is blocked on the result right now. Otherwise use standard speed, the same slug without `-fast`. Verification is the exception and stays on the `swarm workers` model and speed (`code-default` by default). Change only the effort level and whether the slug is fast, and keep the family the role names, so a diverse panel stays diverse. If the family has no slug at that level and speed, use its nearest slug. A role on `auto` or `inherit-parent` stays on the parent model. If the Task tool rejects the adjusted slug, do not try another adjusted slug. Use the role's line or default and say so. If the Task tool rejects that too, continue with the calling skill's fallback. A slug counts as rejected once a Task error says that the model is not valid, or leaves the slug out of its list of valid slugs. Never pass a rejected slug, and skip any fallback whose slug is already rejected. When the calling skill has no fallback, use the closest valid slug of the role's family from the error's list of valid slugs, or omit `model` so the subagent runs on the parent model when the list has none. When the calling skill's fallback runs out of slugs without saying what to do next, omit `model` too. Say so in both cases.",
    replace: "**Match the model to the job.** Before each spawn, start from the role's line or default and pick the reasoning level and speed the job needs. The reasoning level is the `#variant` suffix of the model ref (`vercel/anthropic/claude-opus-5.5#xhigh`), and the `models` tool lists each model's variants. The `/setup-pstack` budget sets each role's starting variant, xhigh by default. Raise it one step on the ladder `max` > `xhigh` > `high` > `medium` > `low`, up to the model's highest variant, for the hardest or subtlest work. Lower it one step for judgment and two or more steps for routine work. Use a fast model (an ID ending in `-fast`) only when the job is urgent, meaning CI or trunk is red or a person is blocked on the result right now. Otherwise use the standard model of the same family when the `models` tool lists one. Verification is the exception and stays on the `swarm workers` model and speed (`code-default` by default). Change only the variant and whether the model is fast, and keep the family the role names, so a diverse panel stays diverse. If the model has no variant at that level, use its nearest variant. A role on `auto` or `inherit-parent` stays on the parent model. If the `subagent` tool rejects the adjusted ref, do not try another adjusted ref. Use the role's line or default and say so. If the `subagent` tool rejects that too, continue with the calling skill's fallback. A ref counts as rejected once a `subagent` error says that the model is not valid. Never pass a rejected ref, and skip any fallback whose ref is already rejected. When the calling skill has no fallback, use the closest model of the role's family that the `models` tool lists, or omit `model` so the subagent runs on the parent model when it lists none. When the calling skill's fallback runs out of refs without saying what to do next, omit `model` too. Say so in both cases.",
    why: "OpenCode encodes effort as a model variant and speed as a separate -fast model ID, and its subagent error points at the models tool instead of listing valid slugs",
  },

  // ── Subagents: Cursor Task tool → OpenCode subagent tool ──────────────────────────────────────────
  {
    find: "**Defaults for every `Task` call.** `run_in_background: true` (a steer or resume of a running agent too, because a foreground call holds your turn while other reports wait), agent mode (readonly strips MCP), file pointers not inlined context,",
    replace: "**Defaults for every `subagent` call.** `background: true` (a steer or resume of a running agent through its `sessionID` too, because a foreground call holds your turn while other reports wait), a full-tool agent such as `poteto-agent` or `general` (the read-only `explore` agent has no MCP tools), file pointers not inlined context,",
    why: "OpenCode's subagent tool takes `background` and resumes by `sessionID`; read-only is the explore agent",
  },
  {
    find: "explicit model per role (configurable via `/setup-pstack`.",
    replace: "explicit `model` per role, which the pstack model sheet counts as the user asking for that model (configurable via `/setup-pstack`.",
    why: "OpenCode's subagent tool tells the model never to set `model` unless the user asks; the sheet is that ask",
  },
  {
    find: "(omit Task `model`)",
    replace: "(omit the `subagent` `model`)",
    why: "tool rename",
  },
  {
    find: "Every spawn is a Task subagent with `subagent_type: generalPurpose` and `readonly: true`.",
    replace: "Every spawn is a `subagent` call with `agent: \"explore\"`, the read-only agent.",
    why: "Cursor readonly generalPurpose is OpenCode's explore agent",
  },
  {
    find: "Spawn each adversary as `generalPurpose`.",
    replace: "Spawn each adversary with `agent: \"general\"`.",
    why: "adversaries write repros and run them in their own worktrees, so they need OpenCode's full-tool general agent",
  },
  {
    find: "Every spawn is `generalPurpose` with `readonly: false` (agent mode). **Do not use readonly/Ask mode.** It strips MCP access,",
    replace: "Every spawn uses `agent: \"general\"`. **Do not use the read-only `explore` agent.** It has no MCP access,",
    why: "Cursor agent-mode generalPurpose is OpenCode's general agent",
  },
  {
    find: "One message, three `Task` calls, `subagent_type: generalPurpose`, agent mode (`readonly: false`). Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and readonly strips MCPs.",
    replace: "One message, three `subagent` calls, `agent: \"general\"`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and the read-only `explore` agent has no MCP tools.",
    why: "Cursor agent-mode generalPurpose is OpenCode's general agent",
  },
  {
    find: "One `Task` call, `subagent_type: generalPurpose`, `model` from the `reflect judgment, divergent, synthesizer` line (default `judgment-default`), agent mode (`readonly: false`). It spot-verifies citations through MCP, and readonly strips MCPs.",
    replace: "One `subagent` call, `agent: \"general\"`, `model` from the `reflect judgment, divergent, synthesizer` line (default `judgment-default`). It spot-verifies citations through MCP, and the read-only `explore` agent has no MCP tools.",
    why: "Cursor agent-mode generalPurpose is OpenCode's general agent",
  },
  {
    find: "Spawn all N workers in one message with `subagent_type: generalPurpose`, `environment: \"cloud\"`, `run_in_background: true`, and the step 3 model, left unset for `auto` or `inherit-parent`. Use `environment: \"local\"` only when the worker needs access to something on the user's computer.",
    replace: "Spawn all N workers in one message with `agent: \"general\"`, `background: true`, and the step 3 model, left unset for `auto` or `inherit-parent`. Give each worker that edits files, builds, or runs the app its own git worktree: create it with the `worktree_create` tool, put its absolute path in the brief, and tell the worker to set `workdir` on every shell call and use absolute paths. Read-only workers share the current checkout.",
    why: "OpenCode has no cloud subagents; a git worktree per worker gives the same isolation locally",
  },
  {
    find: "Spawn one readonly judge subagent.",
    replace: "Spawn one read-only judge subagent (`agent: \"explore\"`).",
    why: "read-only is the explore agent",
  },
  {
    find: "Spawn `Task` with `subagent_type: \"comment-sicko\"`.",
    replace: "Spawn a `subagent` with `agent: \"comment-sicko\"`.",
    why: "tool and parameter rename",
  },
  {
    find: /set their own `subagent_type`/g,
    replace: "set their own `agent`",
    why: "parameter rename",
  },
  {
    find: /`subagent_type: "([a-z-]+)"`/g,
    replace: "`agent: \"$1\"`",
    count: 3,
    why: "parameter rename",
  },
  {
    find: /`run_in_background: true`/g,
    replace: "`background: true`",
    why: "parameter rename",
  },
  {
    find: "Stop at three levels: you, sub-coordinators, and workers.",
    replace: "Stop at three levels: you, sub-coordinators, and workers. OpenCode nests that deep once `experimental.subagent_depth` is 3, which `/setup-pstack` sets.",
    why: "OpenCode limits nesting to depth 1 unless experimental.subagent_depth is raised",
  },
  {
    find: "Spawn workers with `Task`.",
    replace: "Spawn workers with the `subagent` tool.",
    why: "tool rename",
  },
  {
    find: "A skill counts as used when the transcript shows a `Read` of its `SKILL.md` (under `.cursor/skills/`, `~/.cursor/skills/`, or `~/.cursor/plugins/`), a `Task` prompt naming its path, or a tool call (Shell, Grep, MCP, etc.) matching its documented commands.",
    replace: "A skill counts as used when the transcript shows a `skill` tool call loading it, a `read` of its `SKILL.md` (under `.opencode/skills/`, `~/.config/opencode/skills/`, or the pstack plugin's `dist/skills/`), a `subagent` prompt naming its path, or a tool call (shell, grep, MCP, etc.) matching its documented commands.",
    count: 3,
    why: "OpenCode loads skills through the skill tool and from different directories",
  },
  {
    find: /the Task tool/g,
    replace: "the `subagent` tool",
    why: "tool rename",
  },
  {
    find: /`Task` (calls?|prompt|response body)/g,
    replace: "`subagent` $1",
    why: "tool rename",
  },

  // ── Cloud agents → local subagents in their own worktree ──────────────────────────────────────────
  {
    find: "One verifier per PR, each a Cursor cloud agent, runs the change",
    replace: "One verifier per PR, each a `poteto-agent` subagent in its own git worktree, runs the change",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "Each owner is a Cursor cloud agent that builds,",
    replace: "Each owner is a `poteto-agent` subagent in its own git worktree that builds,",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "Each live lane runs on its own cloud VM at the PR head.",
    replace: "Each live lane runs in its own git worktree at the PR head.",
    why: "OpenCode has no cloud VMs",
  },
  {
    find: "Run workers on a new cloud VM (`environment: \"cloud\"`) unless the work needs this machine: a `control-ui` or `control-cli` runtime check (from `cursor-team-kit`), local transcripts, a simulator, or auth that exists only here.",
    replace: "Give each worker that edits files, builds, or runs the app its own git worktree from the `worktree_create` tool, never your checkout. Put the worktree's absolute path in its kickoff, and tell it to set `workdir` on every shell call and use absolute paths.",
    why: "OpenCode subagents all run on this machine; worktrees replace cloud VMs",
  },
  {
    find: "- **Fork when new work needs a worker's built state,** such as its checkout, uncommitted changes, or a running process.",
    replace: "- **Hand a worker's worktree to a fresh worker when new work needs its built state,** such as its checkout, uncommitted changes, or a running process. Paste the first worker's report into the new kickoff, and keep one writer in a worktree at a time.",
    why: "OpenCode's subagent tool cannot fork an agent; the built state lives in the worker's local worktree",
  },
  {
    find: "Keep the program's state in the Project tracker (`notes.md`) and the Project store.",
    replace: "Keep the program's state in `orchestrate/<program-slug>/` in the pstack store (path in the system prompt), with a `notes.md` tracker there.",
    why: "OpenCode has no Projects; the plugin names a per-project pstack store",
  },
  {
    find: "Assume the VM dies.",
    replace: "Assume the agent dies.",
    why: "OpenCode subagents run locally; the session or machine is what dies",
  },
  {
    find: "- [ ] Record a 30 to 60 second video of the change on a lane VM.",
    replace: "- [ ] Record a 30 to 60 second video of the change from a lane worktree.",
    why: "OpenCode lanes run in local worktrees",
  },
  {
    find: /(?:current|root) agent's store \(path in the system prompt\)/g,
    replace: "pstack store (path in the system prompt)",
    why: "Cursor names a per-agent store; the plugin names a per-project pstack store",
  },
  {
    find: "a cloud-agent URL, or a pushed branch.",
    replace: "another OpenCode session ID, or a pushed branch.",
    why: "OpenCode has no cloud-agent URLs",
  },
  {
    find: "from a transcript, cloud-agent URL, or pushed branch.",
    replace: "from a transcript, another OpenCode session ID, or a pushed branch.",
    why: "OpenCode has no cloud-agent URLs",
  },
  {
    find: "When a worker must start from a non-default pushed branch, pass `cloud_base_branch`.",
    replace: "When a worker must start from a non-default pushed branch, name the branch in its brief and have it check the branch out in its worktree first.",
    why: "OpenCode's subagent tool has no base-branch field; the worker checks out the branch itself",
  },
  {
    find: "| Run parallel checks over slices, or race workers, as cloud agents |",
    replace: "| Run parallel checks over slices, or race workers, each in its own worktree |",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "Give each agent its own worktree, or run them as cloud agents, which each get their own machine.",
    replace: "Give each agent its own git worktree, made with the `worktree_create` tool.",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "Run them as cloud agents, or say \"own worktree per attempt\".",
    replace: "Say \"own worktree per attempt\".",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "an isolated worktree or cloud agent,",
    replace: "an isolated worktree,",
    why: "OpenCode has no cloud agents",
  },
  {
    find: "write the file under the agent store's `docs/`.",
    replace: "write the file under `docs/` in the pstack store (path in the system prompt).",
    why: "Cursor names a per-agent store; the plugin names a per-project pstack store",
  },

  // ── Transcripts: agent-transcripts/ → the plugin's `transcripts` tool ─────────────────────────────
  {
    find: "Before fanning out, find this conversation's transcript in the `agent-transcripts/` directory the system prompt names. Do not glob across `~/.cursor/projects/*/`. That crosses workspace boundaries and reads private chats from unrelated projects.",
    replace: "Before fanning out, call the `transcripts` tool. It exports this project's OpenCode sessions as JSONL into a transcripts directory and returns that path and this session's ID. Do not export or read other projects' sessions. That crosses workspace boundaries and reads private chats from unrelated projects.",
    why: "OpenCode keeps sessions in a database; the plugin exports them in Cursor's JSONL layout",
  },
  {
    find: "ls -t <agent-transcripts>/*.jsonl <agent-transcripts>/*/*.jsonl <agent-transcripts>/*/subagents/*.jsonl 2>/dev/null | head -10",
    replace: "ls -t <transcripts>/*/*.jsonl <transcripts>/*/subagents/*.jsonl 2>/dev/null | head -10",
    why: "the export writes the nested and subagent layouts only",
  },
  {
    find: "That covers the legacy flat (`<id>.jsonl`), current nested (`<id>/<id>.jsonl`), and subagent (`<parent>/subagents/<child>.jsonl`) layouts. For each candidate, read the first JSONL line. Take the file whose `message.content[0].text` contains the conversation's opening user prompt.",
    replace: "That covers the session (`<id>/<id>.jsonl`) and subagent (`<parent>/subagents/<child>.jsonl`) layouts. This session's file is `<transcripts>/<session ID>/<session ID>.jsonl`. To confirm a candidate, read its first JSONL line and check that `message.content[0].text` contains the conversation's opening user prompt.",
    why: "the tool names the current session directly",
  },
  {
    find: /under the active workspace's `agent-transcripts\/` directory \(the system prompt names (?:the|this) path\)/g,
    replace: "in the transcripts directory the `transcripts` tool returns",
    count: 2,
    why: "the plugin exports sessions on demand",
  },
  {
    find: "A local transcript under the active workspace's `agent-transcripts/` directory (the system prompt names the path. Do not glob across `~/.cursor/projects/*/`, that crosses workspace boundaries and reads private chats from unrelated projects),",
    replace: "A local transcript in the transcripts directory the `transcripts` tool returns (do not export or read other projects' sessions, that crosses workspace boundaries and reads private chats from unrelated projects),",
    why: "the plugin exports sessions on demand",
  },
  {
    find: "The system prompt names the workspace's `agent-transcripts/` directory. Use only that path.",
    replace: "Call the `transcripts` tool, which exports this project's sessions and returns the directory. Use only that path.",
    why: "the plugin exports sessions on demand",
  },
  {
    find: "Transcripts live at `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl`, where `<slug>` is the workspace path with the leading slash dropped and each \"/\" turned into \"-\" (so `/Users/you/proj` becomes `Users-you-proj`). Every line is one chat message.",
    replace: "Call the `transcripts` tool to export recent OpenCode sessions as `<transcripts>/<session ID>/<session ID>.jsonl`, with subagent sessions under `<session ID>/subagents/`. It covers the active project by default. Pass `scope: \"all\"` only when the user asks for other projects. File modification times match each session's last update. Every line is one chat message.",
    why: "OpenCode keeps sessions in a database; the plugin exports them in Cursor's layout",
  },
  {
    find: /(?:Do not|Don't) glob across `~\/\.cursor\/projects\/\*\/`/g,
    replace: "Do not export or read other projects' sessions",
    count: 2,
    why: "the cross-project hazard is the transcripts tool's `scope: \"all\"`",
  },

  // ── Questions and todos ───────────────────────────────────────────────────────────────────────────
  {
    find: "About to `AskQuestion` on a",
    replace: "About to use the `question` tool on a",
    why: "tool rename; the bare-name rule below would drop the verb",
  },
  {
    find: /`AskQuestion` tool/g,
    replace: "`question` tool",
    why: "tool rename",
  },
  {
    find: /`AskQuestion`/g,
    replace: "the `question` tool",
    why: "tool rename",
  },
  {
    find: "Open a todolist whose first items are the matched playbook's steps",
    replace: "Open a todo list with the `todo` tool whose first items are the matched playbook's steps",
    why: "OpenCode V2 has no built-in todo tool; the plugin adds one",
  },
  {
    find: /\btodolist\b/g,
    replace: "todo list",
    count: 4,
    why: "the plugin's `todo` tool holds the list",
  },

  // ── /loop → the plugin's /loop command and loop tool ──────────────────────────────────────────────
  {
    find: "Pick the wake mechanism using Cursor's `/loop` command (a built-in, not a pstack skill).",
    replace: "Pick the wake mechanism using `/loop` (the pstack plugin's command, also callable as the `loop` tool).",
    why: "the plugin provides /loop in OpenCode",
  },
  {
    find: /Cursor's `\/loop` command/g,
    replace: "the `/loop` command",
    why: "the plugin provides /loop in OpenCode",
  },

  // ── Skill authoring: Cursor's built-in create-skill → bundled create-skill ────────────────────────
  {
    find: /the \*\*create-skill\*\* skill \(Cursor's built-in for authoring SKILL\.md files\)/g,
    replace: "the **create-skill** skill (bundled with pstack for OpenCode)",
    count: 2,
    why: "the port ships an OpenCode-native create-skill",
  },
  {
    find: /Cursor's built-in `create-skill`(?: skill)?/g,
    replace: "the `create-skill` skill",
    count: 3,
    why: "the port ships an OpenCode-native create-skill",
  },

  // ── cursor-team-kit skills are bundled ────────────────────────────────────────────────────────────
  {
    find: "the `deslop` skill from the `cursor-team-kit` plugin (`/deslop`)",
    replace: "the `deslop` skill (`/deslop`)",
    count: 2,
    why: "the port bundles deslop",
  },
  {
    find: "`cursor-team-kit` publishes `control-cli` (CLIs and TUIs) and `control-ui` (browser / Electron / web UIs).",
    replace: "pstack bundles `control-cli` (CLIs and TUIs) and `control-ui` (browser / Electron / web UIs).",
    why: "the port bundles the control skills",
  },
  {
    find: / (?:\(from `cursor-team-kit`\)|from `cursor-team-kit`)/g,
    replace: "",
    count: 4,
    why: "the port bundles these skills. A bare `from` never takes a parenthesis, which can close an outer `(such as ...`",
  },

  // ── Paths ─────────────────────────────────────────────────────────────────────────────────────────
  {
    find: "Never edit a skill under `plugins/cache/`.",
    replace: "Never edit a skill under the pstack plugin's `dist/skills/`.",
    why: "OpenCode installs the plugin's skills from its own package, not Cursor's plugin cache",
  },
  {
    find: /~\/\.cursor\/skills\//g,
    replace: "~/.config/opencode/skills/",
    why: "OpenCode's global skill directory",
  },
  {
    find: /\.cursor\/skills\//g,
    replace: ".opencode/skills/",
    why: "OpenCode's project skill directory",
  },

  // ── Cursor product features with OpenCode equivalents ─────────────────────────────────────────────
  {
    find: ", not Cursor's built-in babysit skill, whose description matches the same words.",
    replace: ".",
    why: "OpenCode has no competing babysit skill",
  },
  {
    find: "This playbook replaces Cursor's built-in babysit skill for these requests, so do not route there even though its description matches the same words. ",
    replace: "",
    why: "OpenCode has no competing babysit skill",
  },
  {
    find: "on an explicit pause, going offline, a Cursor restart, or imminent context compaction.",
    replace: "on an explicit pause, going offline, an OpenCode restart, or imminent context compaction.",
    why: "product rename",
  },
  {
    find: "Before spawning investigators, list the available MCPs from the Cursor environment. Use the available-tools map when present. Otherwise inspect the `mcps/` directory Cursor exposes for enabled MCP servers.",
    replace: "Before spawning investigators, list the available MCP servers in this OpenCode session. Use the tool list and Code Mode catalog in the system prompt, where MCP tools appear under their server's name. Otherwise run `opencode mcp list`.",
    why: "OpenCode exposes MCP tools in the tool list and through `opencode mcp list`",
  },
  {
    find: "since a hand-typed `myrepo-worktrees/x` misses one that lives at `.cursor/worktrees/myrepo/x`",
    replace: "since a hand-typed `myrepo-worktrees/x` misses one OpenCode created under its configured `worktree.directory`",
    why: "OpenCode manages worktrees in its own directory",
  },
  {
    find: "`~/Library/Application Support/Cursor` (`state.vscdb.backup`, and `snapshots/roots/<root>` where a `<root>` named for a folder you opened as a workspace balloons),",
    replace: "`~/.local/share/opencode/tool-output` (full outputs of large tool results),",
    why: "OpenCode's large local cache",
  },

  // ── poteto-help: install, modes, and what ships where ─────────────────────────────────────────────
  {
    find: "1. Install with `/add-plugin pstack` in chat, or from Customize in the sidebar.",
    replace: "1. Install with `opencode plugin add github:kakadiadarpan/pstack-opencode` in a terminal, then start a new session.",
    why: "OpenCode installs plugins from the CLI",
  },
  {
    find: "maps a model to each role, and writes a rule. The rule applies to new chats.",
    replace: "maps a model to each role, and writes the pstack model sheet. The plugin reads the sheet on every request, so it applies at once.",
    why: "the plugin re-reads the sheet on every request",
  },
  {
    find: "| A new model choice had no effect | The rule from `/setup-pstack` applies to new chats. Start one. |",
    replace: "| A new model choice had no effect | A line in the project's `.opencode/pstack/models.md` wins over the same role in `~/.config/opencode/pstack/models.md`. The pstack model sheet in the system prompt names the files it read and each role's resolved model. |",
    why: "the sheet applies at once, so a stale choice means a project line overrides it",
  },
  {
    find: "| Build a page whose buttons wake a Grok Bot over a webhook | [`/make-bot-ui`](../make-bot-ui/SKILL.md) |\n",
    replace: "",
    why: "make-bot-ui is dropped",
  },
  {
    find: "The [README](../../README.md) and",
    replace: "The [README](../../../README.md) and",
    why: "the port ships its own README at the package root, not upstream's beside dist/",
  },
  {
    find: "and mention once that a Custom Mode keeps it on.",
    replace: "and mention once that the Poteto agent (`Tab` cycles agents) keeps it on.",
    why: "OpenCode's always-on mode is a primary agent",
  },
  {
    find: "`https://github.com/cursor/plugins/blob/main/pstack/` followed by its path.",
    replace: "`https://github.com/kakadiadarpan/pstack-opencode/blob/main/dist/` followed by its path.",
    why: "the port's public copy lives in this repository under dist/",
  },
  {
    find: "pstack is built for Cursor, and it also installs in Claude Code with `/plugin marketplace add cursor/plugins`, then `/plugin install pstack@cursor-plugins`. There, each command takes a `pstack:` prefix, such as `/pstack:poteto-mode`. The [Claude Code adapter](../../docs/harness/claude-code.md) maps the Cursor names, and a step that needs a Cursor-only feature, such as Bugbot or Automations, is skipped with a one-line note.\n\nOther tools can read the skills, because they use the Agent Skills format. But most workflow skills, including `/poteto-mode`, `/how`, `/why`, and `/teach`, spawn Cursor subagents with per-role models, and Custom Modes and `/loop` are Cursor features, so those parts may not work there.",
    replace: "This is pstack's OpenCode port. Its plugin supplies what the workflow skills need from the host: the `poteto-agent` and `comment-sicko` subagents, the Poteto agent for an always-on mode, the `todo`, `loop`, and `transcripts` tools, the `/loop` command, a slash command per skill, and the model sheet that `/setup-pstack` writes.",
    why: "the port supplies the host features upstream gets from Cursor, and it does not ship the Claude Code adapter",
  },
  {
    find: /Whether `\/poteto-mode` stays on depends on how the user starts it:[\s\S]*?when this comes up\./g,
    replace: "Whether poteto mode stays on depends on how the user starts it:\n\n- `/poteto-mode`, or `@poteto-mode` in a message, loads the skill for one task. It fades as the session moves on.\n- Switching to the **Poteto** agent (`Tab` cycles agents, or `\"default_agent\": \"poteto\"` in `opencode.jsonc`) keeps it in context every turn, and it stays out of casual turns.\n\nLink [OpenCode's agents docs](https://opencode.ai/v2/docs/agents/) when this comes up.",
    why: "OpenCode's always-on mode is a primary agent, not a Cursor Custom Mode",
  },
  {
    find: "- `/deslop`, `control-cli`, and `control-ui` ship in the `cursor-team-kit` plugin.\n- `/loop` and `/create-skill` are Cursor built-ins.\n",
    replace: "- Upstream ships `/deslop`, `control-cli`, `control-ui`, `create-skill`, and `/loop` outside pstack. This port bundles all five.\n",
    why: "the port bundles them",
  },
  {
    find: "Without `/poteto-mode`, a phrase such as \"babysit this pr\" can start Cursor's own skill for the same job instead. ",
    replace: "",
    why: "OpenCode has no competing babysit skill",
  },
  {
    find: "Cursor's Plan Mode works alongside it.",
    replace: "OpenCode's Plan agent works alongside it.",
    why: "OpenCode's planning surface is the plan agent",
  },
  {
    find: "It was started with Enter. Start it as a Custom Mode, or start each task with `/poteto-mode`.",
    replace: "It was loaded for one task. Switch to the Poteto agent, or start each task with `/poteto-mode`.",
    why: "OpenCode's always-on mode is a primary agent",
  },

  // ── Guide pages ───────────────────────────────────────────────────────────────────────────────────
  {
    find: "and a Custom Mode keeps `/poteto-mode` in context on every turn.",
    replace: "and the Poteto agent keeps poteto mode in context on every turn.",
    why: "OpenCode's always-on mode is a primary agent",
  },
  {
    find: "The cleanest isolation is a [cloud subagent](https://cursor.com/docs/subagents#cloud-subagents). Each one gets its own VM and branch, so it can install dependencies, run your app, and record video of the result without touching your machine. Type `/in-cloud` before the task, or ask the parent chat to hand work to cloud subagents.",
    replace: "The cleanest isolation is a git worktree per agent. OpenCode creates one with the `worktree_create` tool and can move a session into it, so each agent installs dependencies, runs your app, and records results without touching your main checkout. Ports and machine resources stay shared, so a laptop runs only a handful at once.",
    why: "OpenCode has no cloud subagents",
  },
  {
    find: "`/deslop` ships in the `cursor-team-kit` plugin, not in pstack. If you don't have it, ask for the same outcome in plain words: remove narrating comments, unsupported guards, dead compatibility paths, and unrelated edits.",
    replace: "This port bundles `/deslop`.",
    why: "the port bundles deslop",
  },
  {
    find: "**Treating `auto` as a model slug.**",
    replace: "**Treating `auto` as a model ref.**",
    why: "OpenCode names models by `provider/model#variant` refs, not slugs",
  },
  {
    find: "- `/loop` is Cursor's built-in wake mechanism, not a pstack skill.",
    replace: "- `/loop` is the wake mechanism the pstack plugin adds to OpenCode. The agent can also arm it itself through the `loop` tool.",
    why: "the plugin provides /loop",
  },
  {
    find: "or that you're about to go offline or restart Cursor.",
    replace: "or that you're about to go offline or restart OpenCode.",
    why: "product rename",
  },
  {
    find: "A [Cursor Project](https://cursor.com/blog/projects) gives one coordinator agent a persistent thread. The coordinator doesn't write code. It directs subagents, which run in the cloud by default, so the work continues when your laptop is closed.",
    replace: "One long-lived OpenCode session can coordinate a body of work. The coordinator doesn't write code. It directs subagents, each in its own git worktree. They run on your machine, so keep it awake and on power for overnight runs.",
    why: "OpenCode has no Projects or cloud subagents",
  },
  {
    find: "- Give each body of work its own Project,",
    replace: "- Give each body of work its own coordinator session,",
    why: "OpenCode has no Projects",
  },
  {
    find: "- Drag related chats into the Project, finished ones included. They become context for every agent in it.",
    replace: "- Point the coordinator at related sessions, finished ones included. It reads them through the `transcripts` tool and folds them into its briefs.",
    why: "OpenCode has no Projects",
  },
  {
    find: "One prompt can carry a whole Project,",
    replace: "One prompt can carry a whole program,",
    why: "OpenCode has no Projects",
  },
  {
    find: "and Projects and automations that scale past one agent.",
    replace: "and coordinator sessions and automations that scale past one agent.",
    why: "OpenCode has no Projects",
  },
  {
    find: /## Build a bot UI with `\/make-bot-ui`\n\n[^\n]*\n\n/g,
    replace: "",
    why: "make-bot-ui is dropped",
  },

  // ── ketchup: Cursor's built-in /visualize → Mermaid ───────────────────────────────────────────────
  {
    find: "a Mermaid diagram, a chart or diagram from `/visualize`, or a generated image.",
    replace: "a Mermaid diagram or chart, or a generated image.",
    why: "`/visualize` is a Cursor built-in with no OpenCode equivalent",
  },
  {
    find: "a Mermaid diagram for how things connect and a `/visualize` chart for numbers.",
    replace: "a Mermaid diagram for how things connect and a Mermaid chart, such as `xychart-beta`, for numbers.",
    why: "`/visualize` is a Cursor built-in with no OpenCode equivalent",
  },

  // ── Benny automation pack: Cursor Automations → your own trigger running `opencode run` ──────────
  {
    find: /\.cursor\/automations\/benny\//g,
    replace: ".opencode/automations/benny/",
    files: /^automations\//,
    count: 10,
    why: "the pack lives under the project's .opencode directory",
  },
  {
    find: /\.cursor\/benny\//g,
    replace: ".opencode/benny/",
    files: /^automations\//,
    count: 4,
    why: "user-owned configuration sits beside the pack",
  },
  {
    find: "prefer_cursor_actions: true",
    replace: "prefer_mcp_actions: true",
    files: /^automations\/benny\/templates\/configuration\.example\.yaml$/,
    why: "OpenCode reaches Slack through an MCP server",
  },
  {
    find: /Prefer configured Cursor Slack actions/g,
    replace: "Prefer the configured Slack MCP tools",
    files: /^automations\//,
    count: 2,
    why: "OpenCode reaches Slack through an MCP server",
  },
  {
    find: /Paraphrase this intent into a built-in `automate` draft after `automate` confirms that the copied pack is committed in the repository where the automation will run\./g,
    replace: "Paraphrase this intent into the prompt your trigger passes to `opencode run`, after confirming that the copied pack is committed in the repository the run checks out.",
    files: /^automations\//,
    count: 2,
    why: "OpenCode has no hosted automations; the user's trigger runs `opencode run`",
  },
  {
    find: "The human enters setup by pointing Cursor at the pack's `FOR_AGENTS.md`.",
    replace: "The human enters setup by pointing OpenCode at the pack's `FOR_AGENTS.md`.",
    files: /^automations\//,
    why: "product rename",
  },
  {
    find: "Benny needs external configuration and two live Cursor automations.",
    replace: "Benny needs external configuration and two triggers the user hosts, each running `opencode run` against the target repository. OpenCode has no hosted automations product.",
    files: /^automations\//,
    why: "OpenCode has no hosted automations",
  },
  {
    find: "Do this before asking for Benny configuration and before invoking the built-in `/automate` skill.",
    replace: "Do this before asking for Benny configuration.",
    files: /^automations\//,
    why: "no /automate skill in OpenCode",
  },
  {
    find: /Add pstack to the target repository's `\.cursor\/settings\.json`\.[\s\S]*?Validate the file after editing it\./g,
    replace: "Add pstack to the target repository's `.opencode/opencode.jsonc`. If the file or `.opencode` directory does not exist, create it with `\"$schema\": \"https://opencode.ai/config.json\"`.\n\nMerge this entry into the existing JSON or JSONC:\n\n```jsonc\n{\n\t\"plugins\": [\"github:kakadiadarpan/pstack-opencode\"]\n}\n```\n\nPreserve every unrelated top-level setting and every other plugin entry. If a pstack entry already exists, leave it. Preserve comments and valid JSONC syntax. Validate the file after editing it.",
    files: /^automations\//,
    why: "OpenCode loads project plugins from opencode.jsonc",
  },
  {
    find: "Do not count a skill loaded from the current session or a user-scoped plugin. The check must show that a fresh agent in the target repository receives pstack through project settings.",
    replace: "Do not count a skill loaded from the current session or a user-scoped plugin. The check must show that a fresh `opencode run` in the target repository receives pstack through project configuration.",
    files: /^automations\//,
    why: "the triggered runs use opencode run",
  },
  {
    find: /`\.cursor\/settings\.json`/g,
    replace: "`.opencode/opencode.jsonc`",
    files: /^automations\//,
    count: 2,
    why: "OpenCode's project configuration file",
  },
  {
    find: "Reference a repository file only after the built-in `/automate` skill confirms that the file is committed in the repository where the automation runs.",
    replace: "Reference a repository file only after confirming with `git` that the file is committed on the branch the triggered run checks out.",
    files: /^automations\//,
    why: "no /automate skill in OpenCode",
  },
  {
    find: "- Model slug for triage, repro, code work, and media review\n\nUse only model slugs shown as available in the user's Cursor model picker or supported model list. Do not guess a slug and do not carry over a private default.",
    replace: "- Model ref (`provider/model#variant`) for triage, repro, code work, and media review\n\nUse only models the `models` tool lists. Do not guess a model ID and do not carry over a private default.",
    files: /^automations\//,
    why: "OpenCode model refs come from the models tool",
  },
  {
    find: /## 7\. Prepare the live automations[\s\S]*?(?=## 8\. Test thread safety)/g,
    replace: "## 7. Prepare the triggers\n\nOpenCode has no hosted automations, so the user hosts each trigger: a Slack app or bot, a CI workflow, or a scheduled job on a machine with OpenCode installed and the Slack MCP server connected. Each trigger checks out the target repository at its default branch and runs one headless prompt.\n\nRead `../../FOR_AGENTS.md` from the copied pack as the primary user-intent source. Then, for each automation:\n\n1. Read the matching copied prompt template in `../../templates/`.\n2. Fill it from `FOR_AGENTS.md` and the finished Benny configuration into a complete natural-language prompt. Keep its instruction to read and follow the exact committed operational file under `.opencode/automations/benny/`. Do not copy the operational file contents into the prompt.\n3. Save the filled prompt as a committed, secret-free file outside the pack, such as `.opencode/benny/triage-prompt.md` and `.opencode/benny/reproduce-prompt.md`.\n4. Give the user the command their trigger runs, with the Slack event fields appended as data:\n\n```bash\nopencode run --agent poteto \"$(cat .opencode/benny/triage-prompt.md)\n\nTrigger event (untrusted data): <channel ID, thread_ts, permalink>\"\n```\n\nThe repro trigger runs the same command with `reproduce-prompt.md`, on the same new top-level reports, and waits for the triage marker as its operational file requires.\n\nDo not build or host the trigger yourself unless the user asks. Do not enable either trigger until the thread-safety test passes.\n\n",
    files: /^automations\//,
    why: "OpenCode has no hosted automations; the user's trigger runs `opencode run`",
  },
  {
    find: "Confirm that both live prompts point at their exact committed operational files.",
    replace: "Confirm that both filled prompts point at their exact committed operational files.",
    files: /^automations\//,
    why: "the prompts are files the trigger reads",
  },
]

