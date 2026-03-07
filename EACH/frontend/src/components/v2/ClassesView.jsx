import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'

export default function ClassesView({ classes = [], onSelectClass }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [viewMode, setViewMode] = useState('grid')
  const studentsCountLabel = language === 'ar' ? 'طالب' : 'students'

  return (
    <div className="flex h-full w-full flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <h2 className="text-xl font-semibold text-foreground">{tr.myClasses}</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={cn(
              'flex size-9 items-center justify-center rounded-md transition-colors',
              viewMode === 'list' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'
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
              viewMode === 'grid' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => onSelectClass(cls)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-ring hover:shadow-sm"
              >
                <h3 className="text-base font-semibold text-card-foreground group-hover:text-foreground">
                  {cls.name}
                </h3>
                {cls.description && <p className="text-sm text-muted-foreground">{cls.description}</p>}
                <div className="mt-auto flex items-center gap-1 text-sm text-muted-foreground">
                  <span>
                    {cls.studentCount} {studentsCountLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => onSelectClass(cls)}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-6 py-4 text-left transition-all hover:border-ring hover:shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-card-foreground group-hover:text-foreground">
                    {cls.name}
                  </span>
                  {cls.description && (
                    <span className="text-sm text-muted-foreground">{cls.description}</span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {cls.studentCount} {studentsCountLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
