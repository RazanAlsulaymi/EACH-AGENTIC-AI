import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'
import { diagnosisBadge } from '../classes/StudentCard'

function PlanChip({ status, tr }) {
  const styles = {
    done: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    none: 'bg-gray-100 text-gray-500',
  }
  const labels = { done: tr.planDone, pending: tr.planPending, none: tr.planNone }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] || styles.none}`}>
      {labels[status] || labels.none}
    </span>
  )
}

function ScoreDot({ score }) {
  if (!score) return <span className="text-gray-300 text-sm">—</span>
  const color = score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-bold text-sm ${color}`}>{score}/5</span>
}

export default function StudentStatusTable({ students }) {
  const { language } = useApp()
  const tr = useTranslation(language)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">
          {language === 'ar' ? 'حالة الطلاب هذا الأسبوع' : "This Week's Student Status"}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-start font-medium">
                {language === 'ar' ? 'الطالب' : 'Student'}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {language === 'ar' ? 'جلسة' : 'Session'}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {language === 'ar' ? 'الخطة' : 'Plan'}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {language === 'ar' ? 'التقييم' : 'Score'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s) => (
              <tr key={s.student_id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                      {(s.name_en || s.name_ar || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{s.name_en || s.name_ar}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diagnosisBadge(s.diagnosis)}`}>
                        {s.diagnosis || '—'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {s.session_this_week ? '✅' : '❌'}
                </td>
                <td className="px-4 py-3 text-center">
                  <PlanChip status={s.plan_status || 'none'} tr={tr} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreDot score={s.latest_eval_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
