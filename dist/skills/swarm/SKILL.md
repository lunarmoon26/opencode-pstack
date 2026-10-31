---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

> OpenCode port: read `../../HOST.md` relative to this skill's directory before host-specific work.
> Operator instructions, native permissions, and the injected pstack host contract
> override upstream autonomy, model, transcript, and scheduling defaults.

# Swarm

## Start

Open a todo list with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Pick the worker model from the `swarm workers` line in the pstack model sheet. If the sheet or that line is missing, use `code-default`. For `auto` or `inherit-parent`, omit `model` so the workers run on the parent model. If the `subagent` tool rejects a model, use the default and say so. If it rejects the default, use the closest valid model of the same family that the `pstack` tool with `action: "models"` lists. For a model race, name each arm's model up front. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message with `agent: "general"`, `background: true`, and the step 3 model, left unset for `auto` or `inherit-parent`. Give each worker that edits files, builds, or runs the app its own git worktree: create it with the `worktree_create` tool, put its absolute path in the brief, and tell the worker to set `workdir` on every shell call and use absolute paths. Read-only workers share the current checkout.

When a worker must start from a non-default pushed branch, name the branch in its brief and have it check the branch out in its worktree first.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with a result table, issue one-liners, gaps or dropouts, and the race rule when used.
