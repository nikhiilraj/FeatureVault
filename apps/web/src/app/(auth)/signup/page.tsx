'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export default function SignupPage() {
  const [form, setForm]   = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [done, setDone]   = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await api.post('/v1/auth/signup', form)
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Signup failed')
    } finally { setLoading(false) }
  }

  if (done) return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="mb-3 text-4xl">✉️</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-gray-500">
          We sent a verification link to <strong>{form.email}</strong>.
          Click it to activate your account, then{' '}
          <Link href="/login" className="text-brand-600 font-medium">sign in</Link>.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Create account</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={form.firstName}
              onChange={e => setForm(f => ({...f, firstName: e.target.value}))} />
            <Input label="Last name" value={form.lastName}
              onChange={e => setForm(f => ({...f, lastName: e.target.value}))} />
          </div>
          <Input label="Email" type="email" value={form.email} required
            onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          <Input label="Password" type="password" value={form.password} required
            onChange={e => setForm(f => ({...f, password: e.target.value}))}
            helper="Min 12 chars, 1 uppercase, 1 number, 1 special character" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Create account</Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 hover:text-brand-800 font-medium">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
