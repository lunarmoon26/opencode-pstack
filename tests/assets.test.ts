import { test, expect } from "bun:test"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { loadCatalog, dist, body } from "../plugin/catalog.ts"
import { files } from "../adapt/apply.ts"
import { verifySources } from "../scripts/sources.ts"

test("pinned sources remain unchanged and both upstream licenses ship", async () => {
  await verifySources()
  for (const license of ["pstack-LICENSE", "cursor-team-kit-LICENSE", "opencode-translation-LICENSE"]) {
    expect(existsSync(join(dist, "licenses", license))).toBe(true)
  }
})

test("all skill resources have safe, real paths; main entrypoint and playbooks are present", () => {
  const catalog = loadCatalog()
  expect(catalog.skills.length).toBeGreaterThan(50)
  expect(catalog.skills.some((skill) => skill.id === "make-bot-ui")).toBe(false)
  expect(catalog.skills.filter((skill) => skill.id.startsWith("principle-")).length).toBe(24)
  expect(catalog.skills.find((skill) => skill.id === "setup-pstack")?.content).toContain("Never write a separate model sheet")
  expect(body("skills/poteto-mode/SKILL.md")).toContain("Keep configured models and variants unchanged")
  expect(existsSync(join(dist, "skills/poteto-mode/playbooks/bug-fix.md"))).toBe(true)
  expect(existsSync(join(dist, "automations"))).toBe(false)
  expect(() => body("../../secret")).toThrow("Invalid")
})

test("generated Markdown contains no broken local links or legacy tool arguments", async () => {
  const problems: string[] = []
  for (const file of await files(dist)) {
    if (!file.endsWith(".md") || file.includes("/licenses/")) continue
    const text = await Bun.file(file).text()
    if (/subagent_type|run_in_background|`AskQuestion`|`Task`|`\/loop\b/.test(text)) problems.push(`${file}: legacy host vocabulary`)
    for (const [, href] of text.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const path = href!.replace(/[#?].*/, "")
      if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path) || (!path.includes("/") && !path.includes("."))) continue
      if (!existsSync(join(dirname(file), path))) problems.push(`${file}: missing ${href}`)
    }
  }
  expect(problems).toEqual([])
})
