import { useState } from 'react'
import {
  Search,
  MessageSquare,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'

function SidebarIconButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      {icon}
    </button>
  )
}

function SectionHeader({ label, icon, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-sidebar-foreground"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')} />
    </button>
  )
}

export default function SidebarV2({
  collapsed,
  onToggle,
  onSelectClass,
  onSelectStudent,
  onSelectChat,
  onNavigate,
  onOpenSettings,
  onNavigateToDashboard,
  currentView,
  selectedClassId,
  students = [],
  classes = [],
  recentChats = [],
}) {
  const { language } = useApp()
  const tr = useTranslation(language)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSection, setExpandedSection] = useState('recent')

  const filteredChats = recentChats.filter((c) =>
    (c.title || c.preview || '').toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredClasses = classes.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredStudents = selectedClassId
    ? students.filter(
        (s) =>
          (s.className || s.classId || '') === selectedClassId &&
          (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students.filter((s) => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()))

  const labels = {
    home: tr.home,
    dashboard: tr.dashboard,
    classes: tr.myClasses,
    students: tr.allStudents,
    recentChats: tr.recentMessages,
    search: language === 'ar' ? 'بحث...' : 'Search...',
    settings: tr.settings,
    studentsCount: language === 'ar' ? 'طالب' : 'students',
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-72'
      )}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Header: Logo + Toggle */}
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:opacity-80"
            aria-label={labels.home}
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border">
              <img src="/logo.png" alt="EACH" className="size-full object-cover" />
            </div>
            <span className="text-base font-semibold tracking-tight">EACH</span>
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mx-auto flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
            aria-label={labels.home}
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border">
              <img src="/logo.png" alt="EACH" className="size-full object-cover" />
            </div>
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground', collapsed && 'mx-auto mt-2')}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      </div>

      <div className="h-px shrink-0 bg-border" />

      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-1.5 px-2 py-4">
          <SidebarIconButton
            icon={<Search className="size-5" />}
            label={labels.home}
            active={currentView === 'home'}
            onClick={() => onNavigate('home')}
          />
          {onNavigateToDashboard && (
            <SidebarIconButton
              icon={<LayoutDashboard className="size-5" />}
              label={labels.dashboard}
              active={false}
              onClick={onNavigateToDashboard}
            />
          )}
          <SidebarIconButton
            icon={<GraduationCap className="size-5" />}
            label={labels.classes}
            active={currentView === 'classes'}
            onClick={() => onNavigate('classes')}
          />
          <SidebarIconButton
            icon={<MessageSquare className="size-5" />}
            label={labels.recentChats}
            active={currentView === 'chat'}
            onClick={() => onNavigate('chat')}
          />
          <div className="flex-1" />
          <div className="my-2 h-px w-8 bg-border" />
          <SidebarIconButton
            icon={<Settings className="size-5" />}
            label={labels.settings}
            active={false}
            onClick={onOpenSettings}
          />
        </div>
      ) : (
        <>
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={labels.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0.5 px-3 pb-4">
              {onNavigateToDashboard && (
                <button
                  type="button"
                  onClick={onNavigateToDashboard}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                >
                  <LayoutDashboard className="size-4 shrink-0" />
                  {labels.dashboard}
                </button>
              )}
              <SectionHeader
                label={labels.recentChats}
                icon={<MessageSquare className="size-4" />}
                expanded={expandedSection === 'recent'}
                onToggle={() => setExpandedSection(expandedSection === 'recent' ? null : 'recent')}
              />
              {expandedSection === 'recent' &&
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => onSelectChat(chat)}
                    className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
                  >
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {chat.title || chat.preview || 'Session'}
                    </span>
                    {chat.studentName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.studentName} {chat.className ? `- ${chat.className}` : ''}
                      </span>
                    )}
                  </button>
                ))}

              <SectionHeader
                label={labels.classes}
                icon={<GraduationCap className="size-4" />}
                expanded={expandedSection === 'classes'}
                onToggle={() => setExpandedSection(expandedSection === 'classes' ? null : 'classes')}
              />
              {expandedSection === 'classes' &&
                filteredClasses.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => { onNavigate('classes'); onSelectClass?.(cls); }}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sidebar-accent',
                      currentView === 'classes' && selectedClassId === cls.id && 'bg-sidebar-accent'
                    )}
                  >
                    <span className="font-medium text-sidebar-foreground">{cls.name}</span>
                    <span className="text-xs text-muted-foreground">{cls.studentCount}</span>
                  </button>
                ))}
              {expandedSection === 'classes' &&
                filteredStudents.slice(0, 8).map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => onSelectStudent(student)}
                    className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
                  >
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {student.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {student.className || student.classId || '—'}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="h-px shrink-0 bg-border" />
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Settings className="size-4" />
              {labels.settings}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
