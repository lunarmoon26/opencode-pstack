import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

export const root = dirname(dirname(fileURLToPath(import.meta.url)))
export const dist = join(root, "dist")
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const manifestSchema = z.object({
  upstream: z.string().regex(/^[0-9a-f]{40}$/),
  skills: z.array(z.object({
    id, name: z.string(), description: z.string().optional(),
    autoinvoke: z.boolean().optional(), file: z.string(),
  })),
  agents: z.array(z.object({
    id, name: z.string().optional(), description: z.string().optional(),
    mode: z.enum(["primary", "subagent", "all"]).optional(),
    color: z.string().optional(), file: z.string(),
  })),
})

export function body(file: string) {
  if (!/^(skills\/[a-z0-9-]+\/SKILL\.md|agents\/[a-z0-9-]+\.md|HOST\.md)$/.test(file)) {
    throw new Error(`Invalid pstack catalog path: ${file}`)
  }
  return readFileSync(join(dist, file), "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim()
}

export function loadCatalog() {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8")))
  if (new Set(manifest.skills.map((s) => s.id)).size !== manifest.skills.length) throw new Error("Duplicate pstack skill ID")
  const skills = manifest.skills.map((skill) => {
    if (skill.file !== `skills/${skill.id}/SKILL.md`) throw new Error(`Mismatched skill path: ${skill.id}`)
    return { ...skill, content: body(skill.file) }
  })
  const modePath = join(dist, "skills/poteto-mode/SKILL.md")
  const mode = skills.find((skill) => skill.id === "poteto-mode")!
  if (!mode) throw new Error("Missing poteto-mode")
  const agents = manifest.agents.map((agent) => ({
    ...agent,
    content: body(agent.file)
      .replaceAll("{{POTETO_MODE_SKILL}}", modePath)
      .replaceAll("{{POTETO_MODE_BODY}}", mode.content),
  }))
  return { upstream: manifest.upstream, skills, agents, host: body("HOST.md") }
}
export type Catalog = ReturnType<typeof loadCatalog>
