import { Menu } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useApp } from '../../context/AppContext'

export default function Layout({ children, title, rightSlot, showBack = false }) {
  const { isSidebarOpen, setIsSidebarOpen, language } = useApp()

  return (
    <div className={`min-h-screen bg-white flex flex-col ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Center slot */}
        <div className="flex-1 flex items-center justify-center gap-3">
          {title ? (
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          ) : (
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="EACH" className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-semibold text-gray-900 tracking-tight">EACH</span>
            </Link>
          )}
        </div>

        {/* Right slot */}
        <div className="flex-shrink-0 w-10 flex justify-end">
          {rightSlot || null}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}
