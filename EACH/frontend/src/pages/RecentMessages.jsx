import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'
import { api } from '../api/client'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

function relativeTime(ts) {
  if (!ts) return '—'
  const date = typeof ts === 'string' ? new Date(ts) : ts
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}

export default function RecentMessages() {
  const { language, setActiveStudentId } = useApp()
  const tr = useTranslation(language)
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getRecentSessions()
      .then((data) => { if (!cancelled) setRecent(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setRecent([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleOpen = (r) => {
    if (r.student_id) setActiveStudentId(r.student_id)
    navigate('/chat', { state: { studentId: r.student_id, threadId: r.session_id || r.thread_id } })
  }

  return (
    <Layout title={tr.recentMessages}>
      <div className="max-w-2xl mx-auto w-full px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-sm text-gray-400">
              {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
            </p>
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <MessageSquare size={32} className="text-gray-200 mb-4" />
            <p className="text-sm text-gray-400">
              {language === 'ar' ? 'لا توجد محادثات حديثة' : 'No recent conversations yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Collapsible header */}
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-4"
            >
              <span className="text-sm font-medium text-gray-900">
                {recent.length} {language === 'ar' ? 'محادثة حديثة' : 'recent conversation(s)'}
              </span>
              {isExpanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
            </button>

            {/* Collapsible list */}
            {isExpanded && (
          <div className="space-y-2">
            {recent.map((r, i) => (
              <button
                key={r.session_id || i}
                onClick={() => handleOpen(r)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl px-4 py-3.5 hover:shadow-sm hover:border-gray-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                      {(r.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.student_name || (language === 'ar' ? 'جلسة عامة' : 'General session')}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{r.preview || ''}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs text-gray-400">{relativeTime(r.date)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
