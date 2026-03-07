import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

export default function PendingPlansWidget({ students }) {
  const { language } = useApp()
  const tr = useTranslation(language)

  const pending = students.filter((s) => s.plan_status === 'pending' || s.plan_status === 'generated')

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">{tr.pendingPlans}</h3>
        <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
          {pending.length}
        </span>
      </div>
      {pending.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">
          {language === 'ar' ? 'لا توجد خطط بانتظار الموافقة' : 'No plans pending approval'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {pending.slice(0, 5).map((s) => (
            <li key={s.student_id} className="px-5 py-3">
              <p className="text-sm font-medium text-gray-900">{s.name_en || s.name_ar}</p>
              <p className="text-xs text-gray-500">{s.diagnosis}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
