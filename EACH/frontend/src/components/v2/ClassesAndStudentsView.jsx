import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Search, LayoutGrid, List } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import { diagnosisBadge } from '../classes/StudentCard'

function planStatusStyle(status) {
  if (status === 'done' || status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'pending' || status === 'generated') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

function ClassSection({ className, students, onSelectStudent, viewMode }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-ring hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{className}</span>
          <span className="text-xs text-muted-foreground">({students.length})</span>
        </div>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className={cn(
          'grid gap-3 pl-2',
          viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-2'
        )}>
          {students.map((s) => (
            <StudentCard key={s.id} student={s} onSelect={onSelectStudent} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentCard({ student, onSelect, viewMode }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const s = student
  const name = s.name_en || s.name_ar || s.name || '?'
  const nameAr = s.name_ar || (s.name !== name ? s.name : null)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(student)}
      className={cn(
        'group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-ring hover:shadow-sm',
        viewMode === 'list' ? 'flex items-center gap-4' : ''
      )}
    >
      <div className={cn('flex items-start gap-3', viewMode === 'list' && 'flex-1')}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground">
          {name[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-sm leading-tight">{name}</p>
          {nameAr && <p className="text-xs text-muted-foreground leading-tight" dir="rtl">{nameAr}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', diagnosisBadge(s.diagnosis))}>
          {s.diagnosis || '—'}
        </span>
        {s.severity_level && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {s.severity_level}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', planStatusStyle(s.plan_status))}>
          {s.plan_status === 'done' || s.plan_status === 'approved'
            ? tr.planDone
            : s.plan_status === 'pending' || s.plan_status === 'generated'
              ? tr.planPending
              : tr.planNone}
        </span>
        {s.last_session_date && (
          <span className="text-xs text-muted-foreground">
            {new Date(s.last_session_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </button>
  )
}

export default function ClassesAndStudentsView({ students = [], onSelectStudent }) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('all')
  const [displayMode, setDisplayMode] = useState('grid')
  const [filters, setFilters] = useState({ diagnosis: '', planStatus: '' })
  const [sort, setSort] = useState('alpha')

  const filtered = useMemo(() => {
    let list = [...students]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          (s.name || s.name_en || '').toLowerCase().includes(q) ||
          (s.name_ar || '').includes(search) ||
          (s.className || s.classId || s.class_name || '').toLowerCase().includes(q)
      )
    }

    if (filters.diagnosis) {
      list = list.filter((s) =>
        (s.diagnosis || '').toLowerCase().includes(filters.diagnosis.toLowerCase())
      )
    }

    if (filters.planStatus === 'has_plan') list = list.filter((s) => s.plan_status === 'done' || s.plan_status === 'approved')
    if (filters.planStatus === 'no_plan') list = list.filter((s) => !s.plan_status || s.plan_status === 'none')
    if (filters.planStatus === 'pending') list = list.filter((s) => s.plan_status === 'pending' || s.plan_status === 'generated')

    if (sort === 'alpha') list.sort((a, b) => (a.name || a.name_en || '').localeCompare(b.name || b.name_en || ''))
    if (sort === 'severity') list.sort((a, b) => (a.severity_level || '').localeCompare(b.severity_level || ''))
    if (sort === 'lastSession') list.sort((a, b) => {
      const da = a.last_session_date ? new Date(a.last_session_date).getTime() : 0
      const db = b.last_session_date ? new Date(b.last_session_date).getTime() : 0
      return db - da
    })

    return list
  }, [students, search, filters, sort])

  const byClass = useMemo(() => {
    const groups = {}
    filtered.forEach((s) => {
      const cls = s.class_name || s.className || s.class_id || s.classId || (language === 'ar' ? 'غير محدد' : 'Unassigned')
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(s)
    })
    return groups
  }, [filtered, language])

  return (
    <div className="flex h-full w-full flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex shrink-0 flex-col gap-4 border-b border-border px-8 py-5">
        <h2 className="text-xl font-semibold text-foreground">{tr.myClasses}</h2>

        {/* Search + view toggle */}
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr.searchStudents}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setViewMode('byClass')}
              className={cn(
                'px-4 py-2 text-xs font-medium transition-colors',
                viewMode === 'byClass' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {tr.byClass}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={cn(
                'border-l border-border px-4 py-2 text-xs font-medium transition-colors',
                viewMode === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {tr.allStudents}
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              aria-label="List view"
              className={cn(
                'flex size-9 items-center justify-center rounded-md transition-colors',
                displayMode === 'list' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('grid')}
              aria-label="Grid view"
              className={cn(
                'flex size-9 items-center justify-center rounded-md transition-colors',
                displayMode === 'grid' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {['All', 'ADHD', 'Autism', 'Dyslexia', 'Processing Disorder'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, diagnosis: d === 'All' ? '' : d }))}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                (d === 'All' && !filters.diagnosis) || filters.diagnosis === d
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground'
              )}
            >
              {d === 'All' ? (language === 'ar' ? 'الكل' : 'All') : d}
            </button>
          ))}
          {['has_plan', 'no_plan', 'pending'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, planStatus: f.planStatus === p ? '' : p }))}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                filters.planStatus === p
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground'
              )}
            >
              {p === 'has_plan' ? tr.planDone : p === 'no_plan' ? tr.planNone : tr.planPending}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{language === 'ar' ? 'ترتيب:' : 'Sort:'}</span>
          {['alpha', 'severity', 'lastSession'].map((s) => {
            const labels = { alpha: tr.sortAlpha, severity: tr.sortSeverity, lastSession: tr.sortLastSession }
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  sort === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground'
                )}
              >
                {labels[s]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {language === 'ar' ? 'لا توجد نتائج' : 'No students match your filters'}
          </div>
        ) : viewMode === 'byClass' ? (
          <div className="space-y-4">
            {Object.entries(byClass).map(([cls, studs]) => (
              <ClassSection
                key={cls}
                className={cls}
                students={studs}
                onSelectStudent={onSelectStudent}
                viewMode={displayMode}
              />
            ))}
          </div>
        ) : (
          <div className={cn(
            'grid gap-3',
            displayMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-2'
          )}>
            {filtered.map((s) => (
              <StudentCard key={s.id} student={s} onSelect={onSelectStudent} viewMode={displayMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
