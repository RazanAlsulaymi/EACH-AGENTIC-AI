"use client"

import { Search } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/components/locale-provider"
import Image from "next/image"
import type { Student, Class } from "@/lib/types"
import { mockStudents, mockClasses } from "@/lib/mock-data"

interface HomeViewProps {
  onSelectStudent: (student: Student) => void
  onSelectClass: (cls: Class) => void
  students?: Student[]
  classes?: Class[]
}

export function HomeView({ onSelectStudent, onSelectClass, students: propStudents, classes: propClasses }: HomeViewProps) {
  const [query, setQuery] = useState("")
  const { t } = useLocale()

  const students = propStudents ?? mockStudents
  const classes = propClasses ?? mockClasses

  const matchingStudents =
    query.length > 0
      ? students.filter((s) =>
          s.name.toLowerCase().includes(query.toLowerCase())
        )
      : []
  const matchingClasses =
    query.length > 0
      ? classes.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase())
        )
      : []

  const hasResults = matchingStudents.length > 0 || matchingClasses.length > 0

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 pt-8">
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        {/* Logo */}
        <div className="relative size-20 overflow-hidden rounded-full border-2 border-border bg-card shadow-sm">
          <Image src="/images/logo.png" alt="EACH" fill className="object-cover" />
        </div>

        {/* Subtitle */}
        <p className="text-center text-sm text-muted-foreground">
          {t("home.subtitle")}
        </p>

        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("home.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 ps-12 text-base"
          />
        </div>

        {/* Results */}
        {query.length > 0 && (
          <div className="w-full rounded-xl border border-border bg-card shadow-sm">
            {!hasResults ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t("home.noResults")} &quot;{query}&quot;
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {matchingClasses.length > 0 && (
                  <div className="flex flex-col">
                    <span className="px-5 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("home.classes")}
                    </span>
                    {matchingClasses.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => onSelectClass(cls)}
                        className="flex items-center justify-between px-5 py-3 text-start text-sm transition-colors hover:bg-accent"
                      >
                        <span className="font-medium text-card-foreground">{cls.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {cls.studentCount} {t("home.studentsCount")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {matchingStudents.length > 0 && (
                  <div className="flex flex-col">
                    <span className="px-5 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("home.students")}
                    </span>
                    {matchingStudents.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => onSelectStudent(student)}
                        className="flex items-center justify-between px-5 py-3 text-start text-sm transition-colors hover:bg-accent"
                      >
                        <span className="font-medium text-card-foreground">
                          {student.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {student.className}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
