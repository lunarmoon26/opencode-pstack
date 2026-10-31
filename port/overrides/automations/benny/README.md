# benny

benny gives you two headless OpenCode runs for slack issue reports. one triages each report. the other reproduces confirmed bugs and may prepare a small draft fix.

OpenCode has no hosted automations product, so you host the triggers: a slack app, a CI workflow, or a scheduled job that runs `opencode run` in a checkout of your repository with the slack MCP server connected. benny's files tell each run what to do. they are not registered as skills.

## set up

1. point OpenCode at [`FOR_AGENTS.md`](./FOR_AGENTS.md) and name the target repository.
2. let setup merge this whole directory into the target at `.opencode/automations/benny/`. it must preserve destination-only files and review conflicts instead of overwriting local edits.
3. let setup add pstack to the target repository's `.opencode/opencode.jsonc` for shared dependencies:

```jsonc
{
	"plugins": ["github:kakadiadarpan/pstack-opencode"]
}
```

4. keep user-owned configuration outside the copied pack, for example in `.opencode/benny/`. adapt [`configuration.example.yaml`](./templates/configuration.example.yaml) and [`feature-map.example.md`](./skills/reproduce-and-fix-issues/references/feature-map.example.md).
5. commit `.opencode/opencode.jsonc`, `.opencode/automations/benny/`, and any secret-free configuration before enabling either trigger.
