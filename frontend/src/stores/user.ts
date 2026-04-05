import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  id: string | null
  nickname: string | null
  avatarColor: string | null
  token: string | null
  setUser: (user: { id: string; nickname: string; avatar_color: string }, token: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      id: null,
      nickname: null,
      avatarColor: null,
      token: null,
      setUser: (user, token) => {
        localStorage.setItem('token', token)
        set({
          id: user.id,
          nickname: user.nickname,
          avatarColor: user.avatar_color,
          token,
        })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ id: null, nickname: null, avatarColor: null, token: null })
      },
    }),
    { name: 'syncwatch-user' }
  )
)
