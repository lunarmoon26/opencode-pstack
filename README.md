# OpenCode Pstack

An unofficial OpenCode V2 port of [pstack](https://github.com/cursor/plugins/tree/main/pstack)
by Lauren Tan (poteto). Rigorous engineering skills, playbooks, principles,
and delegates, packaged in the same Bun/native-plugin style as our Blender,
Cloudflare, Notion, Sketch, and Xcode plugins.

The initial bundle contains **61 skills**, **24 principles**, **38 slash
commands**, and **5 agents**. It targets OpenCode **2.1.4**; older V2 SDKs
do not expose all session APIs used here.

## Local setup

```sh
git clone https://github.com/lunarmoon26/opencode-pstack.git
cd opencode-pstack
bun install --frozen-lockfile
bun run verify
bun run smoke
```

Merge this entry into your project's or user's `opencode.json(c)`, preserving
all existing settings. Replace the path with your checkout's absolute path.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["file:///absolute/path/to/opencode-pstack"]
}
```

Keep the entire `plugin/` and `dist/` directories together. The Vercel Skills
CLI alone does not install this runtime. Configuration reloads automatically;
use `/reload` to force it. Removing the plugin entry unloads the integration.
No installer changes your global configuration.
OpenCode 2.1.4 requires a plugin **directory**, not a direct `.ts` file path.

Start with `/setup-pstack`, then `/poteto-mode <goal and finish condition>`.
Select the **Poteto** primary agent for persistent instructions across turns.
The plugin does not change your default agent or selected session model.

## Options

The object form makes options explicit:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [{
    "package": "file:///absolute/path/to/opencode-pstack",
    "options": {
      "routing": false,
      "commands": true,
      "loops": false
    }
  }],
  "permissions": [
    { "action": "pstack.transcripts", "resource": "*", "effect": "ask" },
    { "action": "pstack.schedule", "resource": "*", "effect": "ask" }
  ]
}
```

- `routing` advertises poteto-mode for substantive tasks. Off by default.
- `commands` registers non-principle skills as slash commands. On by default.
- `loops` enables bounded scheduled wake-ups. Off by default. Scheduling also
  checks `pstack.schedule`. Schedules disappear on reload or server exit.
- `models.code` and `models.judgment` optionally pin exact available
  `provider/model#variant` references. Omit them to inherit the parent model.
  Run setup to choose from the live inventory; no model IDs are baked in.

Model roles are also exposed as `pstack-code` and `pstack-judgment` subagents.
Two roles on the same model provide independent passes, not model diversity.
Unknown options and unavailable model choices fail rather than being ignored.
No permissions or nesting limits are raised by the plugin.

## Runtime

One native `pstack` tool supports `status`, `models`, `todos`, `transcripts`,
and `loop`. See [the host contract](dist/HOST.md) for inputs and limitations.
Checklist state is scoped to the session. Transcript exports require
permission and stay in private data directories outside the repository.
Timers are bounded, instance-local, and cancelled on unload. They enqueue
future work; they do not steer an active user conversation.
Stopping a timer does not retract work already admitted to the session.

Existing skills, agents, commands, and tools win on ID conflicts. `status`
reports skipped registrations. No global routing mandate is injected by default.
Hosted automations, cloud VMs, Benny, and Grok Bot UI are not included.

## Sources and maintenance

This starts from pstack **0.15.36**, pinned in [upstream.json](upstream.json).
It reuses Darpan Kakadia's MIT-licensed translation rules and build machinery,
but supplies our own runtime, options, safety boundaries, and local overlays.
See [credits](THIRD_PARTY.md) and [design notes](docs/research.md).

`vendor/` is upstream source. `port/` is the pinned community translation
layer. `adapt/` owns our overrides. `bun run build` validates translation
matches and override pins, then generates `dist/`. Do not hand-edit `dist/`.
Dependencies and assets are local at runtime: no startup downloads, automatic
upstream pulls, telemetry, authentication changes, or upstream script execution.

To update directly from Cursor, preview `bun run sync -- --check --ref main`,
then import the reported exact SHA with `bun run sync -- --ref <SHA>`.
Without a ref, `bun run sync` reproduces the current pin. `--source <checkout>`
allows an offline import from committed Git objects. No upstream code executes.
The updater records changed files and retains the old snapshot under `.local/`.
Build checks identify translation or whole-file override drift for an agent to
reconcile; they never silently accept it. See the precise commands, failure-to-file
map, override review, and recovery procedure in [AGENTS.md](AGENTS.md).

Offline tests and model-free smoke checks do not establish that every playbook
achieves good results with every model. Model-based behavior evaluations and
hosted automation are outside the initial runtime verification scope.
