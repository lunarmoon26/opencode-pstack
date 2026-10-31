import type { Plugin } from "@opencode/plugin"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

type Message = Awaited<ReturnType<Plugin.Context["session"]["context"]>>[number]

export function toJsonl(messages: readonly Message[]) {
  const rows: unknown[] = []
  for (const message of messages) {
    if (message.type === "user" || message.type === "synthetic") {
      rows.push({ role: "user", message: { content: [{ type: "text", text: message.text }] } })
    } else if (message.type === "assistant") {
      const content = message.content.flatMap((part): unknown[] => {
        if (part.type === "text") return [{ type: "text", text: part.text }]
        if (part.type === "tool" && "input" in part.state) return [{ type: "tool_use", name: part.name, input: part.state.input }]
        return []
      })
      if (content.length) rows.push({ role: "assistant", message: { content } })
    } else if (message.type === "skill") {
      rows.push({ role: "system", message: { content: [{ type: "text", text: `Loaded skill ${message.skill}\n${message.text}` }] } })
    } else if (message.type === "compaction" && message.status === "completed") {
      rows.push({ role: "system", message: { content: [{ type: "text", text: `Compaction summary\n${message.summary}` }] } })
    }
  }
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
}

export function dataDirectory() {
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local/share"), "opencode", "pstack")
}
export function storeDirectory(directory: string, sessionID: string) {
  const key = createHash("sha256").update(directory).digest("hex").slice(0, 24)
  return join(dataDirectory(), "store", key, safeID(sessionID))
}
function safeID(id: string) {
  if (!/^ses[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid OpenCode session ID")
  return id
}

export async function exportTranscripts(ctx: Plugin.Context, sessionID: string, scope: "current" | "project", limit: number, signal: AbortSignal) {
  signal.throwIfAborted()
  const self = await ctx.session.get({ sessionID }, { signal })
  if (self.location.directory !== ctx.location.directory) throw new Error("Session moved outside this plugin location")
  const sessions = scope === "current" ? [self] : (await ctx.session.list({
    directory: self.location.directory, limit, order: "desc",
  }, { signal })).data
  // Recheck every returned identity, rather than trusting a server-side filter.
  const selected = sessions.filter((session) =>
    session.projectID === self.projectID && session.location.directory === self.location.directory,
  ).slice(0, limit)
  for (const session of selected) safeID(session.id)
  const base = join(dataDirectory(), "transcripts")
  signal.throwIfAborted()
  await mkdir(base, { recursive: true, mode: 0o700 })
  const dir = await mkdtemp(join(base, "export-"))
  const files: string[] = []
  try {
    for (const session of selected) {
      signal.throwIfAborted()
      const fresh = await ctx.session.get({ sessionID: session.id }, { signal })
      if (fresh.projectID !== self.projectID || fresh.location.directory !== self.location.directory) throw new Error("Session moved during export")
      const messages = await ctx.session.context({ sessionID: session.id }, { signal })
      const text = toJsonl(messages)
      if (Buffer.byteLength(text) > 5_000_000) throw new Error("Transcript exceeds the 5 MB per-session export limit")
      const folder = join(dir, safeID(session.id))
      await mkdir(folder, { mode: 0o700 })
      const file = join(folder, `${session.id}.jsonl`)
      signal.throwIfAborted()
      await writeFile(file, text, { encoding: "utf8", mode: 0o600, flag: "wx", signal })
      files.push(file)
    }
  } catch (error) {
    // Leave completed files intact, but never report a partial export as complete.
    throw new Error(`Transcript export incomplete at ${dir} (${files.length} completed): ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  return {
    dir, sessionID, scope, files, exported: files.length,
    coverage: "Stored session context only, including compaction summaries and skill loads. Hidden reasoning, tool results, attachments, and compacted-away messages are not exported. No recursive child or cross-directory scan.",
  }
}
