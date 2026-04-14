'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useWSStore } from '@/stores/ws.store'
import { Sidebar } from '@/components/layout/sidebar'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore()
  const { setStatus }   = useWSStore()
  const router          = useRouter()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (mounted && (!user || !token)) router.push('/login')
  }, [user, token, router, mounted])

  useEffect(() => {
    if (!token) return
    setStatus('connected')
    return () => setStatus('disconnected')
  }, [token, setStatus])

  if (!mounted || !user) return null

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <OnboardingModal />
    </div>
  )
}
