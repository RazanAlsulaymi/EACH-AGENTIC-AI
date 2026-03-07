import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SidebarV2 from '../components/v2/SidebarV2'
import HomeView from '../components/v2/HomeView'
import ClassesAndStudentsView from '../components/v2/ClassesAndStudentsView'
import ChatPanelV2 from '../components/v2/ChatPanelV2'
import ContextPanel from '../components/v2/ContextPanel'
import { useApp } from '../context/AppContext'
import { useChat } from '../hooks/useChat'
import { api } from '../api/client'

function toStudentIdNumber(student) {
  if (!student) return null
  const raw = student.student_id ?? student.id
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const str = String(raw).trim()
  const n = Number(str.replace(/^s/i, ''))
  return Number.isFinite(n) ? n : null
}

function mapApiStudent(s) {
  const id = String(s.student_id ?? s.id ?? '')
  const name = (s.name_en || s.name_ar || '').trim() || 'Student'
  const classId = (s.class_name || s.grade || s.class_id || '').toString().trim() || '—'
  return {
    id,
    name,
    classId,
    className: classId,
    student_id: s.student_id,
    name_en: s.name_en,
    name_ar: s.name_ar,
    class_name: s.class_name,
    grade: s.grade,
    diagnosis: s.diagnosis,
    severity_level: s.severity_level,
    plan_status: s.plan_status,
    last_session_date: s.last_session_date,
  }
}

function deriveClasses(students) {
  const byClass = new Map()
  for (const s of students) {
    const key = s.className || s.classId || '—'
    if (!byClass.has(key)) byClass.set(key, [])
    byClass.get(key).push(s)
  }
  return Array.from(byClass.entries()).map(([id, list]) => ({
    id,
    name: id,
    studentCount: list.length,
  }))
}

function mapRecentSession(row) {
  return {
    id: row.session_id || row.id,
    title: (row.preview || 'Session').slice(0, 80),
    studentId: row.student_id != null ? String(row.student_id) : undefined,
    studentName: row.student_name,
    className: row.class_name,
    preview: row.preview,
    thread_id: row.thread_id ?? row.session_id,
  }
}

function makeThreadId(studentId) {
  const today = new Date().toISOString().slice(0, 10)
  return `student_${studentId}_${today}`
}

function buildContext(student, db) {
  return {
    studentId: String(db?.student_id ?? toStudentIdNumber(student) ?? ''),
    studentName: (db?.name_en || db?.name_ar || student?.name || '').trim() || '—',
    className: (db?.class_name ?? db?.grade ?? student?.className ?? '').trim() || '—',
    grade: db?.grade ?? null,
    diagnosis: db?.diagnosis ?? null,
    severityLevel: db?.severity_level ?? null,
    previousAssessment: db?.previous_assessment ?? null,
  }
}

