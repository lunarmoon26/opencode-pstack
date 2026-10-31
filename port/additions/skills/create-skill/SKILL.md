---
name: create-skill
description: Author or revise an OpenCode skill (SKILL.md) so agents discover it at the right time and follow it. Use for "create a skill", "write a SKILL.md", "turn this into a skill", tuning a skill's description so it triggers, or editing an existing skill substantially.
---

# Create skill

A skill is instructions an agent reads cold, mid-task, with no memory of why they exist. Write for that reader.

## 1. Place it

Pick the scope first.

- Project skill: `.opencode/skills/<id>/SKILL.md`. Commit it with the repo.
- Personal skill: `~/.config/opencode/skills/<id>/SKILL.md`.

The directory name is the skill ID. Use lowercase kebab case, 1 to 64 characters, matching `^[a-z0-9]+(-[a-z0-9]+)*$`. Check that no other source already defines the ID: a later source silently replaces an earlier one (project `.opencode/skills` beats `~/.config/opencode/skills`, which beats `.agents/skills` and `.claude/skills`). Editing an existing skill keeps its path and category.

## 2. Write the frontmatter

```markdown
---
name: <id>
description: <what it does>. Use for <the requests and situations that should load it>.
---
```

- `description` is the only text the model sees before loading the skill. A skill without one is never advertised. Name the trigger phrases a user actually types and the situations that should load it, not just the topic.
- Keep `description` one YAML scalar. Quote it, or use `description: >-` with indented continuation lines, when it contains a colon or wraps.
- Add `disable-model-invocation: true` only for a skill that must run when the user asks for it by name and never on the model's own initiative. The skill stays loadable by ID and by `@<id>`.

## 3. Write the body

- Open with the outcome in one or two sentences. Then numbered steps, each one bounded action with a check the agent can run.
- State rules as instructions, not background. Every sentence becomes something a future agent does, so cut any sentence that changes no behavior.
- Name exact commands, paths, tools, and output shapes. Paths are relative to the skill's directory.
- Move long reference material into `references/`, scripts into `scripts/`, and templates into `templates/` beside `SKILL.md`. The body says when to read each one. Supporting files are not loaded automatically.
- Point at other skills by ID (the **unslop** skill) instead of restating them.
- Apply the **unslop** skill to every line.

## 4. Test it

1. Start a fresh session and load it with `@<id>` plus a realistic task. Check that the agent follows every step without guessing.
2. Without naming the skill, give a prompt that should trigger it. If the model does not load it, sharpen `description` with the words that prompt used, and retry. Also give one near-miss prompt that should not trigger it.
3. Fix each gap in the skill, not in the prompt, and rerun.

## 5. Ship it

Validate the frontmatter parses, every relative link resolves, and the ID is unique. Ship a project skill through the repo's normal review path.
