"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatPanel } from "@/components/chat-panel"
import { ContextPanel, type AssistantActivityEntry } from "@/components/context-panel"
import { ClassesView } from "@/components/classes-view"
import { StudentsView } from "@/components/students-view"
import { HomeView } from "@/components/home-view"
import { SettingsModal } from "@/components/settings-modal"

import type { Class, Student, ChatSession, StudentContext, StudentProfileDB, StudentProfileResponse, PlanState } from "@/lib/types"
import { mockClasses, mockStudents, mockRecentChats } from "@/lib/mock-data"
import { apiGet, postPlanRevise } from "@/lib/api"

type View = "home" | "classes" | "class-detail" | "students" | "chat"

function toStudentIdNumber(student: Student): number | null {
  const raw: any = (student as any).student_id ?? (student as any).id
  if (raw === null || raw === undefined) return null
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const str = String(raw).trim()
  const cleaned = str.replace(/^s/i, "")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function mapDbToContext(student: Student | null, db: StudentProfileDB): StudentContext {
  const studentName = (db.name_en || db.name_ar || student?.name || "").trim() || "—"
  const className = (db.class_name ?? db.grade ?? student?.className ?? "").trim() || "—"
  return {
    studentId: String(db.student_id ?? toStudentIdNumber(student!) ?? ""),
    studentName,
    className,
    grade: db.grade ?? null,
    nameEn: db.name_en ?? null,
    nameAr: db.name_ar ?? null,

    diagnosis: db.diagnosis ?? null,
    severityLevel: db.severity_level ?? null,
    previousAssessment: db.previous_assessment ?? null,
    lastPlanDate: db.last_plan_date ?? null,
    planVersion: db.plan_version ?? null,

    summary: null,
    alerts: null,
    assessments: null,
  }
}

async function fetchStudentFromDb(studentId: number): Promise<StudentProfileDB | null> {
  try {
    const res = await apiGet<StudentProfileResponse | StudentProfileDB | StudentProfileDB[]>(`/students/${studentId}`)
    if (res && typeof res === "object" && "student" in res) {
      return (res as StudentProfileResponse).student
    }
    if (Array.isArray(res)) return res[0] ?? null
    if (res && typeof res === "object") return res as StudentProfileDB
  } catch {
    // fallback to list
  }
  try {
    const list = await apiGet<StudentProfileDB[]>(`/students`)
    const arr = Array.isArray(list) ? list : []
    return arr.find((x) => Number(x.student_id) === Number(studentId)) ?? null
  } catch {
    return null
  }
}

function mapApiStudentToStudent(row: {
  student_id: number
  name_en?: string | null
  name_ar?: string | null
  class_name?: string | null
  grade?: string | null
}): Student {
  const id = String(row.student_id)
  const name = (row.name_en || row.name_ar || "").trim() || "Student"
  const classId = (row.class_name || row.grade || "").trim() || "—"
  return { id, name, classId, className: classId, student_id: row.student_id }
}

function deriveClassesFromStudents(students: Student[]): Class[] {
  const byClass = new Map<string, Student[]>()
  for (const s of students) {
    const key = s.className || s.classId || "—"
    if (!byClass.has(key)) byClass.set(key, [])
    byClass.get(key)!.push(s)
  }
  return Array.from(byClass.entries()).map(([id, list]) => ({
    id,
    name: id,
    studentCount: list.length,
  }))
}

function mapRecentSessionToChatSession(row: {
  session_id: string
  student_id?: number | null
  student_name?: string
  thread_id?: string
  preview?: string
}): ChatSession & { thread_id?: string } {
  return {
    id: row.session_id,
    title: (row.preview || "Session").slice(0, 80),
    studentId: row.student_id != null ? String(row.student_id) : undefined,
    studentName: row.student_name ?? undefined,
    className: undefined,
    thread_id: row.thread_id ?? row.session_id,
  }
}

function DashboardInner() {
  const [view, setView] = useState<View>("home")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const [studentContext, setStudentContext] = useState<StudentContext | null>(null)
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [apiStudents, setApiStudents] = useState<Student[] | null>(null)
  const [apiClasses, setApiClasses] = useState<Class[] | null>(null)
  const [apiRecentChats, setApiRecentChats] = useState<ChatSession[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [studentsRes, sessionsRes] = await Promise.all([
          apiGet<Record<string, unknown>[]>(`/students`),
          apiGet<Record<string, unknown>[]>(`/sessions/recent`).catch(() => []),
        ])
        if (cancelled) return
        const arr = Array.isArray(studentsRes) ? studentsRes : []
        const students = arr.map((row) =>
          mapApiStudentToStudent(row as { student_id: number; name_en?: string | null; name_ar?: string | null; class_name?: string | null; grade?: string | null })
        )
        setApiStudents(students)
        setApiClasses(deriveClassesFromStudents(students))
        const sessions = Array.isArray(sessionsRes) ? sessionsRes : []
        setApiRecentChats(sessions.map((s) => mapRecentSessionToChatSession(s as Parameters<typeof mapRecentSessionToChatSession>[0])))
      } catch {
        if (!cancelled) {
          setApiStudents([])
          setApiClasses([])
          setApiRecentChats([])
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // agent state from chat
  const [agentSession, setAgentSession] = useState<any>(null)
  const [planState, setPlanState] = useState<PlanState | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<unknown[]>([])
  const [approvedPlanModules, setApprovedPlanModules] = useState<Set<string>>(new Set())
  const [activityLog, setActivityLog] = useState<AssistantActivityEntry[]>([])
  const [planTriggerMessage, setPlanTriggerMessage] = useState<string | null>(null)
  const [reviseLoading, setReviseLoading] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)
  const [sessionThreadId, setSessionThreadId] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<import("@/lib/types").ChatMessage[] | null>(null)
  const [lastChatMessages, setLastChatMessages] = useState<import("@/lib/types").ChatMessage[]>([])

  const handleSelectClass = (cls: Class) => {
    setSelectedClass(cls)
    setView("class-detail")
  }

  const handleSelectStudent = async (student: Student) => {
    // ✅ Ensure numeric id for backend
    const studentIdNum = toStudentIdNumber(student)
    if (!studentIdNum) {
      setSelectedStudent(student)
      setStudentContext(null)
      setContextPanelOpen(true)
      setView("chat")
      return
    }

    const patchedStudent = { ...student, student_id: studentIdNum } as Student
    setSelectedStudent(patchedStudent)
    setView("chat")

    // ✅ reset agent state per student
    setAgentSession(null)
    setPlanState(null)
    setPendingUpdates([])
    setApprovedPlanModules(new Set())
    setActivityLog([])
    setPlanTriggerMessage(null)
    setSessionThreadId(null)
    setSessionMessages(null)

    // ✅ fetch DB profile and build context
    setStudentContext(null)
    setContextPanelOpen(true)

    const db = await fetchStudentFromDb(studentIdNum)
    if (!db) {
      // still open panel but show "not loaded"
      setStudentContext({
        studentId: String(studentIdNum),
        studentName: student.name,
        className: student.className,
        grade: null,
        nameEn: null,
        nameAr: null,
        diagnosis: null,
        severityLevel: null,
        previousAssessment: null,
        lastPlanDate: null,
        planVersion: null,
        summary: null,
        alerts: null,
        assessments: null,
      })
      return
    }

    setStudentContext(mapDbToContext(patchedStudent, db))
  }

  const handleSelectChat = async (chat: ChatSession) => {
    const students = apiStudents ?? mockStudents
    const student = chat.studentId
      ? students.find((s) => s.id === chat.studentId || String((s as Student).student_id) === chat.studentId)
      : null
    if (student) {
      const threadId = "thread_id" in chat && typeof (chat as { thread_id?: string }).thread_id === "string"
        ? (chat as { thread_id: string }).thread_id
        : chat.id
      try {
        const res = await apiGet<{ messages?: Array<{ role?: string; content?: string }> }>(
          `/sessions/${threadId}/messages`
        )
        const raw = res?.messages ?? []
        const mapped: import("@/lib/types").ChatMessage[] = raw.map((m, i) => ({
          id: `load-${i}-${m.content?.slice(0, 8) ?? ""}`,
          role: m.role === "user" ? "teacher" : "assistant",
          content: m.content ?? "",
          timestamp: new Date(),
        }))
        const studentIdNum = toStudentIdNumber(student)
        const patchedStudent = { ...student, student_id: studentIdNum } as Student
        setSelectedStudent(patchedStudent)
        setView("chat")
        setContextPanelOpen(true)
        setSessionThreadId(threadId)
        setSessionMessages(mapped.length > 0 ? mapped : null)
        setAgentSession(null)
        setPlanState(null)
        setPendingUpdates([])
        setApprovedPlanModules(new Set())
        setActivityLog([])
        setPlanTriggerMessage(null)
        setStudentContext(null)
        if (studentIdNum) {
          const db = await fetchStudentFromDb(studentIdNum)
          if (db) setStudentContext(mapDbToContext(patchedStudent, db))
          else
            setStudentContext({
              studentId: String(studentIdNum),
              studentName: student.name,
              className: student.className,
              grade: null,
              nameEn: null,
              nameAr: null,
              diagnosis: null,
              severityLevel: null,
              previousAssessment: null,
              lastPlanDate: null,
              planVersion: null,
              summary: null,
              alerts: null,
              assessments: null,
            })
        }
        return
      } catch {
        void handleSelectStudent(student)
        return
      }
    }
    setSelectedStudent(null)
    setStudentContext(null)
    setContextPanelOpen(false)
    setAgentSession(null)
    setPlanState(null)
    setSessionThreadId(null)
    setSessionMessages(null)
    setView("chat")
  }

  const handleNavigate = (target: string) => {
    if (target === "home") {
      setView("home")
      setSelectedClass(null)
      setSelectedStudent(null)
      setStudentContext(null)
      setContextPanelOpen(false)
      setAgentSession(null)
      setPlanState(null)
      setPendingUpdates([])
      setApprovedPlanModules(new Set())
      setActivityLog([])
      setPlanTriggerMessage(null)
    } else if (target === "classes") {
      setView("classes")
    } else if (target === "students") {
      setView("students")
    }
  }

  const handleBackFromClassDetail = () => {
    setSelectedClass(null)
    setView("classes")
  }

  const studentsForClass = selectedClass
    ? (apiStudents ?? mockStudents).filter((s) => s.classId === selectedClass.id)
    : (apiStudents ?? mockStudents)

  const studentsForSidebar = apiStudents ?? mockStudents
  const classesForSidebar = apiClasses ?? mockClasses
  const recentChatsForSidebar = apiRecentChats ?? mockRecentChats

  return (
    <div className="flex h-svh bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelectClass={handleSelectClass}
        onSelectStudent={(s) => void handleSelectStudent(s)}
        onSelectChat={handleSelectChat}
        onNavigate={handleNavigate}
        onOpenSettings={() => setSettingsOpen(true)}
        currentView={view}
        selectedClassId={selectedClass?.id}
        students={studentsForSidebar}
        classes={classesForSidebar}
        recentChats={recentChatsForSidebar}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {view === "home" && (
          <HomeView
            onSelectStudent={(s) => void handleSelectStudent(s)}
            onSelectClass={handleSelectClass}
            students={studentsForSidebar}
            classes={classesForSidebar}
          />
        )}

        {view === "classes" && <ClassesView classes={classesForSidebar} onSelectClass={handleSelectClass} />}

        {view === "class-detail" && selectedClass && (
          <StudentsView
            students={studentsForClass}
            currentClass={selectedClass}
            onSelectStudent={(s) => void handleSelectStudent(s)}
            onBack={handleBackFromClassDetail}
          />
        )}

        {view === "students" && (
          <StudentsView students={studentsForSidebar} onSelectStudent={(s) => void handleSelectStudent(s)} />
        )}

        {view === "chat" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ChatPanel
                selectedStudent={selectedStudent}
                threadId={sessionThreadId}
                initialMessages={sessionMessages ?? undefined}
                triggerMessage={planTriggerMessage}
                onTriggerMessageSent={() => setPlanTriggerMessage(null)}
                onMessagesChange={(msgs) => setLastChatMessages(msgs)}
                onBackendUpdate={({ session, plan, plan_id, thread_id, tags_found, suggested_student_id, proposed_updates }) => {
                  setAgentSession(session)
                  if (plan) {
                    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
                      console.debug("[Plan] Setting currentPlan from backend", { planId: plan_id, planLength: plan?.length })
                    }
                    setPlanState({
                      status: "proposed",
                      content: plan,
                    })
                    setActivityLog((prev) => {
                      const next = prev.filter((e) => e.id !== "plan-draft" && e.id !== "plan-waiting")
                      return [...next, { id: "plan-draft", label: "Generated draft plan" }, { id: "plan-waiting", label: "Waiting for teacher approval" }]
                    })
                  }
                  if (proposed_updates != null && Array.isArray(proposed_updates)) setPendingUpdates(proposed_updates)
                  if (session && Object.keys(session).length > 0) {
                    setActivityLog((prev) => {
                      const next = prev.filter((e) => e.id !== "profile")
                      return [...next, { id: "profile", label: "Collected student profile" }]
                    })
                  }
                }}
              />
              </div>

            {contextPanelOpen && studentContext && (
              <div className="hidden min-h-0 w-[780px] shrink-0 flex-col overflow-hidden border-s border-border lg:flex xl:w-[900px]">
                <ContextPanel
                  context={studentContext}
                  planState={planState}
                  proposedUpdates={pendingUpdates.length > 0 ? pendingUpdates : undefined}
                  activityLog={activityLog}
                  onClose={() => setContextPanelOpen(false)}
                  onApprovePending={(index) => setPendingUpdates((prev) => prev.filter((_, i) => i !== index))}
                  onRejectPending={(index) => setPendingUpdates((prev) => prev.filter((_, i) => i !== index))}
                  onApprovePlanModule={(id) => setApprovedPlanModules((prev) => new Set(prev).add(id))}
                  onDeclinePlan={() => {
                    if (!planState?.content) return
                    setPlanState((prev) => (prev ? { ...prev, status: "declined" as const } : null))
                    setActivityLog((prev) => [...prev, { id: `decline-${Date.now()}`, label: "Plan declined — send feedback to revise" }])
                  }}
                  onApprovePlan={() => {
                    if (!planState?.content) return
                    setPlanState((prev) => (prev ? { ...prev, status: "approved" as const } : null))
                    setActivityLog((prev) => [...prev, { id: `approved-${Date.now()}`, label: "Plan approved" }])
                  }}
                  onSendDeclineFeedback={async (feedback) => {
                    const studentIdNum = toStudentIdNumber(selectedStudent!)
                    const current = planState?.content
                    if (!studentIdNum || !current) return
                    setReviseError(null)
                    setActivityLog((prev) => [...prev, { id: `revising-${Date.now()}`, label: "Revising plan…" }])
                    setReviseLoading(true)
                    const recentTurns = lastChatMessages
                      .filter((m) => m.role && m.content?.trim())
                      .slice(-6)
                      .map((m) => ({
                        role: m.role === "teacher" ? "user" : "assistant",
                        content: m.content.trim(),
                      }))
                    try {
                      const res = await postPlanRevise({
                        student_id: studentIdNum,
                        current_plan: current,
                        feedback: feedback.trim() || "Please revise the plan.",
                        context: {
                          preferred_language: "en",
                          studentProfile: studentContext ? {
                            studentName: studentContext.studentName,
                            className: studentContext.className,
                            grade: studentContext.grade,
                            diagnosis: studentContext.diagnosis,
                            severityLevel: studentContext.severityLevel,
                          } : undefined,
                          approvedUpdates: pendingUpdates.length > 0 ? pendingUpdates : undefined,
                          recentTeacherNotes: [],
                          recentChatTurns: recentTurns.length > 0 ? recentTurns : undefined,
                        },
                      })
                      setPlanState({
                        status: "proposed",
                        content: res.revised_plan,
                        revisedAt: new Date().toISOString(),
                      })
                      setActivityLog((prev) => [...prev, { id: `revised-${Date.now()}`, label: "Plan revised" }])
                    } catch {
                      setReviseError("Failed to revise plan. Please try again.")
                    } finally {
                      setReviseLoading(false)
                    }
                  }}
                  reviseLoading={reviseLoading}
                  reviseError={reviseError}
                  onGeneratePlan={() => setPlanTriggerMessage("Generate a weekly plan based only on the student's profile and any approved updates.")}
                  onSavePlan={() => {
                    setPlanState((prev) => (prev ? { ...prev, status: "approved" as const } : null))
                    setActivityLog((prev) => [...prev, { id: `approved-${Date.now()}`, label: "Plan approved" }])
                  }}
                  approvedModuleIds={approvedPlanModules}
                />
              </div>
            )}
          </div>
          </div>
        )}
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

export function Dashboard() {
  return <DashboardInner />
}