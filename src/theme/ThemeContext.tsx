import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { settingsRepository } from '../data'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const settings = await settingsRepository.get()
      if (!cancelled) {
        setThemeState(settings.theme)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    await settingsRepository.update({ theme: newTheme })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
