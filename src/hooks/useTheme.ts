import { create } from 'zustand'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pos-theme'

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  window.localStorage.setItem(STORAGE_KEY, theme)
}

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
}

/**
 * Tema disinkronkan ke <html class="dark">. Nilai awal sudah dipasang oleh
 * script inline di index.html supaya tidak ada kedip warna sebelum paint.
 */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
