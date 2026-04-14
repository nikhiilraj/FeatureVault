'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { StepIndicator } from './step-indicator'
import { StepWelcome } from './step-welcome'
import { StepCreateFlag } from './step-create-flag'
import { StepSDKKey } from './step-sdk-key'
import { StepVerify } from './step-verify'
import { api } from '@/lib/api'

function useProjectId() {
  const { user } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['projects', user?.workspaceId],
    queryFn:  () => api.get('/v1/workspaces/me/projects').then(r => r.data.data),
    enabled:  !!user,
  })
  return data?.[0]?.id as string | undefined
}

function useHasFlags(projectId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['flags', projectId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/flags`).then(r => r.data),
    enabled:  !!projectId,
  })
  return (data?.pagination?.total ?? 0) > 0
}

export function OnboardingModal() {
  const { step, isComplete, setProjectId, complete } = useOnboardingStore()
  const projectId = useProjectId()
  const hasFlags  = useHasFlags(projectId)
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const done = typeof window !== 'undefined' && localStorage.getItem('fv_onboarding_complete')
    if (done) return
    // Show onboarding if user has no flags
    if (projectId && !hasFlags) {
      setProjectId(projectId)
      setShow(true)
    }
  }, [mounted, projectId, hasFlags, setProjectId])

  useEffect(() => {
    if (isComplete) setShow(false)
  }, [isComplete])

  if (!show || !projectId || !mounted) return null

  const showStepIndicator = step !== 'welcome' && step !== 'complete'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { complete(); setShow(false) }}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 200ms ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 101,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 520,
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#141414',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(29,158,117,0.08)',
          overflow: 'hidden',
          pointerEvents: 'all',
          animation: 'slideUp 300ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {showStepIndicator ? (
              <StepIndicator current={step} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                  <rect x="2" y="2" width="8" height="8" rx="2" fill="#1D9E75"/>
                  <rect x="12" y="2" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.5"/>
                  <rect x="2" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.3"/>
                  <rect x="12" y="12" width="8" height="8" rx="2" fill="#1D9E75" opacity="0.7"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#606060' }}>FeatureVault</span>
              </div>
            )}

            <button
              onClick={() => { complete(); setShow(false) }}
              style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                background: 'rgba(255,255,255,0.05)', color: '#404040',
                cursor: 'pointer', fontSize: 16, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#a0a0a0' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#404040' }}
              title="Skip setup">
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 24px 28px' }}>
            {step === 'welcome'     && <StepWelcome />}
            {step === 'create-flag' && <StepCreateFlag projectId={projectId} />}
            {step === 'sdk-key'     && <StepSDKKey projectId={projectId} />}
            {step === 'verify'      && <StepVerify projectId={projectId} />}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
      `}</style>
    </>
  )
}
