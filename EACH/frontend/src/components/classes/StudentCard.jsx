import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

export function diagnosisBadge(diagnosis = '') {
  const d = diagnosis.toLowerCase()
  if (d.includes('adhd') || d.includes('attention')) return 'bg-blue-100 text-blue-700'
  if (d.includes('autism')) return 'bg-purple-100 text-purple-700'
  if (d.includes('dyslexia') || d.includes('reading')) return 'bg-orange-100 text-orange-700'
  if (d.includes('processing')) return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

function planStatusStyle(status) {
  if (status === 'done' || status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'pending' || status === 'generated') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

export default function StudentCard({ student }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const navigate = useNavigate()
  const s = student

  return (
    <div
      onClick={() => navigate(`/student/${s.student_id}`)}
      className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-600 flex-shrink-0">
            {(s.name_en || s.name_ar || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight">{s.name_en}</p>
            {s.name_ar && <p className="text-xs text-gray-500 leading-tight" dir="rtl">{s.name_ar}</p>}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${diagnosisBadge(s.diagnosis)}`}>
          {s.diagnosis || '—'}
        </span>
        {s.severity_level && (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
            {s.severity_level}
          </span>
        )}
      </div>

      {/* Plan status */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${planStatusStyle(s.plan_status)}`}>
          {s.plan_status === 'done' || s.plan_status === 'approved' ? tr.planDone
            : s.plan_status === 'pending' || s.plan_status === 'generated' ? tr.planPending
            : tr.planNone}
        </span>
        {s.last_session_date && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={11} />
            {new Date(s.last_session_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
