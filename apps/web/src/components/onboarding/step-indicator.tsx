'use client'
import type { OnboardingStep } from '@/stores/onboarding.store'

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'welcome',     label: 'Welcome'    },
  { id: 'create-flag', label: 'First flag' },
  { id: 'sdk-key',     label: 'SDK key'    },
  { id: 'verify',      label: 'Verify'     },
]

const ORDER: OnboardingStep[] = ['welcome', 'create-flag', 'sdk-key', 'verify', 'complete']

export function StepIndicator({ current }: { current: OnboardingStep }) {
  const currentIdx = ORDER.indexOf(current)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEPS.map((step, i) => {
        const stepIdx = ORDER.indexOf(step.id)
        const isDone    = stepIdx < currentIdx
        const isActive  = stepIdx === currentIdx
        const isPending = stepIdx > currentIdx

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Step circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
                background: isDone ? '#1D9E75' : isActive ? '#1D9E75' : 'transparent',
                border: `2px solid ${isDone || isActive ? '#1D9E75' : 'rgba(255,255,255,0.15)'}`,
                color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                boxShadow: isActive ? '0 0 16px rgba(29,158,117,0.4)' : 'none',
              }}>
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 600 : 400,
                color: isDone || isActive ? '#a0a0a0' : 'rgba(255,255,255,0.2)',
                letterSpacing: '0.02em',
                transition: 'color 300ms ease',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                width: 64, height: 2, margin: '-18px 8px 0',
                background: stepIdx < currentIdx
                  ? 'linear-gradient(90deg, #1D9E75, #1D9E75)'
                  : 'rgba(255,255,255,0.08)',
                transition: 'background 400ms ease',
                borderRadius: 2,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
