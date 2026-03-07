import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, Mic } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import MessageBubble, { TypingIndicator } from '../chat/MessageBubble'
import PlanCard from '../chat/PlanCard'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

function mapMessage(msg) {
  return {
    id: msg.id,
    role: msg.role === 'user' ? 'user' : 'ai',
    text: msg.text || msg.content || '',
    timestamp: msg.timestamp || new Date(),
    tagsFound: msg.tagsFound || [],
    skillsFile: msg.skillsFile,
    isError: msg.isError,
  }
}

const ALLOWED_FILE_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
const MAX_FILE_MB = 20

export default function ChatPanelV2({
  messages,
  isLoading,
  processStatus,
  error,
  onSend,
  plan,
  planApproved,
  onApprove,
  onRequestChanges,
  selectedStudent,
  onAttachFile,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = (e) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    onSend(text)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachClick = () => {
    if (!onAttachFile || isLoading || uploading) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target?.files?.[0]
    e.target.value = ''
    if (!file || !onAttachFile) return
    setUploadError(null)
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_FILE_TYPES.includes(ext)) {
      setUploadError(language === 'ar' ? 'نوع غير مدعوم. استخدم: PDF, PNG, JPG, WebP' : 'Unsupported type. Use: PDF, PNG, JPG, WebP')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(language === 'ar' ? `الحد الأقصى: ${MAX_FILE_MB} ميجابايت` : `Max size: ${MAX_FILE_MB}MB`)
      return
    }
    setUploading(true)
    try {
      await onAttachFile(file)
    } catch (err) {
      setUploadError(err?.message || (language === 'ar' ? 'فشل الرفع' : 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  const handleVoiceClick = () => {
    if (!SpeechRecognition || isLoading) return
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US'
    recognition.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      if (last.isFinal && last[0].transcript) {
        setInput((prev) => (prev ? `${prev} ${last[0].transcript}` : last[0].transcript))
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {selectedStudent && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
            {(selectedStudent.name || 'S')[0].toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-medium text-foreground">{selectedStudent.name}</span>
            <span className="text-xs text-muted-foreground">{selectedStudent.className || selectedStudent.classId || ''}</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8 pb-4">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <img src="/logo.png" alt="EACH" className="mb-8 size-24 rounded-2xl object-cover shadow-sm" />
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">{tr.appName}</h1>
              <p className="mb-2 text-sm text-muted-foreground">{tr.tagline}</p>
              {selectedStudent ? (
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? `جلسة مفتوحة مع ${selectedStudent.name}` : `Session open for ${selectedStudent.name}`}
                </p>
              ) : (
                <p className="max-w-sm text-xs text-muted-foreground">{tr.welcomeSub}</p>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={mapMessage(msg)} />
              ))}
              {plan && (
                <PlanCard
                  planText={plan}
                  onApprove={onApprove}
                  onRequestChanges={onRequestChanges}
                  approved={planApproved}
                />
              )}
              {isLoading && <TypingIndicator processStatus={processStatus} />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {(error || uploadError) && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error || uploadError}
        </div>
      )}

      <div className="shrink-0 border-t border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSend} className="flex items-end gap-2 rounded-2xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            {onAttachFile && selectedStudent && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_FILE_TYPES.join(',')}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={isLoading || uploading}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={language === 'ar' ? 'رفع ملف' : 'Attach file'}
                >
                  <Paperclip className="size-4" />
                </button>
              </>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedStudent ? tr.startTyping : tr.noStudentHint}
              rows={1}
              disabled={isLoading}
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {SpeechRecognition && (
              <button
                type="button"
                onClick={handleVoiceClick}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isListening && 'animate-pulse text-foreground ring-2 ring-ring/50'
                )}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
              >
                <Mic className="size-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
