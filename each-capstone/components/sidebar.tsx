"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import {
  Search,
  MessageSquare,
  GraduationCap,
  Users,
  Settings,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Class, Student, ChatSession } from "@/lib/types"
import { mockClasses, mockStudents, mockRecentChats } from "@/lib/mock-data"
import Image from "next/image"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onSelectClass: (cls: Class) => void
  onSelectStudent: (student: Student) => void
  onSelectChat: (chat: ChatSession) => void
  onNavigate: (view: string) => void
  onOpenSettings: () => void
  currentView: string
  selectedClassId?: string
  students?: Student[]
  classes?: Class[]
  recentChats?: ChatSession[]
}

export function Sidebar({
  collapsed,
  onToggle,
  onSelectClass,
  onSelectStudent,
  onSelectChat,
  onNavigate,
  onOpenSettings,
  currentView,
  selectedClassId,
  students = mockStudents,
  classes = mockClasses,
  recentChats = mockRecentChats,
}: SidebarProps) {
  const { t } = useLocale()
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedSection, setExpandedSection] = useState<string | null>("recent")

  const filteredChats = recentChats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredStudents = selectedClassId
    ? students.filter(
        (s) =>
          s.classId === selectedClassId &&
          s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-72"
      )}
    >
      {/* Header: Logo + Toggle */}
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:opacity-80"
            aria-label={t("sidebar.home")}
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border">
              <Image src="/images/logo.png" alt="EACH" fill className="object-cover" />
            </div>
            <span className="text-base font-semibold tracking-tight">EACH</span>
            
          </button>
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onNavigate("home")}
                className="mx-auto flex items-center justify-center"
                aria-label={t("sidebar.home")}
              >
                <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border">
                  <Image src="/images/logo.png" alt="EACH" fill className="object-cover" />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("sidebar.home")}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
              className={cn("size-10 shrink-0", collapsed && "mx-auto mt-2")}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      {collapsed ? (
        /* Collapsed icon-only sidebar */
        <div className="flex flex-1 flex-col items-center gap-1.5 px-2 py-4">
          <SidebarIconButton
            icon={<Search className="size-5" />}
            label={t("sidebar.home")}
            active={currentView === "home"}
            onClick={() => onNavigate("home")}
          />
          <SidebarIconButton
            icon={<GraduationCap className="size-5" />}
            label={t("sidebar.classes")}
            active={currentView === "classes" || currentView === "class-detail"}
            onClick={() => onNavigate("classes")}
          />
          <SidebarIconButton
            icon={<Users className="size-5" />}
            label={t("sidebar.students")}
            active={currentView === "students"}
            onClick={() => onNavigate("students")}
          />
          <SidebarIconButton
            icon={<MessageSquare className="size-5" />}
            label={t("sidebar.recentChats")}
            active={currentView === "chat"}
            onClick={() => {}}
          />
          <div className="flex-1" />
          <Separator className="my-2 w-8" />
          <SidebarIconButton
            icon={<Settings className="size-5" />}
            label={t("sidebar.settings")}
            active={false}
            onClick={onOpenSettings}
          />
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("sidebar.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 ps-10 text-sm"
              />
            </div>
          </div>

          {/* Sections */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 px-3 pb-4">
              {/* Recent Chats */}
              <SectionHeader
                label={t("sidebar.recentChats")}
                icon={<MessageSquare className="size-4" />}
                expanded={expandedSection === "recent"}
                onToggle={() =>
                  setExpandedSection(expandedSection === "recent" ? null : "recent")
                }
              />
              {expandedSection === "recent" &&
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat)}
                    className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent"
                  >
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {chat.title}
                    </span>
                    {chat.studentName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.studentName} - {chat.className}
                      </span>
                    )}
                  </button>
                ))}

              {/* Classes */}
              <SectionHeader
                label={t("sidebar.classes")}
                icon={<GraduationCap className="size-4" />}
                expanded={expandedSection === "classes"}
                onToggle={() =>
                  setExpandedSection(expandedSection === "classes" ? null : "classes")
                }
              />
              {expandedSection === "classes" &&
                filteredClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => onSelectClass(cls)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm transition-colors hover:bg-sidebar-accent",
                      selectedClassId === cls.id && "bg-sidebar-accent"
                    )}
                  >
                    <span className="font-medium text-sidebar-foreground">
                      {cls.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cls.studentCount}
                    </span>
                  </button>
                ))}

              {/* Students */}
              <SectionHeader
                label={t("sidebar.students")}
                icon={<Users className="size-4" />}
                expanded={expandedSection === "students"}
                onToggle={() =>
                  setExpandedSection(expandedSection === "students" ? null : "students")
                }
              />
              {expandedSection === "students" &&
                filteredStudents.slice(0, 8).map((student) => (
                  <button
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent"
                  >
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {student.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {student.className}
                    </span>
                  </button>
                ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <Separator />
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={onOpenSettings}
            >
              <Settings className="size-4" />
              {t("sidebar.settings")}
            </Button>
          </div>
        </>
      )}
    </aside>
  )
}

function SidebarIconButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          onClick={onClick}
          aria-label={label}
          className="size-11"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SectionHeader({
  label,
  icon,
  expanded,
  onToggle,
}: {
  label: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="mt-3 flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-sidebar-foreground"
    >
      {icon}
      <span className="flex-1 text-start">{label}</span>
      <ChevronRight
        className={cn(
          "size-3.5 transition-transform",
          expanded && "rotate-90"
        )}
      />
    </button>
  )
}
