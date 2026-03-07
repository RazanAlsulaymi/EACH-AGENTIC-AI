import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'
import { agentFromTags } from '../../hooks/useChat'

const AGENT_COLORS = {
  orchestrator: 'bg-gray-100 text-gray-700',
  assessment: 'bg-blue-100 text-blue-700',
  planning: 'bg-purple-100 text-purple-700',
  reflection: 'bg-amber-100 text-amber-700',
  evaluation: 'bg-green-100 text-green-700',
}

// Map skills filename -> i18n key for friendly label
const SKILL_LABELS = {
  'diagnosis_autism.md': 'diagnosisAutism',
  'diagnosis_adhd.md': 'diagnosisADHD',
  'diagnosis_dyslexia.md': 'diagnosisDyslexia',
  'diagnosis_processing.md': 'diagnosisProcessing',
  'diagnosis_unknown.md': 'skillUnknown',
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const isUser = message.role === 'user'
  const isError = message.isError
  const agent = !isUser
    ? (message.tagsFound?.length ? agentFromTags(message.tagsFound) : 'orchestrator')
    : null
  const agentLabel = agent
    ? { orchestrator: tr.agentOrchestrator, assessment: tr.agentAssessment, planning: tr.agentPlanning, reflection: tr.agentReflection, evaluation: tr.agentEvaluation }[agent] || tr.agentOrchestrator
    : null
  const skillLabel = message.skillsFile
    ? (tr[SKILL_LABELS[message.skillsFile]] || message.skillsFile.replace('.md', ''))
    : null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {(agentLabel || skillLabel) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 self-start">
            {agentLabel && (
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${AGENT_COLORS[agent] || AGENT_COLORS.orchestrator}`}>
                {agentLabel}
              </span>
            )}
            {skillLabel && (
              <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-gray-50 border border-gray-200" title={message.skillsFile}>
                {tr.usingSkill}: {skillLabel}
              </span>
            )}
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-gray-900 text-white rounded-br-sm'
              : isError
              ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          {message.text}
        </div>
        <span className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

const LOADING_STEPS = ['loadingSkills', 'loadingContext', 'loadingResponse', 'loadingPlan']

export function TypingIndicator({ processStatus }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (processStatus) return
    const id = setInterval(() => {
      setStep((s) => (s + 1) % LOADING_STEPS.length)
    }, 2200)
    return () => clearInterval(id)
  }, [processStatus])

  const label = processStatus || tr[LOADING_STEPS[step]] || tr.loadingSkills

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="text-sm text-gray-500 animate-pulse" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {label}
        </span>
      </div>
    </div>
  )
}
