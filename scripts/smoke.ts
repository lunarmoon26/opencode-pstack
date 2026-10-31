import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { root } from "../plugin/catalog.ts"

// A private CLI server and temporary HOME keep this probe away from real sessions,
// providers, plugins, credentials, and config. No model request is submitted.
await mkdir("/tmp/opencode", { recursive: true })
const sandbox = await mkdtemp("/tmp/opencode/pstack-smoke-")
const project = join(sandbox, "project")
const home = join(sandbox, "home")
const nonce = crypto.randomUUID()
const env = {
  PATH: process.env.PATH!, HOME: home,
  XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"),
  XDG_STATE_HOME: join(home, ".local/state"), XDG_CACHE_HOME: join(home, ".cache"),
  TMPDIR: sandbox, NO_COLOR: "1", TERM: "dumb",
  OPENCODE_SERVER_PASSWORD: nonce,
}
await mkdir(project)
await mkdir(join(env.XDG_CONFIG_HOME, "opencode"), { recursive: true })
await writeFile(join(project, "opencode.json"), JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  plugins: [pathToFileURL(root).href],
  permissions: [
    { action: "*", resource: "*", effect: "deny" },
    { action: "skill", resource: "*", effect: "allow" },
  ],
}))

const server = Bun.spawn(["opencode", "serve", "--hostname", "127.0.0.1", "--port", "0", "--print-logs", "--log-level", "debug"], {
  cwd: project, env, stdout: "pipe", stderr: "pipe",
})
const stderr = new Response(server.stderr).text()
const timeout = setTimeout(() => server.kill(), 120_000)
try {
  let url = ""
  let output = ""
  for await (const chunk of server.stdout) {
    output += new TextDecoder().decode(chunk)
    const match = /server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
    if (match) { url = match[1]!; break }
  }
  if (!url) throw new Error(`Private server did not start: ${output}`)
  async function api(path: string, body?: unknown) {
    const target = new URL(path, url)
    target.searchParams.set("location[directory]", project)
    const response = await fetch(target, {
      method: body === undefined ? "GET" : "POST", headers: {
        "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`opencode:${nonce}`).toString("base64")}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(90_000),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`)
    return JSON.parse(text)
  }
  const session = (await api("/api/session", { title: "Model-free pstack smoke" })).data
  // The model catalog endpoint waits for plugin activation; registry list endpoints
  // can otherwise expose the empty pre-activation snapshot on a cold server.
  await api("/api/model")
  const agents = (await api("/api/agent")).data as { id: string; permissions: unknown[] }[]
  for (const id of ["poteto", "poteto-agent", "comment-sicko", "pstack-code", "pstack-judgment"]) {
    if (!agents.some((agent) => agent.id === id)) throw new Error(`Native agent registration missing: ${id}; got ${agents.map((agent) => agent.id).join(", ")}; plugins: ${JSON.stringify(await api("/api/plugin"))}`)
  }
  const commands = (await api("/api/command")).data as { name: string }[]
  for (const name of ["poteto-mode", "setup-pstack", "how", "pstack-loop"]) {
    if (!commands.some((command) => command.name === name)) throw new Error(`Native command registration missing: ${name}`)
  }
  // Explicit resume=false admits and resolves the skill attachment without
  // starting a model. This exercises the real session-scoped skill transform.
  await api(`/api/session/${session.id}/prompt`, {
    text: "Model-free skill resolution probe. Do not execute this prompt.",
    skills: [{ id: "poteto-mode" }], resume: false,
  })
  console.log(JSON.stringify({ ok: true, agents: agents.length, commands: commands.length,
    checks: ["isolated private OpenCode server", "real plugin entrypoint", "five native agents", "native slash commands", "native poteto-mode skill resolution", "no model calls"] }, null, 2))
} catch (error) {
  server.kill()
  await server.exited
  throw new Error(`${error instanceof Error ? error.message : String(error)}\n${(await stderr).slice(-20_000).replaceAll(nonce, "[redacted]")}`, { cause: error })
} finally {
  clearTimeout(timeout)
  server.kill()
  await server.exited
  // The directory was minted by this process and contains only this probe's files.
  await rm(sandbox, { recursive: true, force: true })
}
