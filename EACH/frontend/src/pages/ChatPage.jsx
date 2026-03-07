import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ChatWindow from '../components/chat/ChatWindow'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'
import { useChat } from '../hooks/useChat'

export default function ChatPage() {
  const { language, teacherName, activeStudentId, setActiveStudentId, students, findStudentByName } = useApp()
  const [searchParams] = useSearchParams()
  const { state } = useLocation()
  const tr = useTranslation(language)
  const navigate = useNavigate()

  const [showStudentSearch, setShowStudentSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Pre-select student and thread from URL or navigation state (e.g. from Recent Messages)
  const preselectedId = searchParams.get('student') || state?.studentId
  const initialThreadId = state?.threadId || null
  useEffect(() => {
    if (preselectedId) {
      const id = typeof preselectedId === 'number' ? preselectedId : parseInt(preselectedId, 10)
      if (!isNaN(id)) setActiveStudentId(id)
    }
  }, [preselectedId, setActiveStudentId])

  const activeStudent = useMemo(
    () => students.find((s) => s.student_id === activeStudentId) || null,
    [students, activeStudentId]
  )

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students.slice(0, 8)
    const q = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.name_en?.toLowerCase().includes(q) ||
        s.name_ar?.includes(searchQuery) ||
        s.class_name?.toLowerCase().includes(q) ||
        (s.class_id && String(s.class_id).includes(q))
    )
  }, [students, searchQuery])

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
    activeStudentId,
    activeStudent?.name_en,
    // Use thread from nav when we came from Recent Messages (matches selected student)
    initialThreadId && preselectedId && String(initialThreadId).startsWith(`student_${preselectedId}_`)
      ? initialThreadId
      : null
  )

  const handleSend = async (text) => {
    if (!activeStudentId) {
      const found = findStudentByName(text)
      if (found) {
        setActiveStudentId(found.student_id)
        await sendMessage(text, { studentIdOverride: found.student_id })
        return
      }
    }
    const result = await sendMessage(text)
    if (result?.suggestedStudentId) setActiveStudentId(result.suggestedStudentId)
  }

  const handleSelectStudent = (student) => {
    setActiveStudentId(student.student_id)
    setShowStudentSearch(false)
    setSearchQuery('')
    reset() // Start fresh — new session, clear previous conversation
  }

  const studentBadge = activeStudent ? (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(`/student/${activeStudent.student_id}`)}
        className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors truncate max-w-[120px]"
      >
        {activeStudent.name_en}
      </button>
      <button
        onClick={() => setActiveStudentId(null)}
        className="text-xs text-gray-500 hover:text-gray-700"
        title={language === 'ar' ? 'تغيير الطالب' : 'Change student'}
      >
        {language === 'ar' ? 'تغيير' : 'Change'}
      </button>
    </div>
  ) : null

  return (
    <Layout rightSlot={studentBadge}>
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        processStatus={processStatus}
        error={error}
        onSend={handleSend}
        plan={plan}
        planApproved={planApproved}
        onApprove={approvePlan}
        onRequestChanges={requestChanges}
        student={activeStudent}
        teacherName={teacherName}
        inputPlaceholder={tr.startTyping}
        onStudentSearchClick={() => setShowStudentSearch(true)}
      />

      {/* Optional student search popover (for when user forgot) */}
      {showStudentSearch && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setShowStudentSearch(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 w-full max-w-md max-h-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mx-4">
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن طالب أو فصل...' : 'Search students, classes...'}
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-400"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-56 p-2">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  {students.length === 0
                    ? (language === 'ar' ? 'لا يوجد طلاب' : 'No students yet')
                    : (language === 'ar' ? 'لم يتم العثور على نتائج' : 'No results')}
                </p>
              ) : (
                filteredStudents.map((s) => (
                  <button
                    key={s.student_id}
                    onClick={() => handleSelectStudent(s)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                      {(s.name_en || s.name_ar || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name_en || s.name_ar}</p>
                      {(s.class_name || s.diagnosis) && (
                        <p className="text-xs text-gray-500 truncate">
                          {[s.class_name, s.diagnosis].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
