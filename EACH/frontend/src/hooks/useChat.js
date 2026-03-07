import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '../api/client'
import { useApp } from '../context/AppContext'

// Generate thread ID: one session per student per day
function makeThreadId(studentId) {
  const today = new Date().toISOString().slice(0, 10)
  return `student_${studentId}_${today}`
}

// Derive active agent label from tags_found array (planning takes priority when plan was generated)
export function agentFromTags(tagsFound = []) {
  // Prefer planning when a plan was just generated, regardless of tag order
  if (tagsFound.some((t) => t === 'PLAN_GENERATED' || t === 'PLAN_REVISED')) return 'planning'
  for (const tag of tagsFound) {
    if (tag.startsWith('FIELD_COLLECTED') || tag === 'ASSESSMENT_COMPLETE') return 'assessment'
    if (tag === 'REFLECTION_PASSED') return 'reflection'
    if (tag.startsWith('EVAL_SCORE')) return 'evaluation'
  }
  return 'orchestrator'
}

// Strip internal agent markers from plan (backend should send clean; this is defensive)
export function sanitizePlanForDisplay(text = '') {
  if (!text || typeof text !== 'string') return ''
  const markers = [
    'REFLECTION_PASSED', 'EVAL_SCORE', 'EVALUATION SUMMARY', 'REFLECTION SUMMARY',
    'transfer_to_orchestrator', 'transfer_to_assessment', 'transfer_to_planning',
    'transfer_to_reflection', 'transfer_to_evaluation',
  ]
  let out = text
  for (const m of markers) {
    const i = out.toUpperCase().indexOf(m.toUpperCase())
    if (i >= 0) out = out.slice(0, i).trim()
  }
  // Strip trailing handoff instructions on their own line
  const lines = out.split('\n')
  while (lines.length) {
    const last = lines[lines.length - 1].trim().toLowerCase()
    if (!last || last.startsWith('transfer_to_')) lines.pop()
    else break
  }
  return lines.join('\n').trim()
}

// Split bilingual plan text into EN / AR sections
export function splitPlan(planText = '') {
  const clean = sanitizePlanForDisplay(planText)
  const enMatch = clean.match(/\[EN\]([\s\S]*?)(?=\[AR\]|$)/)
  const arMatch = clean.match(/\[AR\]([\s\S]*)$/)
  return {
    en: enMatch ? enMatch[1].trim() : clean,
    ar: arMatch ? arMatch[1].trim() : '',
  }
}

// Persist recent sessions to localStorage
function saveRecent(studentId, studentName, threadId, lastMessage) {
  const key = 'each_recent'
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  const updated = [
    { studentId, studentName, threadId, lastMessage: lastMessage.slice(0, 80), timestamp: Date.now() },
    ...existing.filter((r) => r.threadId !== threadId),
  ].slice(0, 10)
  localStorage.setItem(key, JSON.stringify(updated))
}

