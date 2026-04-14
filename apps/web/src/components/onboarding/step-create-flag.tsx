'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api } from '@/lib/api'

export function StepCreateFlag({ projectId }: { projectId: string }) {
  const { setStep, setCreatedFlag } = useOnboardingStore()
  const qc = useQueryClient()
  const [name, setName]   = useState('')
  const [key, setKey]     = useState('')
  const [error, setError] = useState('')

  const derivedKey = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const createMutation = useMutation({
    mutationFn: () => api.post(`/v1/projects/${projectId}/flags`, {
      key, name, type: 'boolean', defaultValue: false,
    }),
    onSuccess: async (res) => {
      const flagKey = res.data.data.key
      setCreatedFlag(flagKey)
      // Activate it immediately so it's live
      await api.patch(`/v1/projects/${projectId}/flags/${res.data.data.id}/status`, { status: 'active' })
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      setStep('sdk-key')
    },
    onError: (err: any) => setError(err.response?.data?.error?.message ?? 'Failed to create flag'),
  })

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#f0f0f0' }}>
          Create your first flag
        </h2>
        <p style={{ fontSize: 14, color: '#606060', margin: 0, lineHeight: 1.6 }}>
          A feature flag is a boolean switch you control from this dashboard. Your code reads it in under a millisecond.
        </p>
      </div>

      {/* Flag name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#a0a0a0', marginBottom: 6 }}>
          Flag name
        </label>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setKey(derivedKey(e.target.value)); setError('') }}
          placeholder="New checkout flow"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#f0f0f0',
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 150ms ease',
            fontFamily: 'DM Sans, sans-serif',
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#1D9E75'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      </div>

      {/* Flag key */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#a0a0a0', marginBottom: 6 }}>
          Key <span style={{ color: '#404040', fontWeight: 400 }}>— used in code</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            value={key}
            onChange={e => { setKey(e.target.value); setError('') }}
            placeholder="new-checkout-flow"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#5DCAA5',
              fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 150ms ease',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#1D9E75'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>
        <p style={{ fontSize: 12, color: '#404040', margin: '6px 0 0' }}>
          Lowercase, hyphens and underscores only. This is permanent.
        </p>
      </div>

      {/* Code preview */}
      {key && (
        <div style={{
          borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
          background: '#0f0f0f', padding: '12px 14px', marginBottom: 24,
        }}>
          <p style={{ fontSize: 11, color: '#404040', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Preview
          </p>
          <code style={{ fontSize: 12.5, fontFamily: 'DM Mono, monospace', color: '#c9d1d9', lineHeight: 1.7 }}>
            <span style={{ color: '#a5d6ff' }}>if</span>
            {' (vault.isEnabled('}
            <span style={{ color: '#a5d6ff' }}>&apos;{key}&apos;</span>
            {', { userId })) {'}
            <br />
            &nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// your new feature</span>
            <br />
            {'}'}
          </code>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 13, color: '#ff5f56', margin: '0 0 16px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setStep('welcome')}
          style={{
            flex: '0 0 auto', padding: '11px 18px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            color: '#606060', fontSize: 14, cursor: 'pointer',
            transition: 'all 150ms ease', fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#a0a0a0'}
          onMouseLeave={e => e.currentTarget.style.color = '#606060'}>
          Back
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!key || !name || createMutation.isPending}
          style={{
            flex: 1, padding: '11px 20px', borderRadius: 8, border: 'none',
            background: (!key || !name) ? 'rgba(29,158,117,0.3)' : '#1D9E75',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: !key || !name ? 'not-allowed' : 'pointer',
            transition: 'all 200ms ease', fontFamily: 'DM Sans, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => { if (key && name && !createMutation.isPending) (e.currentTarget).style.background = '#0F6E56' }}
          onMouseLeave={e => { if (key && name && !createMutation.isPending) (e.currentTarget).style.background = '#1D9E75' }}>
          {createMutation.isPending ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 600ms linear infinite' }}>
                <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Creating...
            </>
          ) : 'Create flag'}
        </button>
      </div>
    </div>
  )
}
