import { useState, useEffect } from 'react'
import { X, Save, Check, XCircle, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, FileText, Sparkles } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { splitPlan, sanitizePlanForDisplay } from '../../hooks/useChat'
import { api } from '../../api/client'

function CollapsiblePlanCard({ title, content, isApproved, defaultOpen = false, language }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!content) return null
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-card-foreground">{title}</span>
          {isApproved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <Check className="size-3" /> {language === 'ar' ? 'معتمدة' : 'Approved'}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-card-foreground">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

function PreviousSessionRow({ session }) {
  const { language } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const threadId = session.thread_id ?? session.session_id ?? session.id

  useEffect(() => {
    if (!open || !threadId) return
    setLoading(true)
    api.getSessionMessages(threadId)
      .then((data) => setMessages(data?.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [open, threadId])

  const dateStr = session.date || session.created_at
  const preview = session.preview || session.title || 'Session'

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-card-foreground">
            {dateStr ? new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : undefined) : '—'}
          </span>
          <span className="truncate text-xs text-muted-foreground">{preview}</span>
        </div>
        {open ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {language === 'ar' ? 'المحادثة الكاملة' : 'Full conversation'}
          </p>
          {loading ? (
            <p className="py-4 text-xs text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
          ) : messages.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد رسائل مسجلة' : 'No messages recorded'}</p>
          ) : (
            <div className="max-h-[280px] space-y-3 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'border border-border bg-card text-card-foreground rounded-bl-sm'
                    }`}
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {m.content || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContextPanel({
  context,
  planState,
  savedPlans = [],
  uploadedFiles = [],
  recentSessions = [],
  collapsed = false,
  onToggleCollapse,
  onClose,
  onApprovePlan,
  onDeclinePlan,
  onSendDeclineFeedback,
  onGeneratePlan,
  onSavePlan,
  reviseLoading = false,
  reviseError = null,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [teacherNotes, setTeacherNotes] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [declineFeedback, setDeclineFeedback] = useState('')
  const [activeTab, setActiveTab] = useState('summary')

  const planContent = planState?.content ?? ''
  const planStatus = planState?.status ?? 'proposed'
  const diagnosis = context?.diagnosis?.trim() || null
  const supportLevel = context?.severityLevel?.trim() || null
  const baselineNotes = context?.previousAssessment?.trim() || null
  const headerSubtitle = (context?.className || context?.grade || '').trim() || '—'

  const { en, ar } = splitPlan(planContent)
  const planDisplay = planContent
    ? (language === 'ar' && ar ? ar : (en || planContent))
    : null

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-card ${collapsed ? 'border-l border-border' : 'border-l border-border'}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-3">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={language === 'ar' ? 'توسيع' : 'Expand panel'}
          >
            <PanelRightOpen className="size-5" />
          </button>
        ) : (
          <>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {(context?.studentName || '?')[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-card-foreground">{context?.studentName}</span>
            <span className="text-xs text-muted-foreground">{headerSubtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSavePlan}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={language === 'ar' ? 'حفظ' : 'Save'}
          >
            <Save className="size-4" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={language === 'ar' ? 'طي' : 'Collapse panel'}
            >
              <PanelRightClose className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="size-4" />
          </button>
        </div>
          </>
        )}
      </div>

      {!collapsed && (
      <>
      <div className="flex shrink-0 gap-1 border-b border-border px-5 pt-4">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {language === 'ar' ? 'الملخص' : 'Summary'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'plan'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tr.plans}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-5 px-5 py-5 pb-8">
            <SectionCard title={language === 'ar' ? 'ملف الطالب' : 'Student profile'}>
              <div className="flex flex-wrap gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{language === 'ar' ? 'الاسم' : 'Name'}</p>
                  <p className="text-sm font-medium text-card-foreground">{context?.studentName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{language === 'ar' ? 'الفصل' : 'Class'}</p>
                  <p className="text-sm font-medium text-card-foreground">{headerSubtitle}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={language === 'ar' ? 'التشخيص' : 'Diagnosis'}>
              <p className="text-sm text-card-foreground">{diagnosis || (language === 'ar' ? 'غير مسجل' : 'Not recorded')}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {language === 'ar' ? 'مستوى الدعم' : 'Support level'}: {supportLevel || (language === 'ar' ? 'غير مسجل' : 'Not recorded')}
              </p>
            </SectionCard>

            {uploadedFiles.length > 0 && (
              <SectionCard title={language === 'ar' ? 'تحليلات المستندات' : 'Document analysis updates'}>
                <div className="space-y-4">
                  {uploadedFiles.map((f, i) => (
                    <div
                      key={f.file_id || i}
                      className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-200/80"
                    >
                      <div className="absolute right-0 top-0 h-20 w-20 -translate-y-4 translate-x-4 rounded-full bg-indigo-100/60 opacity-60 group-hover:opacity-80" aria-hidden />
                      <div className="relative flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 ring-2 ring-indigo-100/80">
                          <FileText size={20} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                              {f.file_type || 'Document'}
                            </span>
                            {f.language_detected && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {f.language_detected === 'ar' ? 'عربي' : 'English'}
                              </span>
                            )}
                          </div>
                          {f.key_insights && (
                            <div className="mt-3 flex gap-2">
                              <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500" strokeWidth={2} />
                              <p className="text-sm leading-relaxed text-slate-700">
                                {f.key_insights}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard title={language === 'ar' ? 'ملاحظات من الجلسات السابقة' : 'Notes from previous sessions'}>
              {baselineNotes ? (
                <p className="text-sm leading-relaxed text-card-foreground">{baselineNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'لا توجد ملاحظات.' : 'No baseline assessment recorded.'}
                </p>
              )}
            </SectionCard>

            <SectionCard title={language === 'ar' ? 'المحادثات السابقة' : 'Previous conversations'}>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'لا توجد محادثات مسجلة' : 'No previous conversations yet'}
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((s, i) => (
                    <PreviousSessionRow key={s.id || s.session_id || i} session={s} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={language === 'ar' ? 'ملاحظات المعلم' : 'Teacher notes'}>
              <textarea
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
                placeholder={language === 'ar' ? 'ملاحظاتك الخاصة عن هذا الطالب…' : 'Your private notes about this student…'}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </SectionCard>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="flex flex-col px-5 py-4 pb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-card-foreground">
                {language === 'ar' ? 'الخطة الأسبوعية' : 'Weekly support plan'}
              </h3>
              <span className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {planContent && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {planStatus === 'approved' ? tr.approve_verb : planStatus === 'declined' ? tr.requestChanges : 'Draft'}
                </span>
              )}
              {onGeneratePlan && (
                <button
                  type="button"
                  onClick={onGeneratePlan}
                  className="ml-auto rounded-lg border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {language === 'ar' ? 'إعادة إنشاء' : 'Regenerate'}
                </button>
              )}
            </div>

            {planContent && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {onApprovePlan && planStatus !== 'approved' && (
                  <button
                    type="button"
                    onClick={onApprovePlan}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Check className="size-3.5" /> {tr.approve}
                  </button>
                )}
                {onDeclinePlan && planStatus !== 'declined' && planStatus !== 'approved' && (
                  <button
                    type="button"
                    onClick={onDeclinePlan}
                    className="flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <XCircle className="size-3.5" /> {tr.requestChanges}
                  </button>
                )}
              </div>
            )}

            {planContent && planStatus === 'declined' && (
              <div className="mb-4 flex gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
                {reviseError && <p className="mb-2 text-xs text-red-600">{reviseError}</p>}
                <input
                  type="text"
                  value={declineFeedback}
                  onChange={(e) => setDeclineFeedback(e.target.value)}
                  placeholder={tr.feedbackPlaceholder}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={reviseLoading}
                />
                <button
                  type="button"
                  onClick={() => {
                    const fb = declineFeedback.trim() || tr.feedbackPlaceholder
                    onSendDeclineFeedback?.(fb)
                    setDeclineFeedback('')
                  }}
                  disabled={reviseLoading}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {reviseLoading ? (language === 'ar' ? 'جاري الإرسال…' : 'Sending…') : tr.send}
                </button>
              </div>
            )}

            {(planDisplay || savedPlans.length > 0) ? (
              <div className="space-y-3">
                {planDisplay ? (
                  <CollapsiblePlanCard
                    title={language === 'ar' ? 'الخطة الحالية' : 'Current plan'}
                    content={planDisplay}
                    isApproved={planStatus === 'approved'}
                    defaultOpen={true}
                    language={language}
                  />
                ) : (
                savedPlans.map((p, i) => {
                  const content = sanitizePlanForDisplay(
                    language === 'ar' && (p.plan_content_ar || '').trim()
                      ? p.plan_content_ar
                      : (p.plan_content_en || p.plan_content_ar || '')
                  )
                  if (!content) return null
                  const weekStart = p.week_start_date || p.week_start
                  const weekLabel = weekStart
                    ? new Date(weekStart).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : `v${p.version || 1}`
                  return (
                    <CollapsiblePlanCard
                      key={p.plan_id || p.id || i}
                      title={weekLabel}
                      content={content}
                      isApproved={p.teacher_approved}
                      defaultOpen={false}
                      language={language}
                    />
                  )
                })
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {language === 'ar' ? 'لا توجد خطة بعد.' : 'No plan yet.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === 'ar' ? 'اطلب من المساعد إنشاء خطة أسبوعية.' : 'Ask the assistant to create a weekly plan.'}
                </p>
                {onGeneratePlan && (
                  <button
                    type="button"
                    onClick={onGeneratePlan}
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    {language === 'ar' ? 'إنشاء خطة' : 'Generate plan'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}
