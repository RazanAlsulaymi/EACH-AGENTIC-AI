"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { type Locale, t } from "@/lib/i18n"

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
  dir: "ltr" | "rtl"
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    document.documentElement.lang = newLocale
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr"
  }, [])

  const translate = useCallback(
    (key: string, params?: Record<string, string>) => t(locale, key, params),
    [locale]
  )

  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: translate, dir }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error("useLocale must be used within LocaleProvider")
  return context
}
