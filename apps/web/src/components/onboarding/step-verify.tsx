'use client'
import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api } from '@/lib/api'

export function StepVerify({ projectId }: { projectId: string }) {
  const { complete, sdkKey, createdFlagKey } = useOnboardingStore()
  const [checking, setChecking]   = useState(false)
  const [verified, setVerified]   = useState(false)
  const [error, setError]         = useState('')

  const verify = async () => {
    if (!sdkKey) { setError('No SDK key found. Go back and generate one.'); return }
    setChecking(true); setError('')
    try {
      const res = await api.get('/sdk/v1/flags', {
        headers: { 'X-API-Key': sdkKey },
      })
      if (res.data.flags !== undefined) {
        setVerified(true)
        setTimeout(() => complete(), 1400)
      } else {
        setError('Unexpected response from API.')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Could not reach the SDK endpoint.')
    } finally {
      setChecking(false)
    }
  }

  if (verified) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(29,158,117,0.12)',
          border: '2px solid #1D9E75',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(29,158,117,0.3)',
          animation: 'pulse 1s ease-in-out',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14l6 6 10-10" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#f0f0f0' }}>
          You&apos;re all set
        </h2>
        <p style={{ fontSize: 15, color: '#606060', margin: 0 }}>
          SDK key verified. Taking you to the dashboard.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#f0f0f0' }}>
          Verify the connection
        </h2>
        <p style={{ fontSize: 14, color: '#606060', margin: 0, lineHeight: 1.6 }}>
          We&apos;ll test your SDK key against the API to confirm everything is working.
        </p>
      </div>

      {/* What we're checking */}
      <div style={{ marginBottom: 28 }}>
        {[
          { label: 'API reachable',     sub: 'GET /sdk/v1/flags responds' },
          { label: 'SDK key valid',     sub: 'Key hash matches database' },
          { label: 'Flags accessible',  sub: `"${createdFlagKey || 'your-flag'}" visible to SDK` },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 8,
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            marginBottom: 4,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: '1.5px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#505050' }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px 14px', borderRadius: 8, marginBottom: 20,
          border: '1px solid rgba(255,95,86,0.2)',
          background: 'rgba(255,95,86,0.06)',
          fontSize: 13, color: '#ff8a84', lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => useOnboardingStore.getState().setStep('sdk-key')}
          style={{
            flex: '0 0 auto', padding: '11px 18px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            color: '#606060', fontSize: 14, cursor: 'pointer',
            transition: 'color 150ms ease', fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#a0a0a0'}
          onMouseLeave={e => e.currentTarget.style.color = '#606060'}>
          Back
        </button>
        <button
          onClick={verify}
          disabled={checking}
          style={{
            flex: 1, padding: '11px 20px', borderRadius: 8, border: 'none',
            background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: checking ? 'wait' : 'pointer',
            transition: 'background 200ms ease', fontFamily: 'DM Sans, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => { if (!checking) (e.currentTarget).style.background = '#0F6E56' }}
          onMouseLeave={e => { if (!checking) (e.currentTarget).style.background = '#1D9E75' }}>
          {checking ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ animation: 'spin 600ms linear infinite' }}>
                <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Verifying...
            </>
          ) : 'Run verification'}
        </button>
        <button
          onClick={() => complete()}
          style={{
            flex: '0 0 auto', padding: '11px 18px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            color: '#404040', fontSize: 13, cursor: 'pointer',
            transition: 'color 150ms ease', fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#707070'}
          onMouseLeave={e => e.currentTarget.style.color = '#404040'}>
          Skip
        </button>
      </div>
    </div>
  )
}
