import { test, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, rm, writeFile, chmod, symlink, stat } from "node:fs/promises"
import { join } from "node:path"
import { selected, snapshot, inventory, changes } from "../scripts/sync.ts"

test("upstream selection is explicit and rejects traversal, metadata and unrelated Team Kit skills", () => {
  for (const path of ["pstack/plugin.json", "pstack/skills/how/SKILL.md", "cursor-team-kit/skills/deslop/SKILL.md", "cursor-team-kit/LICENSE"]) expect(selected(path)).toBe(true)
  for (const path of ["pstack/.cursor-plugin/plugin.json", "pstack/assets/image.png", "pstack/docs/guide/images/x.png", "pstack/skills/statechart/scripts/test/x.ts", "cursor-team-kit/skills/other/SKILL.md", "pstack/../secret", "pstack/skills/./x", "other/pstack/x"]) expect(selected(path)).toBe(false)
})

test("snapshot reads exact committed blobs, preserves modes, and reports additions/changes/deletions", async () => {
  await mkdir("/tmp/opencode", { recursive: true })
  const dir = await mkdtemp("/tmp/opencode/pstack-sync-test-")
  const repo = join(dir, "repo")
  await mkdir(repo)
  const git = (args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim()
  try {
    git(["init", "-q", "-b", "main"])
    await mkdir(join(repo, "pstack/skills/how"), { recursive: true })
    await mkdir(join(repo, "pstack/assets"), { recursive: true })
    await writeFile(join(repo, "pstack/plugin.json"), '{"version":"test"}\n')
    await writeFile(join(repo, "pstack/skills/how/SKILL.md"), "committed content\n")
    await chmod(join(repo, "pstack/skills/how/SKILL.md"), 0o755)
    await writeFile(join(repo, "pstack/assets/ignored.txt"), "not imported")
    git(["add", "."])
    git(["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "fixture"])
    const sha = git(["rev-parse", "HEAD"])
    await writeFile(join(repo, "pstack/skills/how/SKILL.md"), "uncommitted content\n")
    const first = join(dir, "first"), second = join(dir, "second")
    await snapshot(repo, sha, first)
    await snapshot(repo, sha, second)
    expect(await Bun.file(join(first, "pstack/skills/how/SKILL.md")).text()).toBe("committed content\n")
    expect((await stat(join(first, "pstack/skills/how/SKILL.md"))).mode & 0o777).toBe(0o755)
    expect(await inventory(first)).toEqual(await inventory(second))
    await chmod(join(second, "pstack/skills/how/SKILL.md"), 0o775)
    expect(await inventory(first)).toEqual(await inventory(second))
    expect(await Bun.file(join(first, "pstack/assets/ignored.txt")).exists()).toBe(false)
    expect(changes(new Map([["gone", "a"], ["same", "x"], ["edit", "old"]]), new Map([["new", "b"], ["same", "x"], ["edit", "new"]]))).toEqual({ added: ["new"], changed: ["edit"], deleted: ["gone"] })
    await symlink("../outside", join(repo, "pstack/skills/link"))
    git(["add", "pstack/skills/link"])
    git(["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "symlink fixture"])
    await expect(snapshot(repo, git(["rev-parse", "HEAD"]), join(dir, "unsafe"))).rejects.toThrow("Unsupported upstream entry")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
