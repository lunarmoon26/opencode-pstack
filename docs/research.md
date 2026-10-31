# Port decisions

Inspected on 2026-10-31. This is an implementation record, not a claim that any
community port is production-proven.

## Local baseline

Our `opencode-notion/plugin/notion.ts:1-43` and
`opencode-cloudflare/plugin/cloudflare-mcporter.ts` use native V2
`Plugin.define`, instance-local runtime state, a small native tool surface,
and permission assertions at mutation boundaries. Their package and test
conventions use Bun and TypeScript. Blender has a V2 wrapper over older tools;
Sketch and Xcode show the older bridge layout. No files in these projects were
changed by this work.

Pstack is a workflow pack rather than a third-party service bridge. It needs
native skills, agents, and commands, not MCPorter or credentials. We reuse the
packaging style, not the unnecessary transport.

## Primary implementation sources

| Source | Evidence | Decision |
| --- | --- | --- |
| `cursor/plugins@c742dd61706fbacc1b95f1a20b7b988cf096ce6c` | `pstack/skills/poteto-mode/SKILL.md`, `pstack/agents/`, the bundled playbooks and helper scripts | Preserve the workflow content and supporting resources, with explicit host adaptations. Pstack 0.15.36 is pinned, not fetched on startup. |
| `kakadiadarpan/pstack-opencode@35f8dfc8da3f0c3f075653d4124ef46e808b14b8` | `scripts/build.ts:20-33,65-77,124-157`, `port/rules.ts`, `src/index.ts:34-98` | Reuse its MIT translation rules and fail-on-drift builder. Adapt its architecture to a single host tool, explicit options, collision preservation, and gated effects. Retain the license. |
| Same source | `src/loop.ts:6,23-33,73-75,98-111` | Do not copy its module-global timers, unconditional restoration, unbounded repetition, or ungated scheduling. Our timers are per instance, bounded, disabled by default, cancelled on unload, and permission-checked before scheduling and dispatch. |
| Same source | `src/transcripts.ts:14-18,71-95` | Do not copy subprocess API discovery or cross-project export. Use the typed session APIs, current-session defaults, exact-directory checks, private files, bounded coverage, and native permission checks. |
| `falentio/opencode-pstack@14fc4a66fc5f0265fb4068b16dee8045abdeac89` | `src/index.ts:32-85`, `scripts/smoke.mjs:27-35,115-144` | Learn from native registration, compaction awareness, and model-free checks. Do not copy the ambient-HOME/shared-service smoke setup or treat skipped probes as passes. |

## Host contract versus port claims

OpenCode's V2 [agents documentation](https://opencode.ai/v2/docs/agents) says a
subagent uses its configured model, otherwise the parent's. Therefore a port
does not need to discard model diversity: named role agents can carry explicit
model preferences. Our default is inheritance; two same-model agents are not
reported as diverse. We validate available models and variants rather than
translating remembered Cursor model names into guessed provider IDs.

The V2 [skills documentation](https://opencode.ai/v2/docs/skills) identifies
skills by path and treats frontmatter names as labels. The old claim that a
capitalized `name` prevents V2 loading is not used as a compatibility premise.

We initially matched the sibling plugins' SDK pin, 2.0.31. Typechecking showed
that its plugin session context did not expose `session.list`. The installed
OpenCode is 2.1.4, so this project pins **@opencode/plugin 2.1.4** instead.
That version also represents model variants as an array of IDs, not the older
record shape. We follow the actual installed SDK contract.

The isolated real-host probe also showed that 2.1.4 rejects direct `.ts` paths
in `plugins` with `configured plugin path must be a directory`. This port
therefore registers the package directory and ships a root `index.ts` re-export
in addition to `package.json` exports. We did not change the sibling projects'
older install instructions as part of this task.

## What stays local

- `plugin/` is our runtime, not a re-export of another port's plugin.
- `adapt/` owns the setup workflow, host contract, tool vocabulary, and explicit
  operator authority. The original permissive autonomy wording is subordinate
  to the host contract, never an authorization grant.
- `scripts/sync.ts` now imports selected Git blobs directly from an exact Cursor
  commit, preserving executable modes and rejecting symlinks. It does not depend
  on another port publishing a new generated tree. The initial translator stays
  pinned; local rule drift is reconciled in `adapt/translations.ts`. Both the
  community and our own whole-file overrides have source-blob drift checks.
- `models` options are the source of truth. No background model-sheet edits,
  depth-limit changes, or default-agent changes.
- Existing IDs win. Skills are not automatically advertised; commands, explicit
  mentions, or selecting the Poteto agent activate the integration. Routing is
  an explicit optional hint, not a mandatory global instruction.
- The comment reviewer has an enforced read-only tool allowlist. We do not
  grant it blanket read permissions that could override user denials.

## Verification boundaries

Offline tests cover registration, collision handling, activation, model
validation, session checklists, permission rejection, timer cancellation and
expiry, transcript privacy and scope, source pins, links, and translated helper
scripts. The smoke test uses a private real OpenCode server, isolated HOME and
XDG directories, no user credentials, and no model calls.

These checks establish runtime mechanics, not the quality of all engineering
playbooks on every model. Worktrees share the local machine. Session-context
exports are not full archival transcripts. Scheduled prompts can still spend
tokens inside each admitted turn, so maxRuns is not a monetary budget.
