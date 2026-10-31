# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In a terminal, run:

```text
opencode plugin add github:kakadiadarpan/pstack-opencode
```

Start a new OpenCode session. The pstack skills, the `/poteto-mode` style slash commands, the `poteto-agent` and `comment-sicko` subagents, and the **Poteto** agent are now available.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) lists the models you have access to with the `models` tool, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.config/opencode/pstack/models.md`, the model sheet the plugin injects into every request. It also raises `experimental.subagent_depth` to 3 so pstack's subagents can spawn their own.

A model ref is `provider/model#variant`, such as `vercel/anthropic/claude-opus-5.5#xhigh`. The variant is the reasoning level. The defaults run at `xhigh`, the same as the `large` budget. `unlimited` lifts each model to its highest variant, up to `max`. `medium` and `small` lower the reasoning and spend fewer tokens.

You only override what you care about. Every role points at `code-default` or `judgment-default`, so changing those two lines moves every role at once. To restore a role's default, delete its line. A project can override single lines in `.opencode/pstack/models.md`.

Set a role to `inherit-parent` or `auto` and pstack omits the subagent `model` field, so the subagent inherits your session's model. Both values mean the same thing. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

Without a sheet, every role runs on your session's model.

## Accept the verification offers, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.opencode/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

The plugin reads the sheet on every request, so there is nothing to restart.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main session with cheaper, faster models in the code roles is a good split.
- Set a role to `auto` or `inherit-parent` so it runs on the session's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. To keep poteto mode on for the whole session, switch to the **Poteto** agent with `Tab`. It keeps the skill in context on every turn and stays out of casual turns. To make it your default, set `"default_agent": "poteto"` in `~/.config/opencode/opencode.jsonc`. `/poteto-mode` alone loads the skill for one task, and it fades as the session moves on.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
