'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api } from '@/lib/api'

export function StepSDKKey({ projectId }: { projectId: string }) {
  const { setStep, setSdkKey, sdkKey, createdFlagKey } = useOnboardingStore()
  const [copied, setCopied] = useState(false)
  const [keyName]   = useState('Development key')

  const createKeyMutation = useMutation({
    mutationFn: () => api.post(`/v1/projects/${projectId}/sdk-keys`, {
      name:        keyName,
      keyType:     'server',
      environment: 'development',
    }),
    onSuccess: (res) => {
      setSdkKey(res.data.data.key)
    },
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#f0f0f0' }}>
          Get your SDK key
        </h2>
        <p style={{ fontSize: 14, color: '#606060', margin: 0, lineHeight: 1.6 }}>
          Your SDK authenticates with this key. We store only a hash — the raw key is shown once.
        </p>
      </div>

      {!sdkKey ? (
        <div>
          <div style={{
            padding: '20px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)', marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0', marginBottom: 4 }}>Development key</div>
            <div style={{ fontSize: 12, color: '#606060' }}>
              Server-side · Development environment · Full read access
            </div>
          </div>

          <button
            onClick={() => createKeyMutation.mutate()}
            disabled={createKeyMutation.isPending}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none',
              background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'background 200ms ease',
              fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#0F6E56'}
            onMouseLeave={e => e.currentTarget.style.background = '#1D9E75'}>
            {createKeyMutation.isPending ? 'Generating...' : 'Generate SDK key'}
          </button>
        </div>
      ) : (
        <div>
          {/* Key display */}
          <div style={{
            borderRadius: 10,
            border: '1px solid rgba(255,193,7,0.2)',
            background: 'rgba(255,193,7,0.04)', marginBottom: 20, overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,193,7,0.1)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v6M4 10h6M7 10v3" stroke="#FFB800" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, color: '#FFB800', fontWeight: 500 }}>
                Copy this key now — it won&apos;t be shown again
              </span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <code style={{
                fontSize: 12, fontFamily: 'DM Mono, monospace',
                color: '#5DCAA5', wordBreak: 'break-all', flex: 1,
              }}>
                {sdkKey}
              </code>
              <button
                onClick={() => copy(sdkKey)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: copied ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.05)',
                  color: copied ? '#1D9E75' : '#a0a0a0',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 150ms ease', fontFamily: 'DM Sans, sans-serif',
                }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Install instructions */}
          <div style={{
            borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
            background: '#0f0f0f', overflow: 'hidden', marginBottom: 24,
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 6px #1D9E75' }} />
              <span style={{ fontSize: 11, color: '#404040', fontFamily: 'DM Mono, monospace' }}>terminal</span>
            </div>
            <pre style={{ margin: 0, padding: '16px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12.5, lineHeight: 1.8, color: '#c9d1d9' }}>
              <code>
                <span style={{ color: '#8b949e' }}># Install</span>{'\n'}
                {'$ npm install featurevault-node\n\n'}
                <span style={{ color: '#8b949e' }}># Initialize</span>{'\n'}
                {`const vault = new FeatureVault({\n`}
                {`  apiKey: '`}<span style={{ color: '#5DCAA5' }}>{sdkKey.slice(0, 20)}...</span>{`',\n`}
                {`  apiUrl: 'http://localhost:4000',\n`}
                {`})\n`}
                {`await vault.connect()\n\n`}
                {`vault.isEnabled(`}<span style={{ color: '#a5d6ff' }}>&apos;{createdFlagKey || 'your-flag'}&apos;</span>{`, { userId })`}
              </code>
            </pre>
          </div>

          <button
            onClick={() => setStep('verify')}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none',
              background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'background 200ms ease',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#0F6E56'}
            onMouseLeave={e => e.currentTarget.style.background = '#1D9E75'}>
            I&apos;ve copied the key
          </button>
        </div>
      )}
    </div>
  )
}
