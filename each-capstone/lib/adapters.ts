// lib/adapters.ts
import type { Student } from "@/lib/types"

export type BackendStudent = {
  student_id: number
  name_ar: string
  name_en: string
  grade: string
  diagnosis: string
  severity_level: string
  last_plan_date?: string | null
  plan_version?: number
  alerts?: any[]
}

export function mapBackendStudentToUI(s: BackendStudent): Student {
  // your UI Student uses: id, name, className
  return {
    id: String(s.student_id),
    name: s.name_en || s.name_ar,
    className: s.grade, // you show it as "className" in UI
    // if your Student type has more required fields, add defaults here
  } as Student
}