# Set up the OpenCode port

Follow the package [README](../../../README.md) for local installation. The
entrypoint is `plugin/pstack.ts`; keep it with the full `plugin/` and `dist/`
directories. Nothing installs globally on its own.

Run `/setup-pstack` to inspect the plugin and choose models. Run
`/poteto-mode <goal and finish condition>` for a task, or select the Poteto
primary agent to keep its instructions active throughout the session.

Model choices live in the plugin's `models.code` and `models.judgment` options,
not a Markdown model sheet. No model, permission, nesting limit, automation,
or default agent is changed at startup. See [host differences](../../HOST.md).