export function useChat(studentId, studentName, initialThreadId = null) {
  const { language } = useApp()
  const threadId = initialThreadId || (studentId ? makeThreadId(studentId) : null)
  const [messages, setMessages] = useState([])
  const [session, setSession] = useState(null)
  const [plan, setPlan] = useState(null)          // raw plan text
  const [planApproved, setPlanApproved] = useState(false)
  const [savedPlanId, setSavedPlanId] = useState(null)
  const [activeAgent, setActiveAgent] = useState('orchestrator')
  const [isLoading, setIsLoading] = useState(false)
  const [processStatus, setProcessStatus] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  // Load message history only when resuming from Recent Messages (initialThreadId matches threadId)
  // When user selects a student from the search modal, initialThreadId is null — start fresh
  useEffect(() => {
    if (!threadId || threadId === 'general_0') return
    if (!initialThreadId || initialThreadId !== threadId) return // start fresh when selecting from modal
    api.getSessionMessages(threadId)
      .then((data) => {
        const msgs = data?.messages || []
        if (msgs.length === 0) return
        const formatted = msgs.map((m, i) => ({
          id: `loaded-${i}-${Date.now()}`,
          role: m.role === 'user' ? 'user' : 'ai',
          text: m.content || '',
          timestamp: new Date(),
          tagsFound: m.tags_found || [],
        }))
        setMessages(formatted)
      })
      .catch(() => {})
  }, [threadId, initialThreadId])

  const addMessage = useCallback((role, text, extra = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role, text, timestamp: new Date(), ...extra },
    ])
  }, [])

  const sendMessage = useCallback(
    async (text, options = {}) => {
      const effectiveStudentId = options.studentIdOverride ?? studentId
      const effectiveThreadId = options.threadIdOverride ?? threadId ?? (effectiveStudentId ? makeThreadId(effectiveStudentId) : 'general_0')
      if (!text.trim() || isLoading) return false
      setError(null)
      addMessage('user', text)
      setIsLoading(true)
      setProcessStatus(null)

      try {
        let data = null
        let streamFailed = false
        try {
          await api.sendMessageStream(
            text,
            effectiveStudentId || null,
            effectiveThreadId,
            {
              onProgress: (ev) => setProcessStatus(ev?.label || null),
              onDone: (d) => { data = d },
              onError: () => { streamFailed = true },
              preferredLanguage: language,
            }
          )
        } catch {
          streamFailed = true
        }
        if (streamFailed || !data) {
          data = await api.sendMessage(text, effectiveStudentId || null, effectiveThreadId, language)
        }
        if (!data) {
          setError('No response received')
          return { success: false }
        }
        addMessage('ai', data.response, { tagsFound: data.tags_found || [], skillsFile: data.skills_file })
        setSession(data.session || null)
        if (data.plan) setPlan(data.plan)
        if (data.plan_id != null) setSavedPlanId(data.plan_id)
        setActiveAgent(agentFromTags(data.tags_found))
        if (effectiveStudentId) {
          saveRecent(effectiveStudentId, studentName || '', effectiveThreadId, data.response)
        }
      } catch (e) {
        setError(e.message)
        addMessage('ai', `⚠ ${e.message}`, { isError: true })
        return { success: false }
      } finally {
        setIsLoading(false)
        setProcessStatus(null)
      }
      return { success: true, suggestedStudentId: data.suggested_student_id }
    },
    [studentId, threadId, studentName, isLoading, addMessage, language]
  )

  const approvePlan = useCallback(
    async (score) => {
      if (!plan) return
      try {
        if (savedPlanId != null) {
          await api.approvePlan(savedPlanId, score)
          setPlanApproved(true)
        } else {
          if (!threadId) {
            setError('Cannot save plan: no active session.')
            return
          }
          const { en, ar } = splitPlan(plan)
          const saved = await api.savePlan(threadId, en, ar)
          const planId = saved?.plan_id || null
          setSavedPlanId(planId)
          if (planId) {
            await api.approvePlan(planId, score)
          } else {
            await api.evaluatePlan(threadId, score, null)
          }
          setPlanApproved(true)
        }
      } catch (e) {
        setError(e?.message || 'Failed to save plan approval')
      }
    },
    [plan, threadId, savedPlanId]
  )

  const requestChanges = useCallback(
    async (feedback) => {
      if (!feedback.trim()) return
      await sendMessage(feedback)
    },
    [sendMessage]
  )

  const reset = useCallback(() => {
    setMessages([])
    setSession(null)
    setPlan(null)
    setPlanApproved(false)
    setSavedPlanId(null)
    setActiveAgent('orchestrator')
    setError(null)
  }, [])

  return {
    threadId,
    messages,
    session,
    plan,
    planApproved,
    activeAgent,
    isLoading,
    processStatus,
    error,
    sendMessage,
    approvePlan,
    requestChanges,
    reset,
  }
}
