"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Paperclip, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { ChatMessage, Student } from "@/lib/types"
import Image from "next/image"

import { apiPost } from "@/lib/api"
import { sanitizePlanText, sanitizeChatMessageForDisplay } from "@/lib/sanitize-plan"

type SpeechResultEvent = { results: { [key: number]: { [key: number]: { transcript: string } } } }

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type ChatApiSession = {
  student_id?: number
  difficulty_reported?: string
  triggers_noted?: string
  strategies_tried?: string
  support_needed?: string
  all_fields_complete?: boolean
  plan_generated?: boolean
  reflection_done?: boolean
  plan_approved?: boolean
  eval_score?: number
  plan_version?: number
  preferred_language?: "en" | "ar"
} | null

type ChatApiResponse = {
  response: string
  session: ChatApiSession
  plan?: string | null
  plan_id?: number | null
  tags_found?: string[]
  suggested_student_id?: number | null
  proposed_updates?: unknown[]
}

interface ChatPanelProps {
  selectedStudent: Student | null
  /** When loading a prior session, pass the thread_id so messages go to that session */
  threadId?: string | null
  /** When loading a prior session, pass the loaded messages */
  initialMessages?: ChatMessage[]
  preferredLanguage?: "en" | "ar"
  onBackendUpdate?: (payload: {
    session: ChatApiSession
    plan?: string | null
    plan_id?: number | null
    thread_id: string
    tags_found?: string[]
    suggested_student_id?: number | null
    proposed_updates?: unknown[]
  }) => void
  /** When set, ChatPanel will send this message automatically (e.g. "Generate plan") */
  triggerMessage?: string | null
  onTriggerMessageSent?: () => void
  /** Optional: report current messages so parent can pass recent turns to plan revise */
  onMessagesChange?: (messages: ChatMessage[]) => void
}

