// Tema dell'interfaccia: "system" segue il dispositivo, "light"/"dark" forzano la scelta (preferenza del solo dispositivo)
import { useEffect } from 'react'
import { useLocalStorage } from './storage'

export const THEMES = [
  { id: 'system', label: 'Automatico' },
  { id: 'light', label: 'Chiaro' },
  { id: 'dark', label: 'Scuro' },
]

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || '#10191d'))
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('palestra:theme', 'system')
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [theme])
  return [theme, setTheme]
}
