#!/usr/bin/env bun
// Adapted from kakadiadarpan/pstack-opencode, MIT; see port/LICENSE.
// Builds dist/ from vendor/ (verbatim upstream) + port/rules.ts + port/overrides + port/additions.
// Fails when a rule stops matching (upstream drifted) or a Cursor-ism survives into dist/.
import { existsSync } from "node:fs"
import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import type { Rule } from "../port/rules.ts"
import { rules } from "../adapt/translations.ts"
import { residue, allowed } from "../port/lint.ts"
import { applyLocal } from "../adapt/apply.ts"
import { verifySources } from "./sources.ts"

const root = join(import.meta.dir, "..")
const finalDist = join(root, "dist")
// Build beside dist/ and swap at the end, so a running OpenCode that watches the plugin never
// reloads a half-written tree.
const dist = join(root, ".dist-build")
const overridesDir = join(root, "port/overrides")
// dist path -> git blob id of the upstream file that override was last reconciled with.
const overridePinsPath = join(root, "port/overrides.json")
const additionsDir = join(root, "port/additions")

// vendor path prefix -> dist path prefix. Unlisted vendor files are not shipped.
const layout: [from: string, to: string][] = [
  ["vendor/pstack/skills/", "skills/"],
  ["vendor/pstack/agents/", "agents/"],
  ["vendor/pstack/docs/", "docs/"],
  ["vendor/pstack/automations/", "automations/"],
  ["vendor/pstack/LICENSE", "licenses/pstack-LICENSE"],
  ["vendor/cursor-team-kit/skills/", "skills/"],
  ["vendor/cursor-team-kit/LICENSE", "licenses/cursor-team-kit-LICENSE"],
]

// Cursor-only features with no OpenCode equivalent, and upstream's Claude Code adapter, which the
// rules in port/rules.ts replace for OpenCode.
const dropped = ["skills/make-bot-ui/", "docs/harness/"]

const isText = (path: string) => /\.(md|mdc|txt|ya?ml|tsv)$/.test(path)

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir).catch(() => [])) {
    if (entry === "node_modules") continue
    const path = join(dir, entry)
    if ((await stat(path)).isDirectory()) out.push(...(await walk(path)))
    else out.push(path)
  }
  return out
}

function target(vendorRel: string) {
  for (const [from, to] of layout) {
    if (from.endsWith("/") ? vendorRel.startsWith(from) : vendorRel === from) {
      const out = to + vendorRel.slice(from.length)
      return dropped.some((d) => out.startsWith(d)) ? undefined : out
    }
  }
}

// Same id as `git hash-object`, so `git diff <pinned> <current>` shows what upstream changed.
const blobId = (bytes: Uint8Array) =>
  new Bun.CryptoHasher("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex")

function applies(rule: Rule, path: string) {
  return rule.files ? rule.files.test(path) : path.endsWith(".md")
}

function apply(rule: Rule, text: string): [string, number] {
  if (typeof rule.find === "string") {
    const parts = text.split(rule.find)
    return [parts.join(rule.replace), parts.length - 1]
  }
  if (!rule.find.global) throw new Error(`rule regex must be global: ${rule.find}`)
  let count = 0
  const out = text.replace(rule.find, (...args) => {
    count++
    return rule.replace.replace(/\$(\d)/g, (_, i) => args[Number(i)] ?? "")
  })
  return [out, count]
}

await verifySources()
await rm(dist, { recursive: true, force: true })

const overrides = new Set((await walk(overridesDir)).map((p) => relative(overridesDir, p)))
const overridden = new Map<string, { vendor: string; blob: string }>()
const hits = new Map<Rule, number>(rules.map((r) => [r, 0]))
const written: string[] = []

for (const file of await walk(join(root, "vendor"))) {
  const vendor = relative(root, file)
  const out = target(vendor)
  if (!out) continue
  const dest = join(dist, out)
  await mkdir(dirname(dest), { recursive: true })
  if (overrides.has(out)) {
    overridden.set(out, { vendor, blob: blobId(await Bun.file(file).bytes()) })
    continue
  }
  if (!isText(out)) {
    await cp(file, dest)
    written.push(out)
    continue
  }
  let text = await Bun.file(file).text()
  for (const rule of rules) {
    if (!applies(rule, out)) continue
    const [next, count] = apply(rule, text)
    text = next
    hits.set(rule, hits.get(rule)! + count)
  }
  await Bun.write(dest, text)
  written.push(out)
}

