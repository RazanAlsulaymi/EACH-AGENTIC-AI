import { useState } from 'react'
import { ChevronDown, CheckCircle, Clock, FileText, Star } from 'lucide-react'
import { useApp } from '../../../context/AppContext'
import { sanitizePlanForDisplay } from '../../../hooks/useChat'

function StarRating({ score, max = 5 }) {
  if (!score) return null
  return (
    <span className="flex items-center gap-0.5" title={`${score}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={12}
          className={i < score ? 'fill-amber-400 text-amber-500' : 'text-gray-200'}
        />
      ))}
    </span>
  )
}

function PlanCard({ plan }) {
  const { language } = useApp()
  const [open, setOpen] = useState(false)
  const isApproved = plan.teacher_approved
  const weekStart = plan.week_start_date || plan.week_start

  const en = sanitizePlanForDisplay(plan.plan_content_en || '').trim()
  const ar = sanitizePlanForDisplay(plan.plan_content_ar || '').trim()
  const displayContent = language === 'ar' ? (ar || en) : (en || ar)
  const preview = displayContent.slice(0, 100)

  const weekLabel = weekStart
    ? new Date(weekStart).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  return (
    <article
      className={`
        relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300
        ${isApproved
          ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30'
          : 'border-amber-200 bg-gradient-to-br from-white to-amber-50/30'
        }
      `}
    >
      {/* Accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${isApproved ? 'bg-emerald-500' : 'bg-amber-400'}`}
        aria-hidden
      />

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 pl-6 py-4 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`
                  inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg
                  ${isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}
                `}
              >
                {isApproved ? <CheckCircle size={12} /> : <Clock size={12} />}
                {language === 'ar' ? (isApproved ? 'معتمدة' : 'معلقة') : isApproved ? 'Approved' : 'Pending'}
              </span>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                v{plan.version || 1}
              </span>
              {plan.teacher_score != null && (
                <StarRating score={plan.teacher_score} />
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900">{weekLabel}</p>
            {!open && preview && (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{preview}…</p>
            )}
          </div>
          <div
            className={`
              flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
              transition-transform duration-200
              ${open ? 'rotate-180 bg-gray-100' : 'bg-gray-50'}
            `}
          >
            <ChevronDown size={18} className="text-gray-500" />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100/80 bg-white/60">
          <div
            className={`
              p-5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap
              ${language === 'ar' ? 'text-right' : ''}
            `}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {displayContent || '—'}
          </div>
        </div>
      )}
    </article>
  )
}

export default function PlansTab({ student }) {
  const { language } = useApp()
  const plans = Array.isArray(student?.plans) ? student.plans : (student?.full_profile?.plans || [])

  return (
    <div className="p-6 max-w-4xl">
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-emerald-100 flex items-center justify-center mb-6">
            <FileText size={36} className="text-amber-600/80" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">
            {language === 'ar' ? 'لم تُنشأ خطط بعد' : 'No plans yet'}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {language === 'ar'
              ? 'أنشئ خطة أسبوعية من خلال بدء جلسة محادثة مع EACH وطلب إنشاء خطة للطالب.'
              : 'Generate a weekly plan by starting a chat session with EACH and asking for a plan.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((p, i) => (
            <PlanCard key={p.plan_id || p.id || i} plan={p} />
          ))}
        </div>
      )}
    </div>
  )
}
