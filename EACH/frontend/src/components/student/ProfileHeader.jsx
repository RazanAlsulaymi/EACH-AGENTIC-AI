import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'
import { diagnosisBadge } from '../classes/StudentCard'

export default function ProfileHeader({ student }) {
  const { language, setActiveStudentId } = useApp()
  const tr = useTranslation(language)
  const navigate = useNavigate()

  if (!student) return null

  const handleStartSession = () => {
    setActiveStudentId(student.student_id)
    navigate('/chat', { state: { studentId: student.student_id } })
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600">
            {(student.name_en || student.name_ar || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {student.name_en}
              {student.name_ar && (
                <span className="text-gray-500 font-medium mr-2 ml-2" dir="rtl">
                  / {student.name_ar}
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {student.grade && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {language === 'ar' ? `الصف ${student.grade}` : `Grade ${student.grade}`}
                </span>
              )}
              {student.diagnosis && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${diagnosisBadge(student.diagnosis)}`}>
                  {student.diagnosis}
                </span>
              )}
              {student.severity_level && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {student.severity_level}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Start session button */}
        <button
          onClick={handleStartSession}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <MessageCircle size={16} />
          {tr.startSession}
        </button>
      </div>
    </div>
  )
}
