const BASE = 'http://localhost:8003'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Health
  health: () => request('/health'),

  // Students
  getStudents: () => request('/students'),
  getStudent: (id) => request(`/students/${id}`),

  // Sessions (recent from DB)
  getRecentSessions: () => request('/sessions/recent'),
  getSessionMessages: (threadId) => request(`/sessions/${encodeURIComponent(threadId)}/messages`),

  // Chat (studentId/threadId optional — general mode when null; preferredLanguage from UI toggle)
  sendMessage: (message, studentId, threadId, preferredLanguage = null) =>
    request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        student_id: studentId ?? null,
        thread_id: threadId ?? (studentId ? null : 'general_0'),
        preferred_language: preferredLanguage && (preferredLanguage === 'en' || preferredLanguage === 'ar') ? preferredLanguage : null,
      }),
    }),

  // Chat with streaming progress (calls onProgress for each agent, onDone with final data)
  sendMessageStream: async (message, studentId, threadId, { onProgress, onDone, onError, preferredLanguage = null } = {}) => {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        student_id: studentId ?? null,
        thread_id: threadId ?? (studentId ? null : 'general_0'),
        preferred_language: preferredLanguage && (preferredLanguage === 'en' || preferredLanguage === 'ar') ? preferredLanguage : null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError?.(new Error(err.detail || `HTTP ${res.status}`))
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'progress') onProgress?.(data)
              else if (data.type === 'done') onDone?.(data)
              else if (data.type === 'error') onError?.(new Error(data.detail))
            } catch (_) {}
          }
        }
      }
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          if (data.type === 'done') onDone?.(data)
          else if (data.type === 'error') onError?.(new Error(data.detail))
        } catch (_) {}
      }
    } catch (e) {
      onError?.(e)
    }
  },

  // Plan
  approvePlan: (planId, score) =>
    request(`/plans/${planId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ score }),
    }),
  savePlan: (threadId, planEn, planAr) =>
    request('/plans/save', {
      method: 'POST',
      body: JSON.stringify({
        thread_id: threadId,
        approved: true,
        plan_content_en: planEn || '',
        plan_content_ar: planAr || '',
      }),
    }),

  // Evaluate
  evaluatePlan: (threadId, score, planId = null) =>
    request('/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        thread_id: threadId,
        score,
        ...(planId ? { plan_id: planId } : {}),
      }),
    }),

  // Mood
  logMood: (studentId, mood, note = '') =>
    request('/mood', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, mood, note }),
    }),

  // Milestone
  logMilestone: (studentId, title, description = '') =>
    request('/milestone', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, title, description }),
    }),

  // File upload & analysis (IEP, homework, etc.)
  analyzeFile: async (file, studentId, fileType = 'IEP', threadId = null) => {
    const form = new FormData()
    form.append('file', file)
    form.append('student_id', studentId)
    form.append('file_type', fileType)
    if (threadId) form.append('thread_id', threadId)
    const res = await fetch(`${BASE}/api/analyze`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Upload failed: ${res.status}`)
    }
    return res.json()
  },
}
