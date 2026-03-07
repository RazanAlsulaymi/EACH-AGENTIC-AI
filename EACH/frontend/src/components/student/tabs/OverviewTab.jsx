import { useApp } from '../../../context/AppContext'

export default function OverviewTab({ student }) {
  const { language } = useApp()
  const profile = student?.full_profile || student

  const stats = [
    {
      label: language === 'ar' ? 'الجلسات المكتملة' : 'Sessions Completed',
      value: profile?.sessions?.length || 0,
    },
    {
      label: language === 'ar' ? 'متوسط التقييم' : 'Avg Plan Score',
      value: profile?.plans?.length
        ? (
            profile.plans.reduce((s, p) => s + (p.teacher_score || p.agent_score || 0), 0) /
            profile.plans.length
          ).toFixed(1)
        : '—',
    },
    {
      label: language === 'ar' ? 'آخر جلسة' : 'Last Session',
      value: profile?.sessions?.[0]?.created_at
        ? new Date(profile.sessions[0].created_at).toLocaleDateString()
        : '—',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Latest plan snippet */}
      {profile?.plans?.[0] && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {language === 'ar' ? 'آخر خطة' : 'Latest Plan'}
          </h3>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">v{profile.plans[0].version || 1}</span>
              {profile.plans[0].teacher_score && (
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {profile.plans[0].teacher_score}/5
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 line-clamp-4">
              {(language === 'ar' ? profile.plans[0].plan_content_ar : profile.plans[0].plan_content_en)?.slice(0, 300) || '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
