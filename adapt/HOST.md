# OpenCode host contract

This port is opt-in. Operator instructions and OpenCode permissions take
precedence over all bundled workflows, including upstream autonomy language.
Reading a skill is not approval to publish, spend money, delete data, change
permissions, scan unrelated chats, or schedule future work.

## Tools and models

- Use OpenCode's actual `subagent`, `question`, `read`, `shell`, and worktree
  tools, including their advertised schemas. Never guess arguments or create
  fake Cursor tools. Background completion is delivered by the host.
- `pstack` is the only extra tool. `action: "todos"` reads the current
  session's checklist; supplying `todos` replaces it. `action: "models"`
  reads the available model inventory; `action: "status"` reports this port.
- The injected model-role table comes from plugin options and effective named
  agents. Without configured choices, inherit the parent model. Prefer
  `pstack-code` and `pstack-judgment` for role-based delegation. A configured
  role is an explicit operator preference, not permission to invent another
  model, reasoning level, fast tier, or provider. Retain `poteto-agent` for
  ordinary delegates and `comment-sicko` for comment review. Report when panel
  members inherit the same model rather than claiming model diversity.
- Keep `explore` for read-only work. Do not switch to a full-tool role agent
  just to select a model. Use an explicit configured per-call preference only
  if the host's subagent tool supports it; otherwise inherit and report it.
- Keep repo edits, external tools, and upstream scripts on their normal
  permission-controlled paths. Do not bypass another plugin with shell or HTTP.
- Multi-level delegation requires the operator's explicit OpenCode depth
  configuration. This plugin never changes that limit.

## Transcripts and state

Call `pstack` with `action: "transcripts"` to export the current session in
the compatibility JSONL layout. With `scope: "project"`, export at most 20
recent sessions from the current exact directory. All exports require
`pstack.transcripts` permission, may contain sensitive content, and live in
private plugin data outside the repository. No cross-project scope exists.
The result reports the actual path and coverage. It is not a complete archive
or a substitute for a session's compacted-away history. Never open OpenCode's
database directly or read unrelated projects to satisfy a workflow.

The current session's private pstack store path is injected when pstack is
active. Do not assume it is a Cursor Project, a globally shared program store,
or a license to mutate arbitrary external files. Pass explicit state paths in
worker briefs. User edits through normal tools still require normal permissions.

## Scheduled work

`/pstack-loop <prompt>` asks the agent to set a bounded schedule, not an
unlimited `/loop`. The `pstack` tool uses `action: "loop"`,
`operation: "schedule"`, a `prompt` with a finish condition, and `every` or
`after` (for example `"5m"`). It requires the `loops: true` plugin option and
`pstack.schedule` permission before scheduling. `maxRuns` defaults to 3 and
cannot exceed 10; the schedule expires after at most 24 hours. Delay must be
at least 30 seconds and less than 24 hours. Only one schedule per session is permitted.

`operation: "list"` and `operation: "stop"` inspect or stop this session's
schedule. Stop when its finish condition passes. Wake-ups are queued, not
steers. Failures stop the schedule. Schedules are instance-local and disappear
on reload, unload, or server exit; they are never restored automatically. A
bounded schedule is not a spending cap on the steps inside each model turn.
Stopping a timer cannot retract a prompt already admitted to the session or
cancel model work already running. After ambiguous admission failure, inspect
the session rather than retrying the schedule blindly.

There are no hosted automations, cloud VMs, or automatic PR subscriptions.
Keep the local service and machine running for requested background work.
Do not promise overnight completion after a shutdown or automatically create
Slack triggers. The upstream Benny pack and make-bot-ui are not shipped.
