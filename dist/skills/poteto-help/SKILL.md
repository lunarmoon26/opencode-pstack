---
name: poteto-help
description: Explain pstack's skills, playbooks, setup, and OpenCode-specific limitations. Use for /poteto-help or help choosing a pstack workflow.
disable-model-invocation: true
---

> OpenCode port: read `../../HOST.md` relative to this skill's directory before host-specific work.
> Operator instructions, native permissions, and the injected pstack host contract
> override upstream autonomy, model, transcript, and scheduling defaults.

# Pstack help

Call `pstack` with `action: "status"` before diagnosing installation or models.
Read the package's `README.md` and `dist/HOST.md` for this port's actual host
contract. Do not describe another port's installer, paths, or capabilities.

Start real work with `/poteto-mode <goal and how to verify it>`. Selecting the
Poteto primary agent keeps the mode active across turns. It does not change
the session's selected model. `/setup-pstack` explains explicit model options.

Use `how` for code tracing, `why` for investigation, `architect` for design,
`arena` for competing implementations, `swarm` for parallel coverage,
`interrogate` for adversarial review, `tdd` for test-first changes,
`no-comments` for comment review, and `unslop` for prose cleanup. Load the
named skill before describing its details. Principles remain loadable by ID.

The playbooks live beside `poteto-mode/SKILL.md` in `playbooks/`. Match the
request there, then read the full playbook. Be honest about the limits:
scheduling is opt-in and bounded, transcripts default to the current session,
agents run locally, and hosted automations are not included. Skills do not
override the operator's instructions, permissions, or approval requirements.
