import { rules as inherited, type Rule } from "../port/rules.ts"

// Match String(rule.find) exactly. Keep upstream's translator untouched; record
// only reviewed drift exceptions here, with the reason and a replacement rule.
// A null rule means the old construct was removed upstream, not an ignored error.
const adjustments: { match: string; reason: string; rule: Rule | null }[] = []
const additions: Rule[] = []

for (const adjustment of adjustments) {
  if (!adjustment.reason.trim() || inherited.filter((rule) => String(rule.find) === adjustment.match).length !== 1) {
    throw new Error(`Invalid local translation adjustment: ${adjustment.match}`)
  }
}
export const rules: Rule[] = inherited.flatMap((rule) => {
  const adjustment = adjustments.find((item) => item.match === String(rule.find))
  return adjustment ? adjustment.rule ? [adjustment.rule] : [] : [rule]
}).concat(additions)
