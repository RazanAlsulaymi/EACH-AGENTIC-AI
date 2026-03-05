"use client"

import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Moon, Sun, Monitor, Globe, Shield, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t } = useLocale()
  const router = useRouter()
  const [showPrivacy, setShowPrivacy] = useState(false)

  const handleLogout = () => {
    onOpenChange(false)
    router.push("/")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold">
            {t("settings.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("settings.title")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          {/* Theme */}
          <div className="flex flex-col gap-3 px-6 py-4">
            <span className="text-sm font-medium text-foreground">
              {t("settings.theme")}
            </span>
            <div className="flex gap-2">
              {[
                { value: "light", label: t("settings.themeLight"), icon: Sun },
                { value: "dark", label: t("settings.themeDark"), icon: Moon },
                { value: "system", label: t("settings.themeSystem"), icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex-1 gap-2 text-xs",
                    theme === value && "border border-border"
                  )}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Language */}
          <div className="flex flex-col gap-3 px-6 py-4">
            <span className="text-sm font-medium text-foreground">
              {t("settings.language")}
            </span>
            <div className="flex gap-2">
              {[
                { value: "en" as const, label: t("settings.langEn") },
                { value: "ar" as const, label: t("settings.langAr") },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  variant={locale === value ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex-1 gap-2 text-xs",
                    locale === value && "border border-border"
                  )}
                  onClick={() => setLocale(value)}
                >
                  <Globe className="size-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Privacy */}
          <div className="px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sm text-muted-foreground"
              onClick={() => setShowPrivacy(!showPrivacy)}
            >
              <Shield className="size-4" />
              {t("settings.privacy")}
            </Button>
            {showPrivacy && (
              <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t("settings.privacyText")}
              </p>
            )}
          </div>

          <Separator />

          {/* Logout */}
          <div className="px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sm text-destructive-foreground"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              {t("settings.logout")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
