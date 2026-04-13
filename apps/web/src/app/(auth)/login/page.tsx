'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

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
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in</h2>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="text-brand-600 hover:text-brand-800 font-medium">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  )
}