for (const rel of overrides) {
  await mkdir(dirname(join(dist, rel)), { recursive: true })
  await cp(join(overridesDir, rel), join(dist, rel))
  written.push(rel)
}
for (const file of await walk(additionsDir)) {
  const rel = relative(additionsDir, file)
  await mkdir(dirname(join(dist, rel)), { recursive: true })
  await cp(file, join(dist, rel))
  written.push(rel)
}

const problems: string[] = []
for (const [rule, count] of hits) {
  const min = rule.count ?? 1
  if (count < min) problems.push(`rule matched ${count}x (want >= ${min}): ${String(rule.find).slice(0, 120)}`)
}

const pins: Record<string, string> = await Bun.file(overridePinsPath).json()
for (const rel of [...overrides].sort()) {
  const source = overridden.get(rel)
  const pin = pins[rel]
  if (!source) problems.push(`port/overrides/${rel} replaces no upstream file. Move it to port/additions/.`)
  else if (pin !== source.blob)
    problems.push(
      `upstream changed ${source.vendor}, which port/overrides/${rel} replaces. Port the change (${pin ? `git diff ${pin} ${source.blob}` : "no pin yet"}), then pin "${rel}": "${source.blob}" in port/overrides.json.`,
    )
}
for (const rel of Object.keys(pins)) if (!overrides.has(rel)) problems.push(`port/overrides.json pins ${rel}, which has no override.`)

for (const rel of written.filter((p) => p.endsWith(".md")).sort()) {
  const lines = (await Bun.file(join(dist, rel)).text()).split("\n")
  lines.forEach((line, i) => {
    for (const pattern of residue) {
      const match = line.match(pattern)
      if (match && !allowed(rel, line, match[0])) problems.push(`${rel}:${i + 1}: residue "${match[0]}": ${line.trim().slice(0, 160)}`)
    }
    // Guide images are not vendored (upstream.json excludes them), so image links are skipped. A
    // target with no "/" or "." is a template placeholder such as `[PR #123](url)`.
    for (const [, href] of line.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const path = href!.replace(/[#?].*/, "")
      if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path) || (!path.includes("/") && !path.includes("."))) continue
      if (!existsSync(join(dist, dirname(rel), path))) problems.push(`${rel}:${i + 1}: dangling link "${href}"`)
    }
  })
}

if (problems.length) {
  await rm(dist, { recursive: true, force: true })
  console.error(problems.join("\n"))
  console.error(`\n${problems.length} problem(s)`)
  process.exit(1)
}
await applyLocal(dist)
await cp(join(root, "port/LICENSE"), join(dist, "licenses/opencode-translation-LICENSE"))
await Bun.write(join(dist, "manifest.json"), JSON.stringify(await manifest(), null, 2) + "\n")
await rm(join(root, ".dist-old"), { recursive: true, force: true })
await rename(finalDist, join(root, ".dist-old")).catch(() => undefined)
await rename(dist, finalDist)
await rm(join(root, ".dist-old"), { recursive: true, force: true })
console.log(`built ${written.length} files into dist/`)

async function manifest() {
  const skills = []
  for (const file of (await walk(join(dist, "skills"))).sort()) {
    if (!file.endsWith("/SKILL.md")) continue
    const rel = relative(dist, file)
    if (rel.split("/").length !== 3) continue
    const fm = frontmatter(await Bun.file(file).text())
    const id = rel.split("/")[1]!
    skills.push({
      id,
      name: typeof fm.name === "string" ? fm.name : id,
      description: typeof fm.description === "string" ? fm.description : undefined,
      autoinvoke: fm["disable-model-invocation"] === true ? false : undefined,
      file: rel,
    })
  }
  const agents = []
  for (const file of (await walk(join(dist, "agents"))).sort()) {
    if (!file.endsWith(".md")) continue
    const rel = relative(dist, file)
    const fm = frontmatter(await Bun.file(file).text())
    agents.push({ id: rel.replace(/^agents\//, "").replace(/\.md$/, ""), ...fm, file: rel })
  }
  return { upstream: (await Bun.file(join(root, "upstream.json")).json()).sha, skills, agents }
}

function frontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  return match ? (Bun.YAML.parse(match[1]!) as Record<string, unknown>) : {}
}
