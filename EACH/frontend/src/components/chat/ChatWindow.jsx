import { useEffect, useRef } from 'react'
import MessageBubble, { TypingIndicator } from './MessageBubble'
import PlanCard from './PlanCard'
import ChatInput from './ChatInput'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

export default function ChatWindow({
  messages,
  isLoading,
  processStatus,
  error,
  onSend,
  plan,
  planApproved,
  onApprove,
  onRequestChanges,
  student,
  teacherName,
  inputPlaceholder,
  onStudentSearchClick,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const bottomRef = useRef(null)
  const hasMessages = messages.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Message area (agent shown per message in MessageBubble) */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          /* Empty state — Ollama-style: centered logo, minimal text */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            {/* Prominent logo (Ollama-style) */}
            <img
              src="/logo.png"
              alt="EACH"
              className="w-24 h-24 mb-8 rounded-2xl object-cover shadow-sm"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
              {tr.appName}
            </h1>
            <p className="text-gray-500 text-sm mb-2">
              {tr.tagline}
            </p>
            {student ? (
              <p className="text-gray-500 text-xs">
                {language === 'ar'
                  ? `جلسة مفتوحة مع ${student.name_ar || student.name_en}`
                  : `Session open for ${student.name_en}`}
              </p>
            ) : (
              <p className="text-gray-400 text-xs max-w-sm">
                {tr.welcomeSub}
              </p>
            )}
          </div>
        ) : (
          /* Messages */
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Plan card surfaces when plan is available */}
            {plan && (
              <PlanCard
                planText={plan}
                onApprove={onApprove}
                onRequestChanges={onRequestChanges}
                approved={planApproved}
              />
            )}

            {isLoading && <TypingIndicator processStatus={processStatus} />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={onSend}
        disabled={isLoading}
        placeholder={inputPlaceholder}
        onStudentSearchClick={onStudentSearchClick}
      />
    </div>
  )
}
