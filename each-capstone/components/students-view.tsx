"use client"

import { LayoutGrid, List, ArrowLeft } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Student, Class } from "@/lib/types"


interface StudentsViewProps {
  students: Student[]
  currentClass?: Class | null
  onSelectStudent: (student: Student) => void
  onBack?: () => void
}

export function StudentsView({
  students,
  currentClass,
  onSelectStudent,
  onBack,
}: StudentsViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const { t } = useLocale()

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Go back"
              className="size-10"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-foreground">
              {currentClass ? currentClass.name : t("students.title")}
            </h2>
            {currentClass?.description && (
              <span className="text-sm text-muted-foreground">
                {currentClass.description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                aria-label={t("classes.listView")}
                className="size-9"
              >
                <List className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("classes.listView")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                aria-label={t("classes.gridView")}
                className="size-9"
              >
                <LayoutGrid className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("classes.gridView")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-start transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-base font-medium">
                  {student.name.charAt(0)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-card-foreground group-hover:text-foreground">
                    {student.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {student.className}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-start transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  {student.name.charAt(0)}
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground group-hover:text-foreground">
                    {student.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {student.className}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
