---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects your available models and writes the pstack model sheet that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.config/opencode/pstack/models.md`, the pstack model sheet. The pstack plugin injects it into every request, so every skill and subagent sees the same role-to-model mapping. A project can override single lines in `.opencode/pstack/models.md`.

## Steps

### 1. Detect available models

Call the `models` tool. Search with `query` for the families you need (for example `opus`, `sonnet`, `gpt`, `grok`, `gemini`) and pass `all: true` when you need an older version. Each result has an `id` and a `variants` list. A sheet value is `<provider>/<model id>#<variant>`, the same ref the `subagent` tool's `model` field takes. For example, provider `vercel` and model `anthropic/claude-opus-5.5` with variant `xhigh` is `vercel/anthropic/claude-opus-5.5#xhigh`. Never write a ref the `models` tool did not list, or a variant that model does not have. The aliases `inherit-parent` and `auto` are always valid.

### 2. Load current state

If `~/.config/opencode/pstack/models.md` exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the default shape in step 5. A line whose role is not in step 5, such as `how critics`, is from a retired role. Drop it.

### 3. Pick the two defaults

Every role defaults to one of two aliases. `code-default` runs code delegates, explorers, investigators, and swarm workers. `judgment-default` runs prose, judgment, synthesis, and the hardest changes. Upstream pstack uses a Grok model for code and Claude Opus for judgment, so prefer those families when the `models` tool lists them. Otherwise choose the strongest available coding model for `code-default` and the strongest available reasoning model from a different vendor for `judgment-default`, so the two-model panels stay diverse. When only one usable model exists, use it for both and say the panels lose model diversity.

### 4. Budget, map, and confirm

**(a) Ask for a budget.** Use the `question` tool. Offer these four options with these exact labels, and name the current budget when the sheet records one. With no sheet, say that `large` matches the upstream defaults.

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** `unlimited`, `large`, `medium`, and `small` set the variant of every real ref, panel entries included, to `max`, `xhigh`, `high`, or `medium`, on the ladder `max` > `xhigh` > `high` > `medium` > `low`. When a model lacks the target variant, use its highest variant at or below the target. When it has no variants at all, drop the `#variant` suffix. `inherit-parent` and `auto` do not change. On a re-run, keep any role the user changed by family, list, or alias.

**(c) Show the roles and confirm.** Show every role with its model. Also list each line step 2 dropped. Use the `question` tool to ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` and `auto` (both mean: this role runs on the parent session's model). For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena runs one judge. It tries only values from a family other than the parent's, in list order, so order it by preference. An `inherit-parent` or `auto` value never judges. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 5. Write the sheet

Overwrite `~/.config/opencode/pstack/models.md` so re-runs stay idempotent. Resolve `code-default` and `judgment-default` to real refs on their own lines, and write every other role either as one of those aliases or as a real ref. Shape:

```
# pstack model sheet. One line per role. Delete a line to fall back to its default.
# `inherit-parent` or `auto`: the role runs on the parent session's model (omit the subagent `model`).
# budget: large (xhigh)
code-default: vercel/spacexai/grok-4.7#xhigh
judgment-default: vercel/anthropic/claude-opus-5.5#xhigh
feature, refactoring: code-default
bug-fix: code-default
perf-issue: code-default
hillclimb: code-default
judgment and prose: judgment-default
hardest tasks: judgment-default
how explorer: code-default
how explainer: judgment-default
why investigators: code-default
why synthesizer: judgment-default
reflect tooling: code-default
reflect judgment, divergent, synthesizer: judgment-default
arena runners: judgment-default, code-default
arena cross-judge pool: judgment-default, code-default
swarm workers: code-default
architect runners: judgment-default, code-default
interrogate reviewers: judgment-default, code-default
```

The two refs above are examples. Write the ones step 3 chose.

### 6. Allow nested subagents

pstack's workflow skills spawn subagents from inside subagents, and the Orchestrate playbook nests to depth 3. OpenCode allows depth 1 unless configured. Read `~/.config/opencode/opencode.jsonc` (or `opencode.json`). If `experimental.subagent_depth` is missing or below 3, set it to 3 with an edit that keeps every other setting and comment. Tell the user you changed it.

### 7. Confirm

Tell the user the sheet was written and that the plugin reads it on the next request, with no restart. Re-running this skill updates it.

### 8. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill`. On no, move on without pushing.

### 9. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill." On yes, invoke `/create-formal-verification-skill`. On no, move on without pushing.
