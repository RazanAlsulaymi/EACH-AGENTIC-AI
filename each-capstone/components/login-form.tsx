"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { type Locale, t } from "@/lib/i18n"
import Image from "next/image"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [locale, setLocale] = useState<Locale>("en")

  const dir = locale === "ar" ? "rtl" : "ltr"

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/dashboard")
  }

  const toggleLocale = () => {
    const next = locale === "en" ? "ar" : "en"
    setLocale(next)
    document.documentElement.lang = next
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr"
  }

  return (
    <div dir={dir} className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative size-10 overflow-hidden rounded-full border border-border bg-card">
            <Image
              src="/images/logo.png"
              alt="EACH logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            EACH
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLocale}
                className="h-9 w-11 text-xs font-medium"
              >
                {locale === "en" ? "AR" : "EN"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "en" ? "Switch to Arabic" : "Switch to English"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={t(locale, "theme.toggle")}
                className="size-9"
              >
                <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(locale, "theme.toggle")}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Center content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="relative size-24 overflow-hidden rounded-full border-2 border-border bg-card shadow-sm">
            <Image
              src="/images/logo.png"
              alt="EACH logo"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t(locale, "login.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(locale, "login.subtitle")}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSignIn}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-7"
          >
            <Input
              type="email"
              placeholder={t(locale, "login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-13 text-sm"
            />
            <Input
              type="password"
              placeholder={t(locale, "login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-13 text-sm"
            />
            <Button type="submit" className="mt-1 h-12 w-full text-sm font-medium">
              {t(locale, "login.submit")}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 pb-8 text-xs text-muted-foreground">
        <button className="transition-colors hover:text-foreground">
          {t(locale, "login.privacy")}
        </button>
        <span className="text-border">{"·"}</span>
        <button className="transition-colors hover:text-foreground">
          {t(locale, "login.terms")}
        </button>
        <span className="text-border">{"·"}</span>
        <button className="transition-colors hover:text-foreground">
          {t(locale, "login.about")}
        </button>
      </footer>
    </div>
  )
}
