import { Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'

export default function HomeView({
  students = [],
  classes = [],
  onSelectStudent,
  onSelectClass,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [query, setQuery] = useState('')

  const filteredStudents = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.className || s.classId || '').toLowerCase().includes(q)
    )
  }, [students, query])

  const filteredClasses = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    return classes.filter((c) => (c.name || '').toLowerCase().includes(q))
  }, [classes, query])

  const hasResults = filteredStudents.length > 0 || filteredClasses.length > 0
  const searchPlaceholder = tr.searchStudents || (language === 'ar' ? 'بحث طلاب أو صفوف...' : 'Search students or classes...')

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center p-8"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-xl">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img
            src="/logo.png"
            alt="EACH"
            className="size-24 rounded-2xl border border-border object-cover shadow-sm"
          />
        </div>

        {/* Tagline */}
        <p className="mb-8 text-center text-lg text-muted-foreground">
          {tr.tagline}
        </p>

        {/* Search input + results dropdown */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="off"
            />
          </div>

          {/* Results dropdown */}
          {query.trim() && (
            <div
              className={cn(
                'absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card py-2 shadow-lg',
                !hasResults && 'py-6'
              )}
            >
              {hasResults ? (
                <div className="flex flex-col gap-0.5">
                  {filteredClasses.length > 0 && (
                    <div className="px-3 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {tr.myClasses}
                      </span>
                    </div>
                  )}
                  {filteredClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        onSelectClass?.(cls)
                        setQuery('')
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="text-sm font-medium text-foreground">{cls.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {cls.studentCount} {language === 'ar' ? 'طالب' : 'students'}
                      </span>
                    </button>
                  ))}
                  {filteredStudents.length > 0 && (
                    <div className="mt-2 border-t border-border px-3 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {tr.allStudents}
                      </span>
                    </div>
                  )}
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        onSelectStudent?.(student)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                        {(student.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{student.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {student.className || student.classId || '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-4 text-center text-sm text-muted-foreground">
                  {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
