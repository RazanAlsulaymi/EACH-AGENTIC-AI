import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../../context/AppContext'
import { api } from '../../../api/client'

function SessionRow({ session }) {
  const { language } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  useEffect(() => {
    if (!open || !session?.session_id) return
    setMessagesLoading(true)
    api.getSessionMessages(session.session_id)
      .then((data) => setMessages(data?.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false))
  }, [open, session?.session_id])

  const dateStr = session?.date || session?.created_at
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            {dateStr ? new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : undefined) : '—'}
          </span>
          {session.difficulty_reported && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]">{session.difficulty_reported}</span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50">
          {/* Session metadata */}
          {(session.difficulty_reported || session.triggers_noted || session.strategies_tried || session.support_needed) && (
            <div className="px-4 py-3 space-y-2 text-xs text-gray-700 border-b border-gray-100">
              {session.difficulty_reported && (
                <p><span className="font-medium">{language === 'ar' ? 'الصعوبة:' : 'Difficulty:'}</span> {session.difficulty_reported}</p>
              )}
              {session.triggers_noted && (
                <p><span className="font-medium">{language === 'ar' ? 'المحفزات:' : 'Triggers:'}</span> {session.triggers_noted}</p>
              )}
              {session.strategies_tried && (
                <p><span className="font-medium">{language === 'ar' ? 'الاستراتيجيات:' : 'Strategies:'}</span> {session.strategies_tried}</p>
              )}
              {session.support_needed && (
                <p><span className="font-medium">{language === 'ar' ? 'الدعم المطلوب:' : 'Support needed:'}</span> {session.support_needed}</p>
              )}
            </div>
          )}
          {/* Full conversation */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {language === 'ar' ? 'المحادثة الكاملة' : 'Full conversation'}
            </p>
            {messagesLoading ? (
              <p className="text-xs text-gray-400 py-4">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-gray-400 py-4">{language === 'ar' ? 'لا توجد رسائل مسجلة' : 'No messages recorded'}</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                        m.role === 'user'
                          ? 'bg-gray-900 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}
                      dir={m.role === 'user' ? (language === 'ar' ? 'rtl' : 'ltr') : (language === 'ar' ? 'rtl' : 'ltr')}
                    >
                      {m.content || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SessionsTab({ student }) {
  const { language } = useApp()
  const sessions = student?.full_profile?.sessions || student?.sessions || []

  return (
    <div className="p-6">
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {language === 'ar' ? 'لا توجد جلسات مسجلة' : 'No sessions recorded yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <SessionRow key={s.id || i} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
