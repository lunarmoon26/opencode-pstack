---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

> OpenCode port: read `../../HOST.md` relative to this skill's directory before host-specific work.
> Operator instructions, native permissions, and the injected pstack host contract
> override upstream autonomy, model, transcript, and scheduling defaults.

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, call the `pstack` tool with `action: "transcripts"`. By default it exports only the current session as JSONL into a private transcripts directory and returns that path and this session's ID. Do not export or read other projects' sessions. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
ls -t <transcripts>/*/*.jsonl <transcripts>/*/subagents/*.jsonl 2>/dev/null | head -10
```

That covers the session (`<id>/<id>.jsonl`) and subagent (`<parent>/subagents/<child>.jsonl`) layouts. This session's file is `<transcripts>/<session ID>/<session ID>.jsonl`. To confirm a candidate, read its first JSONL line and check that `message.content[0].text` contains the conversation's opening user prompt. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three `subagent` calls, `agent: "general"`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and the read-only `explore` agent has no MCP tools.

Each reviewer and the synthesizer name a role line in the pstack model sheet and a default. Set `model` to that line's value, or to the default if the rule or the line is missing. Leave `model` unset when the value is `auto` or `inherit-parent`. If the `subagent` tool rejects a model, use the default and say so. If it rejects the default, use the closest valid model of the same family that the `pstack` tool with `action: "models"` lists. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.

| Lens | Role line | Default `model` | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `judgment-default` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `code-default` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `judgment-default` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `subagent` response body.

## 3. Synthesize

One `subagent` call, `agent: "general"`, `model` from the `reflect judgment, divergent, synthesizer` line (default `judgment-default`). It spot-verifies citations through MCP, and the read-only `explore` agent has no MCP tools. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Never edit a skill under the pstack plugin's `dist/skills/`. Before approval, show its destination, `.opencode/skills/<skill>/` or `~/.config/opencode/skills/<skill>/`. After approval, copy the skill folder there and edit the copy. Never open a PR or push.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the `create-skill` skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `create-skill` and run its description-optimization loop.
- `new skill via create-skill: <kebab-name>`: hand creation to `create-skill`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
