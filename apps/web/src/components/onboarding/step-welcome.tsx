'use client'
import { useOnboardingStore } from '@/stores/onboarding.store'

export function StepWelcome() {
  const { setStep } = useOnboardingStore()

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 16, margin: '0 auto 28px',
        background: 'rgba(29,158,117,0.12)',
        border: '1px solid rgba(29,158,117,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="3" width="10" height="10" rx="2.5" fill="#1D9E75"/>
          <rect x="15" y="3" width="10" height="10" rx="2.5" fill="#1D9E75" opacity="0.5"/>
          <rect x="3" y="15" width="10" height="10" rx="2.5" fill="#1D9E75" opacity="0.3"/>
          <rect x="15" y="15" width="10" height="10" rx="2.5" fill="#1D9E75" opacity="0.7"/>
        </svg>
      </div>

      <h2 style={{
        fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em',
        margin: '0 0 12px', color: '#f0f0f0', lineHeight: 1.15,
      }}>
        Welcome to FeatureVault
      </h2>
      <p style={{
        fontSize: 15, color: '#707070', lineHeight: 1.65,
        margin: '0 auto 36px', maxWidth: 400,
      }}>
        You&apos;re two minutes away from shipping features safely. We&apos;ll walk you through creating your first flag and connecting your application.
      </p>

      {/* What to expect */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 12, margin: '0 0 40px', textAlign: 'left',
      }}>
        {[
          { n: '01', label: 'Create a feature flag', sub: 'Name it, set the type, save it' },
          { n: '02', label: 'Get your SDK key',       sub: 'One key per environment' },
          { n: '03', label: 'Install the SDK',        sub: 'npm install featurevault-node' },
          { n: '04', label: 'Verify the connection',  sub: 'Confirm flags are reachable' },
        ].map(item => (
          <div key={item.n} style={{
            padding: '14px 16px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', fontFamily: 'DM Mono, monospace', marginBottom: 5, letterSpacing: '0.06em' }}>
              {item.n}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: '#606060' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setStep('create-flag')}
        style={{
          width: '100%', padding: '13px 24px',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#1D9E75', color: '#fff',
          fontSize: 15, fontWeight: 600,
          transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onMouseEnter={e => { (e.currentTarget).style.background = '#0F6E56'; (e.currentTarget).style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { (e.currentTarget).style.background = '#1D9E75'; (e.currentTarget).style.transform = 'translateY(0)' }}>
        Get started
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
