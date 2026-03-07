import { LayoutGrid, List, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'

export default function StudentsView({
  students = [],
  currentClass = null,
  onSelectStudent,
  onBack,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [viewMode, setViewMode] = useState('list')

  return (
    <div
      className="flex h-full w-full flex-col"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-foreground">
              {currentClass ? currentClass.name : tr.allStudents}
            </h2>
            {currentClass?.description && (
              <span className="text-sm text-muted-foreground">{currentClass.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={cn(
              'flex size-9 items-center justify-center rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={cn(
              'flex size-9 items-center justify-center rounded-md transition-colors',
              viewMode === 'grid'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelectStudent(student)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-base font-medium">
                  {(student.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-card-foreground group-hover:text-foreground">
                    {student.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {student.className || student.classId || '—'}
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
                type="button"
                onClick={() => onSelectStudent(student)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  {(student.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground group-hover:text-foreground">
                    {student.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {student.className || student.classId || '—'}
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
