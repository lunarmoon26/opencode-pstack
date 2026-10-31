import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rename, writeFile, chmod, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { files } from "../adapt/apply.ts"
import { sourceHash, verifySources } from "./sources.ts"

const root = resolve(import.meta.dir, "..")
const remote = "https://github.com/cursor/plugins"
export const components = [
  { name: "pstack", exclude: [".cursor-plugin/", ".gitignore", "assets/", "docs/guide/images/", "skills/statechart/scripts/test/"] },
  { name: "cursor-team-kit", include: ["LICENSE", "skills/deslop/", "skills/control-cli/", "skills/control-ui/"] },
]
const matches = (path: string, pattern: string) => pattern.endsWith("/") ? path.startsWith(pattern) : path === pattern
export function selected(path: string) {
  const [name, ...parts] = path.split("/")
  const component = components.find((entry) => entry.name === name)
  const relative = parts.join("/")
  return !!component && !!relative && !/[\r\n\t\\]/.test(path) && !parts.some((part) => part === ".." || part === "." || !part)
    && (!component.include || component.include.some((pattern) => matches(relative, pattern)))
    && (!component.exclude || !component.exclude.some((pattern) => matches(relative, pattern)))
}
function git(repo: string, args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
}

// Read committed Git blobs, not the working tree, and never check out or execute
// fetched code. This avoids hooks, filters, symlinks and local uncommitted files.
export async function snapshot(repo: string, sha: string, destination: string) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Snapshot requires an exact 40-character commit SHA")
  const tree = git(repo, ["ls-tree", "-rz", sha, "--", ...components.map((entry) => entry.name)]).toString("utf8")
  let count = 0
  for (const record of tree.split("\0").filter(Boolean)) {
    const [metadata, path] = record.split("\t")
    if (!path || !selected(path)) continue
    const [mode, type, oid] = metadata!.split(" ")
    if (type !== "blob" || !["100644", "100755"].includes(mode!)) throw new Error(`Unsupported upstream entry: ${path}`)
    const target = join(destination, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, git(repo, ["cat-file", "blob", oid!]), { flag: "wx" })
    await chmod(target, mode === "100755" ? 0o755 : 0o644)
    count++
  }
  if (!count) throw new Error("No matching upstream files found")
}
export async function inventory(dir: string) {
  const entries = await files(dir)
  return new Map(await Promise.all(entries.map(async (path) => [
    path.slice(dir.length + 1), `${(await stat(path)).mode & 0o111 ? "100755" : "100644"}:${createHash("sha256").update(await readFile(path)).digest("hex")}`,
  ] as const)))
}
export function changes(before: Map<string, string>, after: Map<string, string>) {
  return {
    added: [...after.keys()].filter((path) => !before.has(path)).sort(),
    changed: [...after].filter(([path, hash]) => before.has(path) && before.get(path) !== hash).map(([path]) => path).sort(),
    deleted: [...before.keys()].filter((path) => !after.has(path)).sort(),
  }
}

async function main() {
  const { values } = parseArgs({ args: process.argv.slice(2), strict: true, options: {
    ref: { type: "string" }, source: { type: "string" }, check: { type: "boolean", default: false },
  } })
  const pinPath = join(root, "upstream.json")
  const pin = await Bun.file(pinPath).json()
  if (pin.remote !== remote) throw new Error("Only the canonical Cursor upstream is supported")
  const ref = values.ref ?? pin.sha
  if (ref !== "main" && !/^[0-9a-f]{40}$/.test(ref)) throw new Error("--ref must be main or a full commit SHA")
  await verifySources()
  await mkdir(join(root, ".local"), { recursive: true })
  const workspace = await mkdtemp(join(root, ".local/upstream-sync-"))
  const repo = values.source ? resolve(values.source) : join(workspace, "checkout")
  if (!values.source) {
    execFileSync("git", ["clone", "--quiet", "--depth=1", "--no-checkout", remote, repo], { stdio: ["ignore", "pipe", "pipe"] })
    if (ref !== "main") git(repo, ["fetch", "--quiet", "--depth=1", "origin", ref])
  }
  const revision = ref === "main" ? values.source ? "refs/heads/main" : "refs/remotes/origin/main" : ref
  const sha = git(repo, ["rev-parse", "--verify", `${revision}^{commit}`]).toString("utf8").trim()
  const candidate = join(workspace, "vendor")
  await snapshot(repo, sha, candidate)
  const version = z.object({ version: z.string() }).parse(await Bun.file(join(candidate, "pstack/plugin.json")).json()).version
  const delta = changes(await inventory(join(root, "vendor")), await inventory(candidate))
  const report = { previous: pin.sha, target: sha, version, ...delta }
  const reportPath = join(workspace, "report.json")
  await Bun.write(reportPath, JSON.stringify(report, null, 2) + "\n")
  if (values.check) {
    console.log(JSON.stringify({ ...report, check: true, report: reportPath }, null, 2))
    if (sha !== pin.sha || delta.added.length || delta.changed.length || delta.deleted.length) process.exitCode = 1
    return
  }
  const digest = await sourceHash(candidate)
  // Keep both snapshots plus a report for crash recovery and agent reconciliation.
  await Bun.write(join(workspace, "previous-upstream.json"), await Bun.file(pinPath).text())
  await Bun.write(join(workspace, "previous-sources.lock.json"), await Bun.file(join(root, "sources.lock.json")).text())
  await rename(join(root, "vendor"), join(workspace, "previous-vendor"))
  await rename(candidate, join(root, "vendor"))
  await Bun.write(pinPath, JSON.stringify({ ...pin, sha, pstackVersion: version, components }, null, 2) + "\n")
  await Bun.write(join(root, "sources.lock.json"), JSON.stringify(digest, null, 2) + "\n")
  console.log(JSON.stringify({ ...report, report: reportPath, next: "bun run verify; reconcile only the reported translation/override failures" }, null, 2))
}

if (import.meta.main) await main()
