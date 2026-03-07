import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [language, setLanguage] = useState(
    () => localStorage.getItem('each_language') || 'en'
  )
  const [teacherName, setTeacherNameState] = useState(
    () => localStorage.getItem('each_teacher_name') || ''
  )
  const [activeStudentId, setActiveStudentId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const setTeacherName = useCallback((name) => {
    setTeacherNameState(name)
    localStorage.setItem('each_teacher_name', name)
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next = prev === 'en' ? 'ar' : 'en'
      localStorage.setItem('each_language', next)
      return next
    })
  }, [])

  const setLanguageExplicit = useCallback((lang) => {
    setLanguage(lang)
    localStorage.setItem('each_language', lang)
  }, [])

  const loadStudents = useCallback(async () => {
    try {
      setStudentsLoading(true)
      const data = await api.getStudents()
      setStudents(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load students:', e)
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // Lookup student by name (for "say a student's name to begin" feature)
  const findStudentByName = useCallback(
    (query) => {
      const q = query.toLowerCase()
      return students.find(
        (s) =>
          s.name_en?.toLowerCase().includes(q) ||
          s.name_ar?.includes(query)
      )
    },
    [students]
  )

  return (
    <AppContext.Provider
      value={{
        students,
        studentsLoading,
        loadStudents,
        language,
        toggleLanguage,
        setLanguage: setLanguageExplicit,
        teacherName,
        setTeacherName,
        activeStudentId,
        setActiveStudentId,
        isSidebarOpen,
        setIsSidebarOpen,
        findStudentByName,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
