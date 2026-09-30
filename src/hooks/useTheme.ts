import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

// Must match the key read by public/theme-init.js (applied before first paint).
const STORAGE_KEY = 'kc-theme'
const ORDER: ThemePreference[] = ['system', 'light', 'dark']

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Theme preference persisted per browser; 'system' follows prefers-color-scheme via CSS. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readStored)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, theme)
    } catch { /* storage unavailable — preference lasts for this page only */ }
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme(t => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length])
  }, [])

  return { theme, cycleTheme }
}
