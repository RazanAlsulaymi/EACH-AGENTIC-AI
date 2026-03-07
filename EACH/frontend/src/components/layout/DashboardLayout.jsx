import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

/**
 * Standalone layout for the Dashboard page.
 * No sidebar — header with back button, logo, and title.
 */
export default function DashboardLayout({ children, title = 'Dashboard' }) {
  const { language } = useApp()
  const navigate = useNavigate()

  return (
    <div
      className={`min-h-screen bg-white flex flex-col ${language === 'ar' ? 'font-arabic' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors -m-1"
          aria-label={language === 'ar' ? 'رجوع' : 'Back'}
        >
          <ChevronLeft className={cn('size-5', language === 'ar' && 'rotate-180')} />
          <span className="text-sm font-medium">{language === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>
        <div className="flex-1 flex items-center justify-center gap-3">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="EACH" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-semibold text-gray-900 tracking-tight">EACH</span>
          </Link>
          <span className="text-gray-300">·</span>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        </div>
        <div className="w-16" aria-hidden />
      </header>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
