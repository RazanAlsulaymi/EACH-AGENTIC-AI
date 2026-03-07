import { Search } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

export default function FilterBar({
  search, setSearch,
  viewMode, setViewMode,
  filters, setFilters,
  sort, setSort,
}) {
  const { language } = useApp()
  const tr = useTranslation(language)

  const sel = (key, val) =>
    `text-xs px-3 py-1.5 rounded-full font-medium border transition-all cursor-pointer ${
      filters[key] === val || (key === 'view' && viewMode === val)
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`

  return (
    <div className="space-y-3">
      {/* Search + view toggle */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-gray-400">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr.searchStudents}
            className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('byClass')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${viewMode === 'byClass' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {tr.byClass}
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 text-xs font-medium transition-colors border-l border-gray-200 ${viewMode === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {tr.allStudents}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Diagnosis */}
        {['All', 'ADHD', 'Autism', 'Dyslexia', 'Processing Disorder'].map((d) => (
          <button
            key={d}
            onClick={() => setFilters((f) => ({ ...f, diagnosis: d === 'All' ? '' : d }))}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
              (d === 'All' && !filters.diagnosis) || filters.diagnosis === d
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {d === 'All' ? (language === 'ar' ? 'الكل' : 'All') : d}
          </button>
        ))}

        {/* Plan status */}
        {['has_plan', 'no_plan', 'pending'].map((p) => (
          <button
            key={p}
            onClick={() => setFilters((f) => ({ ...f, planStatus: f.planStatus === p ? '' : p }))}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
              filters.planStatus === p
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {p === 'has_plan' ? tr.planDone : p === 'no_plan' ? tr.planNone : tr.planPending}
          </button>
        ))}

      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{language === 'ar' ? 'ترتيب:' : 'Sort:'}</span>
        {['alpha', 'severity', 'lastSession'].map((s) => {
          const labels = { alpha: tr.sortAlpha, severity: tr.sortSeverity, lastSession: tr.sortLastSession }
          return (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                sort === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {labels[s]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
