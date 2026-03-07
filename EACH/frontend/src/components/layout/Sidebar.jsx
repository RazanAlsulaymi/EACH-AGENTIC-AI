import { NavLink } from 'react-router-dom'
import { Home, LayoutDashboard, MessageSquare, GraduationCap, Settings, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTranslation } from '../../lib/i18n'

export default function Sidebar() {
  const { language, isSidebarOpen, setIsSidebarOpen } = useApp()
  const tr = useTranslation(language)

  if (!isSidebarOpen) return null

  const navItems = [
    { icon: Home, label: tr.home, to: '/', end: true },
    { icon: LayoutDashboard, label: tr.dashboard, to: '/dashboard' },
    { icon: MessageSquare, label: tr.recentMessages, to: '/messages' },
    { icon: GraduationCap, label: tr.myClasses, to: '/classes' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 ${language === 'ar' ? 'right-0' : 'left-0'} h-full w-64 bg-white border-${language === 'ar' ? 'l' : 'r'} border-gray-200 z-50 flex flex-col shadow-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="EACH" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-semibold text-gray-900 text-lg tracking-tight">EACH</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ icon: Icon, label, to, badge, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Settings pinned at bottom */}
        <div className="px-3 py-4 border-t border-gray-200">
          <NavLink
            to="/settings"
            onClick={() => setIsSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Settings size={18} />
            <span>{tr.settings}</span>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
