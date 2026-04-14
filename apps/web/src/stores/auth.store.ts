import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id:          string
  email:       string
  firstName?:  string
  lastName?:   string
  role:        string
  workspaceId: string
}

interface AuthStore {
  user:      User | null
  token:     string | null
  setAuth:   (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:  null,
      token: null,

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') window.__fv_token = token
        set({ user, token })
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') window.__fv_token = undefined
        set({ user: null, token: null })
      },
    }),
    {
      name: 'fv-auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state && state.token) {
          if (typeof window !== 'undefined') window.__fv_token = state.token
        }
      }
    }
  )
)
