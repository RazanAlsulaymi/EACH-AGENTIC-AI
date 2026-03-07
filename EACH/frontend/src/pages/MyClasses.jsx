import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '../components/layout/Layout'
import StudentCard from '../components/classes/StudentCard'
import FilterBar from '../components/classes/FilterBar'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'

function ClassSection({ className, students }) {
  const { language } = useApp()
  const [open, setOpen] = useState(true)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{className}</span>
          <span className="text-xs text-gray-500">({students.length})</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-2">
          {students.map((s) => <StudentCard key={s.student_id} student={s} />)}
        </div>
      )}
    </div>
  )
}

export default function MyClasses() {
  const { students, studentsLoading, language } = useApp()
  const tr = useTranslation(language)

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('all')
  const [filters, setFilters] = useState({ diagnosis: '', planStatus: '' })
  const [sort, setSort] = useState('alpha')

  const filtered = useMemo(() => {
    let list = [...students]

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.name_en?.toLowerCase().includes(q) ||
          s.name_ar?.includes(search)
      )
    }

    // Diagnosis filter
    if (filters.diagnosis) {
      list = list.filter((s) =>
        s.diagnosis?.toLowerCase().includes(filters.diagnosis.toLowerCase())
      )
    }

    // Plan status
    if (filters.planStatus === 'has_plan') list = list.filter((s) => s.plan_status === 'done' || s.plan_status === 'approved')
    if (filters.planStatus === 'no_plan') list = list.filter((s) => !s.plan_status || s.plan_status === 'none')
    if (filters.planStatus === 'pending') list = list.filter((s) => s.plan_status === 'pending' || s.plan_status === 'generated')

    // Sort
    if (sort === 'alpha') list.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''))
    if (sort === 'severity') list.sort((a, b) => (a.severity_level || '').localeCompare(b.severity_level || ''))

    return list
  }, [students, search, filters, sort])

  // Group by class
  const byClass = useMemo(() => {
    const groups = {}
    filtered.forEach((s) => {
      const cls = s.class_name || s.class_id || (language === 'ar' ? 'غير محدد' : 'Unassigned')
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(s)
    })
    return groups
  }, [filtered, language])

  return (
    <Layout title={tr.myClasses}>
      <div className="max-w-5xl mx-auto w-full px-4 py-5 space-y-5">
        <FilterBar
          search={search} setSearch={setSearch}
          viewMode={viewMode} setViewMode={setViewMode}
          filters={filters} setFilters={setFilters}
          sort={sort} setSort={setSort}
        />

        {studentsLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {language === 'ar' ? 'لا توجد نتائج' : 'No students match your filters'}
          </div>
        ) : viewMode === 'byClass' ? (
          <div className="space-y-4">
            {Object.entries(byClass).map(([cls, studs]) => (
              <ClassSection key={cls} className={cls} students={studs} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => <StudentCard key={s.student_id} student={s} />)}
          </div>
        )}
      </div>
    </Layout>
  )
}
