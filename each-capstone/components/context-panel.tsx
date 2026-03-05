"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { X, Save, Check, XCircle, ChevronDown, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useLocale } from "@/components/locale-provider"
import type { StudentContext, PlanState, StructuredPlan } from "@/lib/types"
import { sanitizePlanText, parsePlanModules, parseStructuredPlan, type PlanModule } from "@/lib/sanitize-plan"
import { extractFirstPlanJson } from "@/lib/plan"

export type AssistantActivityEntry = {
  id: string
  label: string
  timestamp?: Date
}

interface ContextPanelProps {
  context: StudentContext
  agentSession?: Record<string, unknown> | null
  planState?: PlanState | null
  proposedUpdates?: unknown[]
  activityLog?: AssistantActivityEntry[]
  onClose: () => void
  onApprovePending?: (index: number) => void
  onRejectPending?: (index: number) => void
  onApprovePlanModule?: (moduleId: string) => void
  onDeclinePlan?: () => void
  onSendDeclineFeedback?: (feedback: string) => void | Promise<void>
  onApprovePlan?: () => void
  reviseLoading?: boolean
  reviseError?: string | null
  onGeneratePlan?: () => void
  onSavePlan?: () => void
  approvedModuleIds?: Set<string>
}

export function ContextPanel({
  context,
  planState,
  proposedUpdates = [],
  activityLog = [],
  onClose,
  onApprovePending,
  onRejectPending,
  onApprovePlanModule,
  onDeclinePlan,
  onSendDeclineFeedback,
  onApprovePlan,
  reviseLoading = false,
  reviseError = null,
  onGeneratePlan,
  onSavePlan,
  approvedModuleIds = new Set(),
}: ContextPanelProps) {
  const { t } = useLocale()
  const [teacherNotes, setTeacherNotes] = useState("")
  const [activityOpen, setActivityOpen] = useState(false)
  const [declineFeedback, setDeclineFeedback] = useState("")
  const declineInputRef = useRef<HTMLInputElement>(null)

  const planContent = planState?.content ?? ""
  const planStatus = planState?.status ?? "proposed"
  const revisedAt = planState?.revisedAt
  const planJsonOnly = extractFirstPlanJson(planContent)
  const structuredPlan = planJsonOnly ? parseStructuredPlan(planJsonOnly) : null
  const sanitizedFallback = sanitizePlanText(planContent || undefined)

  // When status becomes "declined", focus the feedback input
  useEffect(() => {
    if (planStatus === "declined") {
      setTimeout(() => declineInputRef.current?.focus(), 100)
    }
  }, [planStatus])

  const diagnosis = context.diagnosis?.trim() || null
  const supportLevel = context.severityLevel?.trim() || null
  const baselineNotes = context.previousAssessment?.trim() || null
  const planModules = parsePlanModules(planContent || "")

  const hasProposals = proposedUpdates.length > 0

  // Header subtitle: one of Class OR Grade only (Class if present, else Grade)
  const headerSubtitle = (context.className?.trim() || context.grade?.trim() || "—") as string

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-s border-border bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {context.studentName.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-card-foreground">
              {context.studentName}
            </span>
            <span className="text-xs text-muted-foreground">
              {headerSubtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("context.save")} className="size-9" onClick={onSavePlan}>
                <Save className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("context.save")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("context.close")} className="size-9">
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("context.close")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Assistant Activity (collapsible) */}
      {activityLog.length > 0 && (
        <div className="shrink-0 border-b border-border">
          <button
            type="button"
            onClick={() => setActivityOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
          >
            {activityOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            <Sparkles className="size-4" />
            <span className="font-medium">Assistant activity</span>
          </button>
          {activityOpen && (
            <div className="border-t border-border bg-muted/30 px-5 py-3">
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {activityLog.map((entry) => (
                  <li key={entry.id}>{entry.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="summary" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-5 mt-4 shrink-0 w-fit">
          <TabsTrigger value="summary" className="text-sm">
            {t("context.summary")}
          </TabsTrigger>
          <TabsTrigger value="plan" className="text-sm">
            {t("context.plan")}
          </TabsTrigger>
        </TabsList>

        {/* SUMMARY — Teacher-facing only */}
        <TabsContent value="summary" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-5 px-5 py-5 pb-8">
              {/* Student Profile — Name + one of Class OR Grade only */}
              <SectionCard title="Student profile">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Name</p>
                    <p className="text-sm font-medium text-card-foreground">{context.studentName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Class / Grade</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {context.className?.trim() || context.grade?.trim() || "—"}
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* Diagnosis — value or "Not recorded", small "From record" badge */}
              <SectionCard title="Diagnosis">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-card-foreground">{diagnosis || "Not recorded"}</p>
                  {diagnosis && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">From record</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Support level: {supportLevel || "Not recorded"}</p>
              </SectionCard>

              {/* Baseline notes */}
              <SectionCard title="Notes from previous sessions">
                {baselineNotes ? (
                  <p className="text-sm leading-relaxed text-card-foreground">{baselineNotes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No baseline assessment recorded.</p>
                )}
              </SectionCard>

              {/* Teacher notes (local) */}
              <SectionCard title="Teacher notes">
                <textarea
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Your private notes about this student…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </SectionCard>

              {/* Proposed updates — only when there are proposals */}
              {hasProposals && (
                <SectionCard title="Suggested updates from chat">
                  <div className="space-y-2">
                    {proposedUpdates.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-card-foreground">
                          {typeof item === "object" && item !== null && "description" in (item as object)
                            ? String((item as { description: string }).description)
                            : typeof item === "string"
                              ? item
                              : "Update"}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">From today&apos;s chat</span>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="outline" onClick={() => onApprovePending?.(index)}>
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onRejectPending?.(index)}>
                            <XCircle className="size-3.5" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* PLAN — Header + Feedback fixed; plan content scrollable */}
        <TabsContent value="plan" className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          {/* 1. Header: title, date, badge, Approve/Decline, Regenerate, Save — always visible */}
          <div className="shrink-0 space-y-3 border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-card-foreground">
                Weekly support plan
              </h3>
              <span className="text-xs text-muted-foreground">
                {structuredPlan?.date
                  ? new Date(structuredPlan.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {planContent && (() => {
                const badgeLabel =
                  planStatus === "approved"
                    ? "Approved"
                    : planStatus === "declined"
                      ? "Declined"
                      : revisedAt
                        ? "Revised"
                        : "Draft"
                return (
                  <Badge variant="secondary" className="text-[10px]">
                    {badgeLabel}
                  </Badge>
                )
              })()}
              {onGeneratePlan && (
                <Button size="sm" variant="outline" onClick={onGeneratePlan} className="ml-auto">
                  Regenerate plan
                </Button>
              )}
              {onSavePlan && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button size="sm" variant="secondary" disabled aria-disabled>
                        Save plan
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Not connected yet</TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* Approve + Decline when plan exists */}
            {planContent && (
              <div className="flex flex-wrap items-center gap-2">
                {onApprovePlan && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onApprovePlan}
                    disabled={planStatus === "approved"}
                  >
                    <Check className="size-3.5" /> Approve
                  </Button>
                )}
                {onDeclinePlan && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDeclinePlan}
                    disabled={planStatus === "declined" || planStatus === "approved"}
                  >
                    <XCircle className="size-3.5" /> Decline
                  </Button>
                )}
                {planStatus === "declined" && (
                  <span className="text-xs text-muted-foreground">Send feedback below to revise.</span>
                )}
              </div>
            )}
          </div>

          {/* 2. Feedback input + Send — always visible when declined (no scroll) */}
          {planContent && planStatus === "declined" && (
            <div className="shrink-0 border-b border-border bg-muted/20 px-5 py-3">
              {reviseError && (
                <p className="mb-2 text-xs text-destructive">{reviseError}</p>
              )}
              <div className="flex gap-2">
                <input
                  ref={declineInputRef}
                  type="text"
                  value={declineFeedback}
                  onChange={(e) => setDeclineFeedback(e.target.value)}
                  placeholder="What should I change?"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={reviseLoading}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const fb = declineFeedback.trim() || "Please revise the plan."
                    void onSendDeclineFeedback?.(fb)
                    setDeclineFeedback("")
                  }}
                  disabled={reviseLoading}
                >
                  {reviseLoading ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}

          {/* 3. Plan content — vertical scroll only; tables handle their own horizontal scroll */}
          <div className="plan-container min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="w-full px-5 py-4 pb-8">
              {planContent ? (
                <>
                  {planModules.length > 0 && !structuredPlan ? (
                    <div className="space-y-4">
                      {planModules.map((mod) => (
                        <PlanModuleCard
                          key={mod.id}
                          module={mod}
                          approved={approvedModuleIds.has(mod.id)}
                          onApprove={() => onApprovePlanModule?.(mod.id)}
                        />
                      ))}
                    </div>
                  ) : structuredPlan ? (
                    <StructuredPlanView plan={structuredPlan} />
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground">
                      <PlanTextRenderer content={sanitizedFallback || "Plan could not be parsed. Ask for a new plan."} />
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No plan yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ask the assistant to create a weekly plan, or click below.</p>
                  {onGeneratePlan && (
                    <Button size="sm" className="mt-4" onClick={onGeneratePlan}>
                      Generate plan
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function DailyPlanScroller({
  dailyPlan,
  toRow,
}: {
  dailyPlan: StructuredPlan["daily_plan"] | StructuredPlan["dailyPlan"]
  toRow: (x: unknown) => Record<string, string>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = 200
    el.scrollBy({ left: dir === "left" ? -cardWidth : cardWidth, behavior: "smooth" })
  }
  const items = Array.isArray(dailyPlan) ? dailyPlan : []
  return (
    <SectionCard title="Daily plan">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 size-9"
          onClick={() => scroll("left")}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div
          ref={scrollRef}
          className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden py-1 scroll-smooth scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
        >
          {items.map((d, i) => {
            const row = toRow(d)
            const day = row.day ?? row._ ?? (typeof d === "string" ? d : "")
            const reading = row.reading ?? ""
            const math = row.math ?? ""
            const support = row.support ?? row.behavior ?? ""
            const notes = row.notes ?? ""
            return (
              <div
                key={i}
                className="min-w-[180px] max-w-[220px] shrink-0 rounded-lg border border-border bg-muted/20 p-3 text-sm"
              >
                <p className="mb-2 font-semibold text-foreground border-b border-border pb-1.5">{day || `Day ${i + 1}`}</p>
                {reading && (
                  <p className="mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Reading:</span>
                    <span className="ml-1 text-card-foreground">{reading}</span>
                  </p>
                )}
                {math && (
                  <p className="mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Math:</span>
                    <span className="ml-1 text-card-foreground">{math}</span>
                  </p>
                )}
                {support && (
                  <p className="mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Support:</span>
                    <span className="ml-1 text-card-foreground">{support}</span>
                  </p>
                )}
                {notes && (
                  <p>
                    <span className="text-xs font-medium text-muted-foreground">Notes:</span>
                    <span className="ml-1 text-card-foreground">{notes}</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 size-9"
          onClick={() => scroll("right")}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </SectionCard>
  )
}

function StructuredPlanView({ plan }: { plan: StructuredPlan }) {
  const goals = plan.goals ?? []
  const dailyPlan = (plan.dailyPlan ?? plan.daily_plan) ?? []
  const strategies = plan.strategies ?? []
  const materials = plan.materials ?? []
  const basedOn = plan.basedOn ?? []
  const homeFollowUp = plan.homeFollowUp ?? []
  const toRow = (x: unknown): Record<string, string> => {
    if (typeof x === "string") return { _: x }
    if (x && typeof x === "object") return x as Record<string, string>
    return {}
  }
  return (
    <div className="min-w-0 space-y-6">
      {(plan.title || plan.date || plan.dateRange || plan.student || plan.difficultyLevel || plan.difficulty) && (
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</h4>
          <div className="flex min-w-0 flex-wrap gap-4 text-sm">
            {plan.title && <span className="font-medium text-card-foreground">{plan.title}</span>}
            {plan.date && <span className="text-muted-foreground">{plan.date}</span>}
            {plan.dateRange && (
              <span className="text-muted-foreground">
                {plan.dateRange.start} – {plan.dateRange.end}
              </span>
            )}
            {plan.student && (
              <span className="text-muted-foreground">
                {plan.student.name} · {plan.student.classOrGrade ?? ""}
              </span>
            )}
            {(plan.difficultyLevel || plan.difficulty) && (
              <span className="text-muted-foreground">
                Difficulty: {plan.difficultyLevel ?? plan.difficulty}
              </span>
            )}
          </div>
        </div>
      )}
      {basedOn.length > 0 && (
        <SectionCard title="Based on">
          <ul className="space-y-1 text-sm text-card-foreground">
            {basedOn.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground">·</span>
                {typeof item === "string" ? item : String(item)}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {goals.length > 0 && (
        <SectionCard title="Goals">
          <div className="table-scroll w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-muted/20">
            <table className="plan-table min-w-[900px] w-max table-auto text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs font-semibold text-foreground">
                  {["Goal", "Baseline", "Target", "Measurement", "Review"].map((h) => (
                    <th key={h} className="px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goals.map((g, i) => {
                  const row = toRow(g)
                  const cells = [
                    row.goal ?? row._ ?? (typeof g === "string" ? g : ""),
                    row.baseline ?? "",
                    row.target ?? "",
                    row.measurement ?? "",
                    row.reviewDate ?? row.review_date ?? "",
                  ]
                  return (
                    <tr key={i} className="border-b border-border/70 bg-card text-card-foreground last:border-b-0">
                      {cells.map((c, j) => (
                        <td key={j} className="px-3 py-2.5">{c || "—"}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
      {dailyPlan.length > 0 && (
        <DailyPlanScroller dailyPlan={dailyPlan} toRow={toRow} />
      )}
      {strategies.length > 0 && (
        <SectionCard title="Strategies">
          <div className="table-scroll w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-muted/20">
            <table className="plan-table min-w-[900px] w-max table-auto text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs font-semibold text-foreground">
                  {["Situation", "Strategy", "Teacher script", "Frequency"].map((h) => (
                    <th key={h} className="px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => {
                  const row = toRow(s)
                  const cells = [
                    row.situation ?? row._ ?? (typeof s === "string" ? s : ""),
                    row.strategy ?? "",
                    row.teacherScript ?? row.script ?? "",
                    row.frequency ?? "",
                  ]
                  return (
                    <tr key={i} className="border-b border-border/70 bg-card text-card-foreground last:border-b-0">
                      {cells.map((c, j) => (
                        <td key={j} className="px-3 py-2.5">{c || "—"}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
      {materials.length > 0 && (
        <SectionCard title="Materials">
          <div className="flex flex-wrap gap-2">
            {materials.map((m, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {m}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}
      {homeFollowUp.length > 0 && (
        <SectionCard title="Home follow-up">
          <ul className="space-y-1.5 text-sm text-card-foreground">
            {homeFollowUp.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground">·</span>
                {typeof item === "string" ? item : String(item)}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

function PlanModuleCard({
  module,
  approved,
  onApprove,
}: {
  module: PlanModule
  approved: boolean
  onApprove: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-card-foreground">{module.title}</h4>
        {approved ? (
          <Badge variant="secondary" className="text-[10px]">Approved</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={onApprove}>
            <Check className="size-3.5" /> Approve
          </Button>
        )}
      </div>
      <div className="text-sm text-card-foreground whitespace-pre-wrap">
        <PlanTextRenderer content={module.content} />
      </div>
    </div>
  )
}

function PlanTextRenderer({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="mb-1 mt-3 text-base font-bold text-card-foreground">
              {line.replace(/^##\s+/, "")}
            </h2>
          )
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="mb-1 mt-2 text-sm font-semibold text-card-foreground">
              {line.replace(/^###\s+/, "")}
            </h3>
          )
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-3 text-sm text-card-foreground">
              <span className="text-muted-foreground">·</span>
              <span>{line.replace(/^[-*]\s+/, "")}</span>
            </div>
          )
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />
        return (
          <p key={i} className="text-sm text-card-foreground">
            {line}
          </p>
        )
      })}
    </div>
  )
}
