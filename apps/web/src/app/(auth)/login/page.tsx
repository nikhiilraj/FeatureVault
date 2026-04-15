'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

function VerificationBanner() {
  const params   = useSearchParams()
  const verified = params.get('verified')
  const reason   = params.get('reason')

  const banner = verified === 'true'
    ? { ok: true,  msg: 'Email verified. You can now sign in.' }
    : verified === 'error' && reason === 'expired'
    ? { ok: false, msg: 'Verification link expired. Sign up again to get a new one.' }
    : verified === 'error'
    ? { ok: false, msg: 'Invalid verification link. It may have already been used.' }
    : null

  if (!banner) return null

  return (
    <div style={{
      marginBottom: 20, padding: '12px 14px', borderRadius: 8,
      fontSize: 13, lineHeight: 1.5,
      background: banner.ok ? 'rgba(29,158,117,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${banner.ok ? 'rgba(29,158,117,0.25)' : 'rgba(239,68,68,0.25)'}`,
      color: banner.ok ? '#1D9E75' : '#ef4444',
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      {banner.ok
        ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{marginTop:1,flexShrink:0}}><circle cx="7.5" cy="7.5" r="6.5" stroke="#1D9E75" strokeWidth="1.2"/><path d="M4.5 7.5l2 2 4-4" stroke="#1D9E75" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{marginTop:1,flexShrink:0}}><circle cx="7.5" cy="7.5" r="6.5" stroke="#ef4444" strokeWidth="1.2"/><path d="M7.5 4.5v4M7.5 10.5v.5" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round"/></svg>
      }
      {banner.msg}
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth } = useAuthStore()
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.post('/v1/auth/login', { email, password })
      setAuth(res.data.data.user, res.data.data.accessToken)
      router.push('/dashboard/flags')
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-black mb-6">Sign in</h2>

        <Suspense fallback={null}>
          <VerificationBanner />
        </Suspense>

        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>

        <p className="mt-4 text-center text-sm text-black">
          No account?{' '}
          <Link href="/signup" className="text-brand-600 hover:text-brand-800 font-medium">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  )
}
