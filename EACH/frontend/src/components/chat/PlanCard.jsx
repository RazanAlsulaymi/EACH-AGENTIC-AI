import { useState } from 'react'
import { CheckCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'
import { splitPlan } from '../../hooks/useChat'

export default function PlanCard({ planText, onApprove, onRequestChanges, approved }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [tab, setTab] = useState('en')
  const [score, setScore] = useState(4)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expanded, setExpanded] = useState(true)

  const { en, ar } = splitPlan(planText)

  return (
    <div className="mx-4 my-3 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {language === 'ar' ? '📋 الخطة الأسبوعية المُنشأة' : '📋 Generated Weekly Plan'}
          </span>
          {approved && (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle size={12} /> {language === 'ar' ? 'مُعتمدة' : 'Approved'}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {['en', 'ar'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-gray-900 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'en' ? tr.planTabEn : tr.planTabAr}
              </button>
            ))}
          </div>

          {/* Plan content */}
          <div
            className="px-4 py-3 max-h-72 overflow-y-auto text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-mono"
            dir={tab === 'ar' ? 'rtl' : 'ltr'}
          >
            {tab === 'en' ? en || '—' : ar || '—'}
          </div>

          {/* Actions */}
          {!approved && (
            <div className="px-4 py-3 border-t border-gray-200 space-y-3">
              {/* Score */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">{tr.scoreLabel}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScore(s)}
                      className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
                        score === s
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(score)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  <CheckCircle size={16} />
                  {tr.approve}
                </button>
                <button
                  onClick={() => setShowFeedback((v) => !v)}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={16} />
                  {tr.requestChanges}
                </button>
              </div>

              {/* Feedback input */}
              {showFeedback && (
                <div className="flex gap-2">
                  <input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={tr.feedbackPlaceholder}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-gray-400"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                  />
                  <button
                    onClick={() => {
                      if (feedback.trim()) {
                        onRequestChanges(feedback.trim())
                        setFeedback('')
                        setShowFeedback(false)
                      }
                    }}
                    className="px-4 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors"
                  >
                    {tr.send}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
