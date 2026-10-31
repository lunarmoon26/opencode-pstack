import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

export const blobID = (bytes: Uint8Array) => new Bun.CryptoHasher("sha1")
  .update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex")

export async function files(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not bundle inputs: ${path}`)
    if (entry.isDirectory()) out.push(...await files(path))
    else out.push(path)
  }
  return out
}

export async function applyLocal(dist: string) {
  const overlays = join(import.meta.dir)
  const pins: Record<string, string> = await Bun.file(join(overlays, "overrides.lock.json")).json()
  const upstream = await Bun.file(join(overlays, "../upstream.json")).json()
  for (const [path, expected] of Object.entries(pins)) {
    const input = join(overlays, "../vendor/pstack", path)
    const actual = blobID(await Bun.file(input).bytes())
    if (expected !== actual) throw new Error(`Upstream changed a local override: ${path}. Review the upstream diff against adapt/${path}, then update adapt/overrides.lock.json to ${actual}.`)
  }
  for (const file of await files(overlays)) {
    if (file.endsWith(".ts") || file.endsWith(".lock.json")) continue
    const target = join(dist, relative(overlays, file))
    await mkdir(dirname(target), { recursive: true })
    await cp(file, target)
  }
  // These are generated build outputs, never source or user directories.
  await rm(join(dist, "automations"), { recursive: true, force: true })
  for (const file of await files(dist)) {
    if (!file.endsWith(".md") || file.includes("/licenses/")) continue
    let text = await Bun.file(file).text()
    text = text
      .replaceAll("the `todo` tool", "the `pstack` tool with `action: \"todos\"`")
      .replaceAll("the `transcripts` tool", "the `pstack` tool with `action: \"transcripts\"`")
      .replaceAll("the `loop` tool", "the `pstack` tool with `action: \"loop\"`")
      .replace(/\/loop\b/g, "/pstack-loop")
      .replaceAll("the `models` tool", "the `pstack` tool with `action: \"models\"`")
      .replaceAll('`scope: "all"`', '`scope: "project"`')
      .replaceAll("Pass `scope: \"project\"` only when the user asks for other projects.", "Cross-project export is unavailable.")
      .replaceAll("`~/.config/opencode/pstack/models.md`", "the plugin's `models` options")
      .replaceAll("`.opencode/pstack/models.md`", "project plugin options")
      .replaceAll("`opencode plugin add github:kakadiadarpan/pstack-opencode`", "the local installation instructions in this package's README")
      .replaceAll("https://github.com/kakadiadarpan/pstack-opencode/blob/main/dist/", `https://github.com/cursor/plugins/blob/${upstream.sha}/pstack/`)
      .replaceAll("which `/setup-pstack` sets.", "which the operator must explicitly approve and configure; `/setup-pstack` never changes it automatically.")
      .replaceAll("It exports this project's OpenCode sessions as JSONL into a transcripts directory", "By default it exports only the current session as JSONL into a private transcripts directory")
      .replaceAll("which exports this project's sessions and returns the directory", "which defaults to exporting this session and returns the private directory")
      .replaceAll("It covers the active project by default.", "It covers the current session by default; request scope project explicitly for bounded exact-directory history.")
      .replaceAll("with subagent sessions under `<session ID>/subagents/`.", "with each selected session exported independently; child sessions are not recursively collected.")
      .replaceAll("File modification times match each session's last update.", "This is a fresh bounded export, not a full archive; do not infer session recency from export file timestamps.")
      .replace(/pstack ships this as a dormant \[automation pack\][\s\S]*?(?=\n\n|$)/g, "Hosted automations and the Benny pack are not included in this OpenCode port.")
      .replace(/\*\*Defaults for every `subagent` call\.\*\*[^\n]+/, "**Defaults for every `subagent` call.** Use `background: true` for independent work, an explicit scoped brief, and the host's actual tool schema. Use `poteto-agent` for ordinary delegates, or the configured named `pstack-code` and `pstack-judgment` role agents. Read-only helpers use `explore`. Review delegated work yourself. The injected model-role table replaces upstream model defaults. Do not infer authorization to change providers, reasoning variants, speed tiers, permissions, or nesting limits from a workflow.")
      .replace(/\*\*Match the model to the job\.\*\*[^\n]+/, "**Match the model to the job.** Use only explicit operator preferences from plugin options or effective named-agent definitions. With no configured role, inherit the session model. Keep configured models and variants unchanged. Do not invent a replacement or increase the cost when a model fails; report the failure and continue only on an authorized fallback. Two agents using the same model are independent passes, not model diversity.")
    if (file.endsWith("/SKILL.md")) {
      const host = "\n> OpenCode port: read `../../HOST.md` relative to this skill's directory before host-specific work.\n> Operator instructions, native permissions, and the injected pstack host contract\n> override upstream autonomy, model, transcript, and scheduling defaults.\n"
      text = text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1${host}`)
    }
    await Bun.write(file, text)
  }
}
