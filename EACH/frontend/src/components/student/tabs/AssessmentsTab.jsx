import { useApp } from '../../../context/AppContext'

const sourceTag = (source) => {
  const styles = {
    manual: 'bg-gray-100 text-gray-600',
    ai_session: 'bg-blue-100 text-blue-700',
    iep_upload: 'bg-purple-100 text-purple-700',
  }
  return styles[source] || styles.manual
}

export default function AssessmentsTab({ student }) {
  const { language } = useApp()
  const assessments = student?.full_profile?.assessments || []

  return (
    <div className="p-6">
      {assessments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {language === 'ar' ? 'لا توجد تقييمات مسجلة' : 'No assessments recorded yet'}
        </p>
      ) : (
        <div className="space-y-3">
          {assessments.map((a, i) => (
            <div key={a.id || i} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceTag(a.source)}`}>
                  {a.source?.replace(/_/g, ' ') || 'Manual'}
                </span>
                <span className="text-xs text-gray-400">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <p className="text-sm text-gray-700">{a.insights || a.summary || '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
