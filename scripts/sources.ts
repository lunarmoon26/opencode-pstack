import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { files } from "../adapt/apply.ts"

const root = join(import.meta.dir, "..")
export async function sourceHash(vendor = join(root, "vendor"), port = join(root, "port")) {
  const hash = createHash("sha256")
  const inputs = [
    ... (await files(vendor)).map((path) => ({ path, name: `vendor/${relative(vendor, path)}` })),
    ... (await files(port)).map((path) => ({ path, name: `port/${relative(port, path)}` })),
  ].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  for (const input of inputs) {
    const content = await readFile(input.path)
    hash.update(input.name).update("\0").update(String(content.length)).update("\0").update(content)
  }
  return { sha256: hash.digest("hex"), files: inputs.length }
}
export async function verifySources() {
  const actual = await sourceHash()
  const expected = await Bun.file(join(root, "sources.lock.json")).json()
  if (actual.sha256 !== expected.sha256 || actual.files !== expected.files) {
    throw new Error("Vendored sources changed. Review the new upstream and adapter together, update provenance, and explicitly regenerate sources.lock.json.")
  }
}
if (import.meta.main) console.log(JSON.stringify(await sourceHash(), null, 2))
