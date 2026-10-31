import { test, expect } from "bun:test"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { exportTranscripts, toJsonl } from "../plugin/transcripts.ts"
import { harness } from "./harness.ts"

test("compatibility transcripts include visible evidence, not hidden reasoning or tool outputs", () => {
  const messages = [
    { type: "user", text: "fix the bug" },
    { type: "assistant", content: [
      { type: "reasoning", text: "private reasoning" },
      { type: "text", text: "Found the issue" },
      { type: "tool", name: "read", state: { input: { path: "src/index.ts" }, output: "secret tool result" } },
    ] },
    { type: "skill", skill: "poteto-mode", text: "workflow" },
    { type: "compaction", status: "completed", summary: "verified the fix" },
  ] as any
  const output = toJsonl(messages)
  expect(output).toContain('"role":"user"')
  expect(output).toContain('"name":"read"')
  expect(output).toContain("Loaded skill poteto-mode")
  expect(output).toContain("verified the fix")
  expect(output).not.toContain("private reasoning")
  expect(output).not.toContain("secret tool result")
  for (const line of output.trim().split("\n")) expect(() => JSON.parse(line)).not.toThrow()
})

test("exports current context privately and filters server results by exact directory and project", async () => {
  const tmp = await mkdtemp("/tmp/opencode/pstack-transcripts-")
  const previous = process.env.XDG_DATA_HOME
  process.env.XDG_DATA_HOME = tmp
  try {
    const h = harness()
    h.sessions.push(h.self,
      { id: "ses_allowed", projectID: "project-1", location: { directory: "/test/project" } },
      { id: "ses_elsewhere", projectID: "project-1", location: { directory: "/other/worktree" } },
      { id: "ses_foreign", projectID: "project-2", location: { directory: "/test/project" } },
    )
    h.messages.push({ type: "user", text: "scoped context" })
    const current = await exportTranscripts(h.context, "ses_test", "current", 5, new AbortController().signal)
    expect(current.files).toHaveLength(1)
    expect((await stat(current.files[0]!)).mode & 0o777).toBe(0o600)
    expect((await stat(current.dir)).mode & 0o777).toBe(0o700)
    const project = await exportTranscripts(h.context, "ses_test", "project", 20, new AbortController().signal)
    expect(project.files).toHaveLength(2)
    expect(project.files.join("\n")).not.toContain("ses_foreign")
    expect(h.sessionReads).not.toContain("ses_foreign")
    expect(h.sessionReads).not.toContain("ses_elsewhere")
    expect(project.coverage).toContain("No recursive child")
  } finally {
    if (previous === undefined) delete process.env.XDG_DATA_HOME
    else process.env.XDG_DATA_HOME = previous
    await rm(tmp, { recursive: true, force: true })
  }
})

test("aborted exports and moved sessions fail before writing transcripts", async () => {
  const h = harness()
  await expect(exportTranscripts(h.context, "ses_test", "current", 5, AbortSignal.abort())).rejects.toThrow()
  expect(h.sessionReads).toEqual([])
  h.self.location.directory = "/other/project"
  await expect(exportTranscripts(h.context, "ses_test", "current", 5, new AbortController().signal)).rejects.toThrow("moved")
})
