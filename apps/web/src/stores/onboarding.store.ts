import { create } from 'zustand'

export type OnboardingStep = 'welcome' | 'create-flag' | 'sdk-key' | 'verify' | 'complete'

interface OnboardingStore {
  step:           OnboardingStep
  createdFlagKey: string | null
  sdkKey:         string | null
  projectId:      string | null
  isComplete:     boolean
  setStep:        (step: OnboardingStep) => void
  setCreatedFlag: (key: string) => void
  setSdkKey:      (key: string) => void
  setProjectId:   (id: string) => void
  complete:       () => void
  reset:          () => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  step:           'welcome',
  createdFlagKey: null,
  sdkKey:         null,
  projectId:      null,
  isComplete:     false,

  setStep:        (step)      => set({ step }),
  setCreatedFlag: (key)       => set({ createdFlagKey: key }),
  setSdkKey:      (key)       => set({ sdkKey: key }),
  setProjectId:   (id)        => set({ projectId: id }),
  complete:       ()          => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fv_onboarding_complete', '1')
    }
    set({ isComplete: true, step: 'complete' })
  },
  reset: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fv_onboarding_complete')
    }
    set({ step: 'welcome', createdFlagKey: null, sdkKey: null, isComplete: false })
  },
}))
