'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useWSStore } from '@/stores/ws.store'
import { Sidebar } from '@/components/layout/sidebar'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore()
  const { setStatus }   = useWSStore()
  const router          = useRouter()

  // Auth guard
  useEffect(() => {
    if (!user || !token) router.push('/login')
  }, [user, token, router])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!token) return
    // WS connection would be set up here with SDK keys in production
    // For dashboard, we just show connected status after login
    setStatus('connected')
    return () => setStatus('disconnected')
  }, [token, setStatus])

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
