/**
 * Plan parsing: extract the first valid JSON object from agent output.
 * Ignores tool markers, REFLECTION_PASSED, extra commentary, and any second JSON block.
 */

/**
 * Extracts the first valid JSON object from a plan string (e.g. from the backend).
 * Returns the JSON string for that object only, or null if none found / invalid.
 * Use this before passing to parseStructuredPlan so the UI never sees junk like
 * transfer_to_orchestrator, REFLECTION_PASSED, or multiple JSON blocks.
 */
export function extractFirstPlanJson(agentPlan: string | null | undefined): string | null {
  if (agentPlan == null || typeof agentPlan !== "string") return null
  const trimmed = agentPlan.trim()
  const start = trimmed.indexOf("{")
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        const jsonStr = trimmed.slice(start, i + 1)
        try {
          JSON.parse(jsonStr)
          return jsonStr
        } catch {
          return null
        }
      }
    }
  }
  return null
}
