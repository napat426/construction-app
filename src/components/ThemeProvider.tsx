'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
})

/** Applies the theme to the <html> and <body> elements and persists it */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  const body = document.body
  
  console.log(`[applyTheme] Applying theme: "${theme}"`);
  
  if (theme === 'dark') {
    root.classList.add('dark')
    body?.classList.add('dark')
  } else {
    root.classList.remove('dark')
    body?.classList.remove('dark')
  }
  
  localStorage.setItem('theme', theme)
  console.log('[applyTheme] DOM classes - HTML:', root.className, 'Body:', body?.className);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  // On mount: read from localStorage and sync DOM
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    const initial: Theme = saved === 'light' ? 'light' : 'dark'
    setTheme(initial)
    applyTheme(initial)
  }, [])

  /**
   * Use the functional-update form of setTheme so we always read
   * the REAL current state (prev), never a stale closure value.
   * This is the key fix for the "stuck on dark" bug.
   */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, []) // empty deps — safe because we use functional update

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
