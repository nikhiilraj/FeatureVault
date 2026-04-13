import { create } from 'zustand'

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

export const useAuthStore = create<AuthStore>((set) => ({
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
}))
