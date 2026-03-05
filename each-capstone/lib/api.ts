// lib/api.ts — EACH backend API (FastAPI @ http://127.0.0.1:8003)

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8003"

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status} ${res.statusText} - ${text}`)
  }

  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T
  }

  return (await res.json()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// ——— Typed API helpers ———

export type ChatRequestBody = {
  message: string
  student_id?: number | null
  thread_id?: string | null
  preferred_language?: "en" | "ar"
  /** Teacher intent: triggers plan/agent flow without literal message */
  intent?: "PLAN_GENERATE" | "PLAN_SIMPLIFY" | "PLAN_ADD_STRATEGY" | null
}

export type ChatResponseSession = {
  student_id?: number
  difficulty_reported?: string
  triggers_noted?: string
  strategies_tried?: string
  support_needed?: string
  all_fields_complete?: boolean
  plan_generated?: boolean
  reflection_done?: boolean
  plan_approved?: boolean
  eval_score?: number
  plan_version?: number
  preferred_language?: "en" | "ar"
}

export type ChatResponsePayload = {
  response: string
  session: ChatResponseSession
  plan?: string | null
  plan_id?: number | null
  tags_found?: string[]
  suggested_student_id?: number | null
  proposed_updates?: unknown[]
  response_type?: "chat" | "plan_ready" | "evaluation_complete"
  thread_id?: string
}

/** GET /students — list all students (DB rows) */
export function fetchStudents(): Promise<StudentRecordFromAPI[]> {
  return apiGet<StudentRecordFromAPI[]>("/students")
}

/** GET /students/{id} — full profile; may return { student, plans, sessions, milestones } */
export function fetchStudentProfile(
  studentId: number
): Promise<StudentProfileAPIResponse | StudentRecordFromAPI> {
  return apiGet<StudentProfileAPIResponse | StudentRecordFromAPI>(
    `/students/${studentId}`
  )
}

/** POST /chat — send message, get response + optional plan */
export function postChat(body: ChatRequestBody): Promise<ChatResponsePayload> {
  return apiPost<ChatResponsePayload>("/chat", body)
}

/** POST /plan/revise — send feedback + context, get revised plan (strict JSON) */
export type PlanReviseRequest = {
  student_id: number
  current_plan: string
  feedback: string
  plan_id?: string | null
  context?: {
    preferred_language?: "en" | "ar"
    studentProfile?: Record<string, unknown>
    approvedUpdates?: unknown[]
    recentTeacherNotes?: string[]
    recentChatTurns?: Array<{ role: string; content: string }>
  }
}

export type PlanReviseResponse = {
  revised_plan: string
  plan_json?: StructuredPlanFromAPI | null
}

export type StructuredPlanFromAPI = {
  title?: string
  date?: string
  difficulty?: string
  goals?: unknown[]
  daily_plan?: unknown[]
  strategies?: unknown[]
  materials?: string[]
}

export function postPlanRevise(body: PlanReviseRequest): Promise<PlanReviseResponse> {
  return apiPost<PlanReviseResponse>("/plan/revise", body)
}

/** Student row as returned by GET /students or inside GET /students/{id}.student */
export type StudentRecordFromAPI = {
  student_id: number
  name_en?: string | null
  name_ar?: string | null
  grade?: string | null
  class_name?: string | null
  class_id?: string | null
  diagnosis?: string | null
  severity_level?: string | null
  previous_assessment?: string | null
  last_plan_date?: string | null
  plan_version?: number | null
  created_at?: string | null
}

/** GET /students/{id} response when backend returns full profile */
export type StudentProfileAPIResponse = {
  student: StudentRecordFromAPI
  plans?: unknown[]
  sessions?: unknown[]
  milestones?: unknown[]
}

export { BASE_URL }
