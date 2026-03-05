"use client"

import { LayoutGrid, List } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Class } from "@/lib/types"

interface ClassesViewProps {
  classes: Class[]
  onSelectClass: (cls: Class) => void
}

export function ClassesView({ classes, onSelectClass }: ClassesViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const { t } = useLocale()

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <h2 className="text-xl font-semibold text-foreground">
          {t("classes.title")}
        </h2>
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => onSelectClass(cls)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-start transition-all hover:border-ring hover:shadow-sm"
              >
                <h3 className="text-base font-semibold text-card-foreground group-hover:text-foreground">
                  {cls.name}
                </h3>
                {cls.description && (
                  <p className="text-sm text-muted-foreground">
                    {cls.description}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-1 text-sm text-muted-foreground">
                  <span>{cls.studentCount} {t("home.studentsCount")}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => onSelectClass(cls)}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-6 py-4 text-start transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-card-foreground group-hover:text-foreground">
                    {cls.name}
                  </span>
                  {cls.description && (
                    <span className="text-sm text-muted-foreground">
                      {cls.description}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {cls.studentCount} {t("home.studentsCount")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
