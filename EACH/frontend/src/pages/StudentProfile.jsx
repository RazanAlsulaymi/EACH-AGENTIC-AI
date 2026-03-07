import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ProfileHeader from '../components/student/ProfileHeader'
import OverviewTab from '../components/student/tabs/OverviewTab'
import SessionsTab from '../components/student/tabs/SessionsTab'
import PlansTab from '../components/student/tabs/PlansTab'
import AssessmentsTab from '../components/student/tabs/AssessmentsTab'
import FilesTab from '../components/student/tabs/FilesTab'
import { api } from '../api/client'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'

export default function StudentProfile() {
  const { studentId } = useParams()
  const { language } = useApp()
  const tr = useTranslation(language)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    api.getStudent(parseInt(studentId))
      .then(setStudent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
          {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      </Layout>
    )
  }

  if (error || !student) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-red-500 text-sm">
          {error || (language === 'ar' ? 'الطالب غير موجود' : 'Student not found')}
        </div>
      </Layout>
    )
  }

  const profile = student?.student || student
  const studentForHeader = profile?.student_id ? profile : student

  return (
    <Layout>
      <ProfileHeader student={studentForHeader} />

      {/* Single scrollable view — all sections in one page */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto pb-12">
          <section className="border-b border-gray-100">
            <OverviewTab student={student} />
          </section>
          <section className="border-b border-gray-100">
            <SectionTitle>{tr.plans}</SectionTitle>
            <PlansTab student={student} />
          </section>
          <section className="border-b border-gray-100">
            <SectionTitle>{tr.sessions}</SectionTitle>
            <SessionsTab student={student} />
          </section>
          <section className="border-b border-gray-100">
            <SectionTitle>{tr.assessments}</SectionTitle>
            <AssessmentsTab student={student} />
          </section>
          <section>
            <SectionTitle>{tr.files}</SectionTitle>
            <FilesTab student={student} />
          </section>
        </div>
      </div>
    </Layout>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="px-6 pt-6 pb-3 text-sm font-semibold text-gray-900 sticky top-[57px] bg-white/95 backdrop-blur z-10 border-b border-gray-100 -mb-px">
      {children}
    </h2>
  )
}
