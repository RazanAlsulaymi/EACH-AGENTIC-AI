/**
 * Sanitize plan/agent output: remove routing tokens, tool traces, and JSON artifacts.
 * Keeps readable markdown-like content for PlanRenderer.
 */
import type { StructuredPlan } from "@/lib/types"

const PLAN_READY_SAFE_MESSAGE =
  "Plan is ready. Review it in the Plan tab. You can Approve or Decline and send feedback to revise."

/** Detect if text looks like raw plan/JSON or internal process output (do not show in chat). */
function containsPlanOrJsonLeakage(text: string): boolean {
  if (!text || typeof text !== "string") return false
  const t = text.trim()
  if (/```\s*json/i.test(t)) return true
  if (/CURRENT PLAN TO REVIEW/i.test(t)) return true
  if (/\{\s*"title"\s*:/.test(t)) return true
  if (/\{\s*"goals"\s*:/.test(t)) return true
  if (/\{\s*"dailyPlan"\s*:/.test(t) || /\{\s*"daily_plan"\s*:/.test(t)) return true
  if (/\{\s*"dateRange"\s*:/.test(t)) return true
  return false
}

/**
 * Guardrail for chat UI: never show raw JSON or plan dumps in the chat.
 * If leakage is detected, return the safe teacher-facing message.
 */
export function sanitizeChatMessageForDisplay(content: string | null | undefined): string {
  if (content == null || typeof content !== "string") return ""
  if (!containsPlanOrJsonLeakage(content)) return content
  return PLAN_READY_SAFE_MESSAGE
}

export function sanitizePlanText(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return ""
  const lines = raw.split("\n")
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip lines containing agent routing / tool tokens
    if (
      /transfer_to_(orchestrator|assessment_agent|planning_agent|reflection_agent|evaluation_agent)/i.test(line) ||
      /^\s*tool\s*:/i.test(line) ||
      /^\s*TRACE\s*:/i.test(line) ||
      /^\s*Reward\s*:/i.test(line)
    ) {
      continue
    }

    // Skip standalone single-line JSON (common artifact)
    if (trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.length > 10) {
      try {
        JSON.parse(trimmed)
        continue
      } catch {
        // not valid JSON, keep line
      }
    }

    out.push(line)
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** Parse sanitized plan text into modules by ## / ### headers for per-module approval UI */
export type PlanModule = { id: string; title: string; content: string }

export function parsePlanModules(raw: string): PlanModule[] {
  const text = sanitizePlanText(raw)
  if (!text) return []
  const modules: PlanModule[] = []
  const lines = text.split("\n")
  let current: { title: string; lines: string[] } | null = null
  const flush = () => {
    if (current && current.lines.length > 0) {
      const content = current.lines.join("\n").trim()
      if (content) {
        modules.push({
          id: current.title.toLowerCase().replace(/\s+/g, "-"),
          title: current.title,
          content,
        })
      }
    }
  }
  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+)$/)
    if (match) {
      flush()
      current = { title: match[1].trim(), lines: [] }
    } else {
      if (!current) current = { title: "Plan", lines: [] }
      current.lines.push(line)
    }
  }
  flush()
  if (modules.length === 0 && text.trim()) {
    modules.push({ id: "plan", title: "Plan", content: text.trim() })
  }
  return modules
}

/** Known plan array key names (case-insensitive). We normalize to goals, daily_plan, dailyPlan, strategies for StructuredPlan. */
const PLAN_ARRAY_KEY_ALIASES: Record<string, string[]> = {
  goals: ["goals", "Goals"],
  daily_plan: ["daily_plan", "dailyPlan", "DailyPlan", "Daily_plan"],
  strategies: ["strategies", "Strategies"],
  materials: ["materials", "Materials"],
  basedOn: ["basedOn", "based_on", "BasedOn"],
  homeFollowUp: ["homeFollowUp", "home_follow_up", "HomeFollowUp"],
}

function getPlanArrayKeys(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const keys = Object.keys(data)
  const get = (... names: string[]) => {
    for (const n of names) {
      const k = keys.find((key) => key.toLowerCase() === n.toLowerCase())
      if (k !== undefined && data[k] !== undefined) return data[k]
    }
    return undefined
  }
  for (const [canon, aliases] of Object.entries(PLAN_ARRAY_KEY_ALIASES)) {
    const key = keys.find((k) => aliases.includes(k) || k.toLowerCase() === canon.toLowerCase())
    if (key !== undefined && Array.isArray(data[key])) {
      result[canon] = data[key]
      if (canon === "daily_plan") result.dailyPlan = data[key]
    }
  }
  const title = get("title", "Title")
  if (title !== undefined) result.title = title
  const date = get("date", "Date")
  if (date !== undefined) result.date = date
  const difficulty = get("difficulty", "difficultyLevel", "Difficulty", "DifficultyLevel")
  if (difficulty !== undefined) result.difficulty = difficulty
  if (result.difficulty === undefined) result.difficultyLevel = get("difficultyLevel", "DifficultyLevel")
  const dateRange = get("dateRange", "date_range", "DateRange")
  if (dateRange !== undefined) result.dateRange = dateRange
  const student = get("student", "Student")
  if (student !== undefined) result.student = student
  if (data.basedOn !== undefined) result.basedOn = data.basedOn
  if (data.homeFollowUp !== undefined) result.homeFollowUp = data.homeFollowUp
  return result
}

/** Try to parse plan content as structured JSON: { title, date, difficulty, goals[], daily_plan[], strategies[], materials[] } */
export function parseStructuredPlan(content: string): StructuredPlan | null {
  if (!content || typeof content !== "string") return null
  const trimmed = content.trim()
  let jsonStr = trimmed
  if (!trimmed.startsWith("{")) {
    const start = trimmed.indexOf("{")
    if (start < 0) return null
    let depth = 0
    let end = -1
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++
      else if (trimmed[i] === "}") {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end > start) jsonStr = trimmed.slice(start, end)
  }
  try {
    const data = JSON.parse(jsonStr) as Record<string, unknown>
    if (!data || typeof data !== "object") return null
    const normalized = getPlanArrayKeys(data)
    const hasArrays =
      Array.isArray(normalized.goals) ||
      Array.isArray(normalized.daily_plan) ||
      Array.isArray(normalized.dailyPlan) ||
      Array.isArray(normalized.strategies) ||
      Array.isArray(normalized.materials) ||
      Array.isArray(normalized.basedOn) ||
      Array.isArray(normalized.homeFollowUp)
    if (!hasArrays) return null
    return normalized as StructuredPlan
  } catch {
    return null
  }
}
