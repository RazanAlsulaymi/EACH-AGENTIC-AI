import { useState, useRef, useCallback } from 'react'
import { Send, Mic, Paperclip, UserSearch } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function ChatInput({ onSend, disabled, placeholder, onStudentSearchClick }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInput = (e) => {
    setText(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleVoiceClick = useCallback(() => {
    if (!SpeechRecognition) {
      alert(language === 'ar' ? 'المتصفح لا يدعم إدخال الصوت. جرّب Chrome أو Edge.' : 'Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (disabled) return

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
        setText((prev) => (prev ? `${prev} ${last[0].transcript}` : last[0].transcript))
      }
    }
    recognition.onerror = (e) => {
      if (e.error !== 'aborted') {
        setIsListening(false)
      }
    }
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [language, disabled, isListening])

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white px-4 py-3"
    >
      <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-gray-400 focus-within:bg-white transition-colors">
        {/* Optional: Find student (for when user forgot) */}
        {onStudentSearchClick && (
          <button
            type="button"
            onClick={onStudentSearchClick}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mb-0.5"
            title={tr.findStudent}
            disabled={disabled}
            aria-label={tr.findStudent}
          >
            <UserSearch size={18} />
          </button>
        )}
        {/* File upload */}
        <button
          type="button"
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mb-0.5"
          title="Upload file"
          disabled={disabled}
        >
          <Paperclip size={18} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || tr.startTyping}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none leading-relaxed py-1 max-h-[120px] overflow-y-auto"
          style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
        />

        {/* Mic */}
        <button
          type="button"
          onClick={handleVoiceClick}
          className={`p-1.5 transition-colors flex-shrink-0 mb-0.5 ${
            isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'
          }`}
          title={language === 'ar' ? (isListening ? 'إيقاف الصوت' : 'إدخال بالصوت') : isListening ? 'Stop listening' : 'Voice input'}
          disabled={disabled}
          aria-label={isListening ? 'Stop listening' : 'Voice input'}
        >
          <Mic size={18} />
        </button>

        {/* Send */}
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="p-1.5 bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 mb-0.5"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        {language === 'ar' ? 'Enter للإرسال · Shift+Enter لسطر جديد' : 'Enter to send · Shift+Enter for new line'}
      </p>
    </form>
  )
}
