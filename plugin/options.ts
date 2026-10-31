import { Model } from "@opencode/plugin"
import { z } from "zod"

export const optionsSchema = z.strictObject({
  routing: z.boolean().default(false),
  commands: z.boolean().default(true),
  loops: z.boolean().default(false),
  models: z.strictObject({
    code: z.string().min(3).optional(),
    judgment: z.string().min(3).optional(),
  }).default({}),
})
export type Options = z.infer<typeof optionsSchema>
export type InventoryModel = { id: string; providerID: string; variants: readonly { id: string }[]; enabled?: boolean }

export function resolveModels(options: Options, inventory: readonly InventoryModel[]) {
  const roles: Partial<Record<"code" | "judgment", Model.Ref>> = {}
  for (const role of ["code", "judgment"] as const) {
    const value = options.models[role]
    if (!value) continue
    const ref = Model.Ref.parse(value)
    const entry = inventory.find((model) => model.providerID === ref.providerID && model.id === ref.id)
    if (!entry || entry.enabled === false || (ref.variant && !entry.variants.some((variant) => variant.id === ref.variant))) {
      throw new Error(`pstack models.${role} is unavailable: ${value}. Choose an exact ref from the live model inventory.`)
    }
    roles[role] = ref
  }
  return roles
}

type Ref = { providerID: string; id: string; variant?: string }
export function renderRoles(code?: Ref, judgment?: Ref) {
  const format = (ref?: Ref) => ref ? `${ref.providerID}/${ref.id}${ref.variant ? `#${ref.variant}` : ""}` : "inherit-parent"
  return [
    "Source: explicit plugin models options and effective named-agent model preferences. No Markdown model sheet is read.",
    `code-default: ${format(code)} (named agent: pstack-code)`,
    `judgment-default: ${format(judgment)} (named agent: pstack-judgment)`,
    "feature, refactoring; bug-fix; perf-issue; hillclimb; how explorer; why investigators; reflect tooling; swarm workers: code-default",
    "judgment and prose; hardest tasks; how explainer; why synthesizer; reflect judgment, divergent, synthesizer: judgment-default",
    "arena runners; architect runners; interrogate reviewers; arena cross-judge pool: judgment-default, code-default",
    "Use the named role agent instead of inventing per-call model choices. Omitted model preferences inherit the session model. Report same-model panels honestly.",
  ].join("\n")
}
