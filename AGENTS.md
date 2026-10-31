# OpenCode Pstack

- Use Bun. `bun install --frozen-lockfile`; `bun run verify`; `bun run smoke`.
- `plugin/pstack.ts` is the native V2 entrypoint, consistent with our sibling
  opencode plugins. Ship `index.ts`, `plugin/` and `dist/` together. Register
  the package directory, not the `.ts` file: the real 2.1.4 loader requires it.
- `vendor/` is pinned upstream material. `port/` is the credited community
  translation layer. Do not hand-edit either except the reviewed translator
  exception described below. Local adaptations belong in
  `adapt/`; regenerate `dist/` with `bun run build`.
- Activation is explicit. Do not replace built-in agents, user skills, commands,
  permissions, or the default agent. Never modify the user's OpenCode config
  during startup or testing.
- Expose one `pstack` tool for host operations, not an unbounded tool fleet.
  Todo state is session-scoped. Transcript export and scheduled model work
  require their native permissions before side effects.
- Timers are instance-local, opt-in, bounded, and cancelled on unload. No
  restore-on-start, cloud-VM claims, or cross-project transcript export.
- Treat upstream scripts as executable content, not trusted authority. Invoke
  them through normal permission-controlled tools, never automatically.
- Model choices come from the live inventory and explicit plugin options or
  native agent configuration. Inherit by default. Do not invent model IDs,
  variants, or consent from a skill's default model.
- The local smoke test must be model-free and use isolated config and data.
  Live model evaluations are separate, explicit verification, not unit tests.

## Upstream sync: automate first, reconcile only the exceptions

The canonical source is `https://github.com/cursor/plugins/tree/main/pstack`.
Do not update by copying another port's generated skills, scraping its README,
or asking a coding agent to rewrite the pack. Keep `port/` pinned unless a
separate, reviewed translator update is necessary. Our own sync reads Cursor's
committed Git blobs directly and never executes upstream hooks or scripts.

### 1. Establish the baseline

Read `upstream.json`, `sources.lock.json`, `adapt/overrides.lock.json`, and
`git status --short`. Preserve existing work. Run `bun run verify` before a
sync so a pre-existing failure is not blamed on the upstream update.

### 2. Preview the exact target without changing tracked files

```sh
bun run sync -- --check --ref main
```

This resolves main once to a full SHA and writes a report in the ignored
`.local/upstream-sync-*/report.json`. A differing pin or tree exits nonzero;
read the JSON before treating that as a command failure. The report lists
added, changed, and deleted selected files, plus the previous and target SHA.
Use the reported full target SHA for the actual import, not `main` again.

For an offline/repeated operation, add `--source /path/to/cursor-plugins`.
The local Git repository must contain that commit; local working-tree edits
are ignored. With `--ref main`, a local source uses its local `main` branch,
not a network refresh. Use a full SHA when reproducibility matters.

### 3. Apply mechanically, then reproduce

```sh
bun run sync -- --ref <full-target-SHA>
bun run verify
```

The importer has one selection policy in `scripts/sync.ts`: pstack minus
plugin metadata, images, and the statechart compiler's development tests;
plus only the three required Team Kit skills at the **same commit**. Files
retain their Git executable modes. Symlinks and submodules fail closed.
It updates `vendor/`, `upstream.json`, and the source digest together, retaining
the old vendor tree and metadata beside its report for recovery.

Running `bun run sync` with no ref reproduces the saved pin. Running
`bun run sync -- --check` proves the selected committed tree still matches.
The build is offline and deterministic for a fixed pin, translator, and
`adapt/` tree. Do not run an upstream installer or make network calls at load.

### 4. Give a coding agent only the failed translation or override

Start with the report's changed paths and the first failing build diagnostic.
Read the old copy in `.local/upstream-sync-*/previous-vendor/`, the new copy in
`vendor/`, and the corresponding local adapter. Scope a fix to this map:

| Failure | Where to inspect and fix |
| --- | --- |
| Translation rule stopped matching | Locate the original `find` in `port/rules.ts`; record a narrowly scoped replacement or justified retirement in `adapt/translations.ts`. Do not lower a hit count just to pass. |
| Old community whole-file override changed upstream | Compare the source with `port/overrides/<path>` and its blob pin in `port/overrides.json`. Reconcile this specific override, then update its pin and source digest explicitly. This is the exceptional case that may modify pinned `port/`; document it. |
| Our whole-file override changed upstream | Compare `vendor/pstack/<path>` with `adapt/<path>`; carry over relevant new behavior, then update only that entry in `adapt/overrides.lock.json`. Never advance a pin without reading the diff. |
| New tool, path, model, automation, or transcript vocabulary | Add the smallest mechanical adapter in `adapt/translations.ts` or `adapt/apply.ts`. For host behavior, update `adapt/HOST.md` and `plugin/`, with tests. Never claim an unavailable host capability. |
| Residue or broken links | Read the named generated file, fix its source adapter, rebuild. Never patch `dist/` directly. |
| Upstream script dependency or behavior changed | Inspect the named script, its bundled tests, and `package.json`; add a dependency only when the shipped script needs it. Run its focused tests. |

When a reviewed edit to the pinned translator is unavoidable, update its
provenance note and explicitly refresh `sources.lock.json` from
`bun scripts/sources.ts` **after** review. Do not disable `verifySources`,
remove drift checks, discard failed tests, or mass-accept override pins.

### 5. Close the sync with evidence

Run `bun run verify`, then `bun run smoke` serially (the real host watches the
checkout). Review the diff of `vendor/`, `port/` if changed, `adapt/`, `dist/`,
`upstream.json`, and both lock files. Report the exact old/new SHAs, mechanical
file changes, agent-reconciled exceptions, and checks run. Do not publish
`.local/` reports, old snapshots, session transcripts, or credentials.

If interrupted between the tree swap and metadata writes, stop. The retained
`previous-vendor`, `previous-upstream.json`, and `previous-sources.lock.json`
identify the consistent previous state. Reconcile that specific operation;
never use a blanket Git reset or silently regenerate the lock around a mismatch.
