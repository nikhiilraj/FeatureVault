'use client'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

export function Topbar({ title }: { title: string }) {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()

  const logout = async () => {
    await api.post('/v1/auth/logout').catch(() => {})
    clearAuth()
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{user?.email}</span>
        <span className="inline-flex h-5 items-center rounded-full bg-brand-50 px-2 text-xs font-medium text-brand-600">
          {user?.role}
        </span>
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </div>
    </header>
  )
}
