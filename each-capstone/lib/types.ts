// lib/types.ts

export type Class = {
  id: string
  name: string
  description?: string
  studentCount: number
}

export type Student = {
  id: string // your UI mock id like "s1"
  name: string
  classId: string
  className: string

  // ✅ add this for backend integration
  student_id?: number // numeric id (1..)
}

export type ChatSession = {
  id: string
  title: string
  studentId?: string
  studentName?: string
  className?: string
  classId?: string // optional, for sidebar/mock compatibility
  messages?: Array<{ id: string; role: string; content: string; timestamp: Date }>
  createdAt?: Date
}

export type ChatMessage = {
  id: string
  role: "teacher" | "assistant"
  content: string
  timestamp: Date
}

/**
 * ✅ What the backend actually returns (DB shape)
 */
export type StudentProfileDB = {
  student_id: number
  name_ar?: string | null
  name_en?: string | null
  grade?: string | null
  diagnosis?: string | null
  severity_level?: string | null
  previous_assessment?: string | null
  last_plan_date?: string | null
  plan_version?: number | null
  created_at?: string | null
  class_name?: string | null
  class_id?: string | null
}

/** Backend GET /students/{id} returns this shape */
export type StudentProfileResponse = {
  student: StudentProfileDB
  plans?: unknown[]
  sessions?: unknown[]
  milestones?: unknown[]
}

/**
 * ✅ What ContextPanel consumes (UI shape)
 * DB-first. No hallucination. No diagnosis generation.
 */
export type StudentContext = {
  studentId: string
  studentName: string
  className: string
  grade?: string | null

  // DB-only fields (explicit from backend payload)
  diagnosis?: string | null
  severityLevel?: string | null
  previousAssessment?: string | null
  lastPlanDate?: string | null
  planVersion?: number | null
  nameEn?: string | null
  nameAr?: string | null

  // optional
  summary?: string | null
  alerts?: string[] | null
  assessments?: string[] | null
  classId?: string
  plan?: string | null
}

/** Plan UI state: proposed | approved | declined; content and optional feedback */
export type PlanStatus = "proposed" | "approved" | "declined"

export type PlanState = {
  status: PlanStatus
  content: string
  lastFeedback?: string
  revisedAt?: string
}

/** Structured plan schema from backend (JSON) — supports both camelCase and snake_case */
export type StructuredPlan = {
  title?: string
  date?: string
  dateRange?: { start?: string; end?: string }
  student?: { name?: string; classOrGrade?: string }
  difficulty?: string
  difficultyLevel?: string
  basedOn?: string[]
  goals?: Array<{ goal?: string; baseline?: string; target?: string; measurement?: string; review_date?: string; reviewDate?: string } | string>
  daily_plan?: Array<{ day?: string; reading?: string; math?: string; behavior?: string; notes?: string; support?: string; breaks?: string } | string>
  dailyPlan?: Array<{ day?: string; reading?: string; math?: string; support?: string; breaks?: string; notes?: string } | string>
  strategies?: Array<{ situation?: string; strategy?: string; script?: string; frequency?: string; teacherScript?: string } | string>
  materials?: string[]
  homeFollowUp?: string[]
}