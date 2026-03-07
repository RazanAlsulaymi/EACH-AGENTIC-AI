import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'
import { api } from '../../api/client'

function relativeTime(ts) {
  if (!ts) return '—'
  const date = typeof ts === 'string' ? new Date(ts) : ts
  const diff = (Date.now() - (date.getTime ? date.getTime() : date)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ActivityFeed({ students }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let cancelled = false
    api.getRecentSessions()
      .then((data) => { if (!cancelled) setRecent(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setRecent([]) })
    return () => { cancelled = true }
  }, [])

  const activities = recent.slice(0, 7).map((r) => ({
    text: language === 'ar'
      ? `جلسة مع ${students?.find((s) => s.student_id === r.student_id)?.name_ar || r.student_name || 'طالب'}`
      : `Session with ${r.student_name || 'student'}`,
    time: r.date,
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">{tr.recentActivity}</h3>
      </div>
      {activities.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">
          {language === 'ar' ? 'لا يوجد نشاط حديث' : 'No recent activity'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {activities.map((a, i) => (
            <li key={i} className="px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-700">{a.text}</p>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-3">{relativeTime(a.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
