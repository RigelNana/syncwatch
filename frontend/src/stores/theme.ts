import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  dark: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: true,
      toggle: () => {
        const next = !get().dark
        set({ dark: next })
        document.documentElement.classList.toggle('dark', next)
      },
    }),
    {
      name: 'syncwatch-theme',
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            document.documentElement.classList.toggle('dark', state.dark)
          }
        }
      },
    }
  )
)