function toStudentIdNumber(student: Student | null): number | null {
  if (!student) return null

  // support both shapes:
  // - student.student_id (number)
  // - student.id (string like "s1" or "1")
  const raw: any = (student as any).student_id ?? (student as any).id

  if (raw === null || raw === undefined) return null

  if (typeof raw === "number" && Number.isFinite(raw)) return raw

  const str = String(raw).trim()
  const cleaned = str.replace(/^s/i, "") // remove leading s
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function makeThreadId(studentId: number | null): string {
  // stable per-student thread id (demo-friendly)
  if (studentId) return `each:student:${studentId}`
  return "each:general"
}

export function ChatPanel({
  selectedStudent,
  threadId: threadIdProp,
  initialMessages: initialMessagesProp,
  preferredLanguage = "en",
  onBackendUpdate,
  triggerMessage,
  onTriggerMessageSent,
  onMessagesChange,
}: ChatPanelProps) {
  const { t } = useLocale()

  const effectiveThreadId = threadIdProp ?? makeThreadId(toStudentIdNumber(selectedStudent))

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessagesProp && initialMessagesProp.length > 0
      ? initialMessagesProp
      : [
          {
            id: "welcome",
            role: "assistant",
            content: selectedStudent
              ? t("chat.welcomeStudent", { name: selectedStudent.name })
              : t("chat.welcomeGeneral"),
            timestamp: new Date(),
          },
        ]
  )

  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const lastTriggerRef = useRef<string | null>(null)

  // Scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Report messages to parent for plan-revise context (recent turns)
  useEffect(() => {
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])

  // When loading a session, use loaded messages; when new chat, reset to welcome on student change
  useEffect(() => {
    if (threadIdProp && initialMessagesProp && initialMessagesProp.length > 0) {
      setMessages(initialMessagesProp)
    }
  }, [threadIdProp, initialMessagesProp])

  // Reset welcome when student changes (only in "new chat" mode when no threadId)
  useEffect(() => {
    if (threadIdProp) return
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: selectedStudent
          ? t("chat.welcomeStudent", { name: selectedStudent.name })
          : t("chat.welcomeGeneral"),
        timestamp: new Date(),
      },
    ])
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }, [selectedStudent, threadIdProp, t])

  // When parent requests to send a message (e.g. "Generate plan" from ContextPanel)
  useEffect(() => {
    if (!triggerMessage?.trim() || lastTriggerRef.current === triggerMessage) return
    lastTriggerRef.current = triggerMessage
    setIsSending(true)
    const studentId = toStudentIdNumber(selectedStudent)
    const thread_id = effectiveThreadId || makeThreadId(studentId)
    const payload: Record<string, unknown> = {
      message: triggerMessage.trim(),
      thread_id,
      preferred_language: preferredLanguage,
    }
    if (studentId) payload.student_id = studentId

    apiPost<ChatApiResponse>("/chat", payload)
      .then((data) => {
        const teacherMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "teacher",
          content: triggerMessage.trim(),
          timestamp: new Date(),
        }
        const agentMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: (sanitizePlanText(data?.response) || data?.response || "No response.")
            + (data?.plan && data?.tags_found?.includes("PLAN_GENERATED") ? "\n\n" + t("chat.planApprovalLine") : ""),
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, teacherMsg, agentMsg])
        if (typeof window !== "undefined" && process.env.NODE_ENV !== "production" && data?.plan) {
          console.debug("[Plan] Chat response included plan", { hasPlan: !!data?.plan, planLength: data?.plan?.length })
        }
        onBackendUpdate?.({
          session: data?.session ?? null,
          plan: data?.plan ?? null,
          plan_id: data?.plan_id ?? null,
          thread_id,
          tags_found: data?.tags_found ?? [],
          suggested_student_id: data?.suggested_student_id ?? null,
          proposed_updates: data?.proposed_updates ?? undefined,
        })
      })
      .catch((e: unknown) => {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now() + 2}`,
          role: "assistant",
          content: `Something went wrong. ${e instanceof Error ? e.message : "Please try again."}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errMsg])
      })
      .finally(() => {
        lastTriggerRef.current = null
        setIsSending(false)
        onTriggerMessageSent?.()
      })
  }, [triggerMessage, selectedStudent, preferredLanguage, onBackendUpdate, onTriggerMessageSent, effectiveThreadId])

  // Speech API support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
        : null
    if (!SpeechRecognitionAPI) setSpeechSupported(false)
  }, [])

  const toggleSpeech = useCallback(() => {
    if (!speechSupported) return

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = preferredLanguage === "ar" ? "ar-SA" : "en-US"

    recognition.onresult = (event: SpeechResultEvent) => {
      const transcript = event.results[0][0].transcript
      setInput((prev) => prev + (prev ? " " : "") + transcript)
      setIsListening(false)
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, speechSupported, preferredLanguage])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isSending) return

    const studentId = toStudentIdNumber(selectedStudent)
    const thread_id = effectiveThreadId || makeThreadId(studentId)

    const teacherMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "teacher",
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, teacherMsg])
    setInput("")
    setIsSending(true)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    try {
      const payload: any = {
        message: text,
        thread_id,
        preferred_language: preferredLanguage,
      }
      // Only send student_id when selected; backend supports general mode when null
      if (studentId) payload.student_id = studentId

      const data = await apiPost<ChatApiResponse>("/chat", payload)

      const agentMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: (sanitizePlanText(data?.response) || data?.response || "No response.")
          + (data?.plan && data?.tags_found?.includes("PLAN_GENERATED") ? "\n\n" + t("chat.planApprovalLine") : ""),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, agentMsg])

      onBackendUpdate?.({
        session: data?.session ?? null,
        plan: data?.plan ?? null,
        plan_id: data?.plan_id ?? null,
        thread_id,
        tags_found: data?.tags_found ?? [],
        suggested_student_id: data?.suggested_student_id ?? null,
        proposed_updates: data?.proposed_updates ?? undefined,
      })
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        role: "assistant",
        content: `Backend error: ${e?.message || "failed to send"}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** Send a message programmatically (e.g. from quick action buttons) */
  const sendMessage = async (text: string) => {
    if (!text.trim() || isSending) return
    const studentId = toStudentIdNumber(selectedStudent)
    const thread_id = effectiveThreadId || makeThreadId(studentId)
    const teacherMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "teacher",
      content: text.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, teacherMsg])
    setIsSending(true)
    try {
      const payload: Record<string, unknown> = {
        message: text.trim(),
        thread_id,
        preferred_language: preferredLanguage,
      }
      if (studentId) payload.student_id = studentId
      const data = await apiPost<ChatApiResponse>("/chat", payload)
      let responseContent = sanitizePlanText(data?.response) || data?.response || "No response."
      if (data?.plan && data?.tags_found?.includes("PLAN_GENERATED")) {
        responseContent += "\n\n" + t("chat.planApprovalLine")
      }
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, agentMsg])
      onBackendUpdate?.({
        session: data?.session ?? null,
        plan: data?.plan ?? null,
        plan_id: data?.plan_id ?? null,
        thread_id,
        tags_found: data?.tags_found ?? [],
        suggested_student_id: data?.suggested_student_id ?? null,
        proposed_updates: data?.proposed_updates ?? undefined,
      })
    } catch (e: unknown) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        role: "assistant",
        content: `Something went wrong. ${e instanceof Error ? e.message : "Please try again."}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Chat header */}
      {selectedStudent && (
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
            {selectedStudent.name?.charAt(0) || "S"}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-medium text-foreground">
              {selectedStudent.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {(selectedStudent as any).className || ""}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "teacher" && "flex-row-reverse")}
            >
              {msg.role === "assistant" ? (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <Image
                    src="/images/logo.png"
                    alt="EACH"
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                </div>
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  T
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-muted text-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {msg.role === "assistant"
                  ? sanitizeChatMessageForDisplay(msg.content)
                  : msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("chat.attachFile")}
                  className="size-9 shrink-0 text-muted-foreground"
                >
                  <Paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.attachFile")}</TooltipContent>
            </Tooltip>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedStudent
                  ? t("chat.inputPlaceholder", { name: selectedStudent.name })
                  : t("chat.inputPlaceholderGeneral")
              }
              rows={1}
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />

            {speechSupported ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleSpeech}
                    aria-label={isListening ? t("chat.listening") : "Voice input"}
                    className={cn(
                      "size-9 shrink-0 text-muted-foreground transition-all",
                      isListening && "text-foreground ring-2 ring-ring/50 animate-pulse"
                    )}
                  >
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isListening ? t("chat.listening") : "Voice input"}
                </TooltipContent>
              </Tooltip>
            ) : null}

            <Button
              type="button"
              size="icon"
              disabled={!input.trim() || isSending}
              onClick={handleSend}
              className="size-9 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 px-1">
            {isListening && (
              <Badge variant="outline" className="text-[10px] font-normal animate-pulse">
                {t("chat.listening")}
              </Badge>
            )}
            {!speechSupported && (
              <span className="text-[10px] text-muted-foreground">
                {t("chat.speechNotSupported")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