export default function DashboardV2() {
  const navigate = useNavigate()
  const { students: apiStudentsRaw, loadStudents, language } = useApp()
  const [view, setView] = useState('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentContext, setStudentContext] = useState(null)
  const [savedPlans, setSavedPlans] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [recentChats, setRecentChats] = useState([])
  const [planState, setPlanState] = useState(null)
  const [sessionThreadId, setSessionThreadId] = useState(null)
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false)

  const students = useMemo(
    () => (Array.isArray(apiStudentsRaw) ? apiStudentsRaw.map(mapApiStudent) : []),
    [apiStudentsRaw]
  )
  const classes = useMemo(() => deriveClasses(students), [students])

  const threadId = useMemo(() => {
    const sid = toStudentIdNumber(selectedStudent)
    return sid ? makeThreadId(sid) : null
  }, [selectedStudent])

  const {
    messages,
    plan,
    planApproved,
    isLoading,
    processStatus,
    error,
    sendMessage,
    approvePlan,
    requestChanges,
    reset,
  } = useChat(
    toStudentIdNumber(selectedStudent),
    selectedStudent?.name,
    sessionThreadId
  )

  const refreshRecentSessions = useCallback(() => {
    api.getRecentSessions()
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setRecentChats(arr.map(mapRecentSession))
      })
      .catch(() => setRecentChats([]))
  }, [])

  useEffect(() => {
    refreshRecentSessions()
  }, [refreshRecentSessions])

  useEffect(() => {
    if (plan) setPlanState({ content: plan, status: planApproved ? 'approved' : 'proposed' })
  }, [plan, planApproved])

  const fetchStudentContext = useCallback(async (student) => {
    const sid = toStudentIdNumber(student)
    if (!sid) {
      setStudentContext(buildContext(student, null))
      setSavedPlans([])
      setUploadedFiles([])
      return
    }
    try {
      const db = await api.getStudent(sid)
      const ctx = buildContext(student, db?.student ?? db)
      setStudentContext(ctx)
      setSavedPlans(Array.isArray(db?.plans) ? db.plans : [])
      setUploadedFiles(Array.isArray(db?.files) ? db.files : [])
    } catch {
      setStudentContext(buildContext(student, null))
      setSavedPlans([])
      setUploadedFiles([])
    }
  }, [])

  const handleSelectClass = (cls) => {
    setSelectedClass(cls)
    setView('classes')
  }

  const handleSelectStudent = (student) => {
    setSelectedStudent(student)
    setSessionThreadId(null)
    setView('chat')
    setContextPanelOpen(true)
    reset()
    setPlanState(null)
    fetchStudentContext(student)
  }

  const handleSelectChat = async (chat) => {
    const student = chat.studentId
      ? students.find((s) => String(s.student_id || s.id) === chat.studentId)
      : null
    const threadId = chat.thread_id ?? chat.id ?? chat.session_id
    if (student && threadId) {
      setSelectedStudent(student)
      setSessionThreadId(threadId)
      setView('chat')
      setContextPanelOpen(true)
      reset()
      setPlanState(null)
      fetchStudentContext(student)
    } else if (student) {
      setSelectedStudent(student)
      setSessionThreadId(null)
      setView('chat')
      setContextPanelOpen(true)
      reset()
      fetchStudentContext(student)
    } else {
      setSelectedStudent(null)
      setSessionThreadId(null)
      setContextPanelOpen(false)
      setView('chat')
    }
  }

  const handleNavigate = (target) => {
    if (target === 'home') {
      setView('home')
      setSelectedClass(null)
      setSelectedStudent(null)
      setStudentContext(null)
      setSavedPlans([])
      setUploadedFiles([])
      setContextPanelOpen(false)
      setSessionThreadId(null)
      setPlanState(null)
    } else if (target === 'classes') {
      setView('classes')
      setSavedPlans([])
      setUploadedFiles([])
    } else if (target === 'chat') {
      setView('chat')
    }
  }

  const handleAttachFile = useCallback(
    async (file) => {
      const sid = toStudentIdNumber(selectedStudent)
      const tid = sessionThreadId || (sid ? makeThreadId(sid) : null)
      if (!sid) throw new Error(language === 'ar' ? 'اختر طالباً أولاً' : 'Select a student first')
      const res = await api.analyzeFile(file, sid, 'IEP', tid)
      const insights = res?.key_insights || ''
      // Only send to chat when we have insights (EACHv3 fix: avoids empty "Key insights:" + potential stream issues)
      if (insights) {
        const msg =
          language === 'ar'
            ? `رفعت ملف "${file.name}". أهم الملاحظات: ${insights}`
            : `I uploaded "${file.name}". Key insights: ${insights}`
        await sendMessage(msg)
        refreshRecentSessions()
        if (selectedStudent) fetchStudentContext(selectedStudent)
      }
    },
    [selectedStudent, sessionThreadId, sendMessage, language, refreshRecentSessions, fetchStudentContext]
  )

  const handleSend = async (text) => {
    const result = await sendMessage(text)
    if (result?.suggestedStudentId && students.length) {
      const found = students.find((s) => s.student_id === result.suggestedStudentId)
      if (found) {
        setSelectedStudent(found)
        setContextPanelOpen(true)
        fetchStudentContext(found)
      }
    }
  }

  const handleOpenSettings = () => navigate('/settings')
  const handleNavigateToDashboard = () => navigate('/dashboard')

  return (
    <div className="flex h-svh bg-background text-foreground">
      <SidebarV2
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onSelectClass={handleSelectClass}
        onSelectStudent={handleSelectStudent}
        onSelectChat={handleSelectChat}
        onNavigate={handleNavigate}
        onOpenSettings={handleOpenSettings}
        onNavigateToDashboard={handleNavigateToDashboard}
        currentView={view}
        selectedClassId={selectedClass?.id}
        students={students}
        classes={classes}
        recentChats={recentChats}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {view === 'home' && (
          <HomeView
            students={students}
            classes={classes}
            onSelectStudent={handleSelectStudent}
            onSelectClass={handleSelectClass}
          />
        )}

        {view === 'classes' && (
          <ClassesAndStudentsView
            students={students}
            onSelectStudent={handleSelectStudent}
          />
        )}

        {view === 'chat' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <ChatPanelV2
                  messages={messages}
                  isLoading={isLoading}
                  processStatus={processStatus}
                  error={error}
                  onSend={handleSend}
                  plan={plan}
                  planApproved={planApproved}
                  onApprove={approvePlan}
                  onRequestChanges={requestChanges}
                  selectedStudent={selectedStudent}
                  onAttachFile={handleAttachFile}
                />
              </div>

              {contextPanelOpen && studentContext && (
                <div
                  className={`hidden min-h-0 shrink-0 flex-col overflow-hidden border-l border-border transition-all duration-200 lg:flex ${
                    contextPanelCollapsed ? 'w-12 xl:w-12' : 'w-[360px] xl:w-[420px]'
                  }`}
                >
                  <ContextPanel
                    collapsed={contextPanelCollapsed}
                    onToggleCollapse={() => setContextPanelCollapsed((c) => !c)}
                    context={studentContext}
                    planState={planState}
                    savedPlans={savedPlans}
                    uploadedFiles={uploadedFiles}
                    recentSessions={recentChats.filter(
                      (c) => c.studentId && String(c.studentId) === String(studentContext.studentId)
                    )}
                    onClose={() => setContextPanelOpen(false)}
                    onApprovePlan={() => {
                      approvePlan(4)
                      setPlanState((p) => (p ? { ...p, status: 'approved' } : null))
                    }}
                    onDeclinePlan={() =>
                      setPlanState((p) => (p ? { ...p, status: 'declined' } : null))
                    }
                    onSendDeclineFeedback={(feedback) => requestChanges(feedback)}
                    onGeneratePlan={() =>
                      handleSend(
                        language === 'ar'
                          ? 'أنشئ خطة أسبوعية بناءً على ملف الطالب والمعطيات المعتمدة.'
                          : "Generate a weekly plan based only on the student's profile and any approved updates."
                      )
                    }
                    onSavePlan={() => {
                      approvePlan(4)
                      setPlanState((p) => (p ? { ...p, status: 'approved' } : null))
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
