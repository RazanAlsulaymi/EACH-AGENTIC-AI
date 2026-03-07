import { Users, BookOpen, CalendarCheck, Clock, FileText } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import StatCard from '../components/dashboard/StatCard'
import StudentStatusTable from '../components/dashboard/StudentStatusTable'
import PendingPlansWidget from '../components/dashboard/PendingPlansWidget'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'

export default function Dashboard() {
  const { students, studentsLoading, language } = useApp()
  const tr = useTranslation(language)

  // Compute stats from students
  const totalStudents = students.length
  const totalClasses = [...new Set(students.map((s) => s.class_id).filter(Boolean))].length
  const sessionsThisWeek = students.filter((s) => s.session_this_week).length
  const pendingApproval = students.filter((s) => s.plan_status === 'pending' || s.plan_status === 'generated').length
  const plansGenerated = students.filter((s) => s.plan_status !== 'none' && s.plan_status).length

  const stats = [
    { label: tr.totalStudents, value: totalStudents, icon: Users },
    { label: tr.totalClasses, value: totalClasses || '—', icon: BookOpen },
    { label: tr.sessionsThisWeek, value: sessionsThisWeek, icon: CalendarCheck },
    { label: tr.pendingApproval, value: pendingApproval, icon: Clock, accent: pendingApproval > 0 ? 'bg-yellow-100' : undefined },
    { label: tr.plansGenerated, value: plansGenerated, icon: FileText },
  ]

  return (
    <DashboardLayout title={tr.dashboard}>
      <div className="px-4 py-5 max-w-5xl mx-auto w-full space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Student status table */}
        {studentsLoading ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {language === 'ar' ? 'جارٍ التحميل...' : 'Loading students...'}
          </div>
        ) : (
          <StudentStatusTable students={students} />
        )}

        {/* Bottom widgets */}
        <div className="grid sm:grid-cols-2 gap-4">
          <PendingPlansWidget students={students} />
          <ActivityFeed students={students} />
        </div>
      </div>
    </DashboardLayout>
  )
}
