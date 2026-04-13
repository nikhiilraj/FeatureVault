import { create } from 'zustand'

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface WSStore {
  status:    WSStatus
  setStatus: (status: WSStatus) => void
}

export const useWSStore = create<WSStore>((set) => ({
  status:    'disconnected',
  setStatus: (status) => set({ status }),
}))
