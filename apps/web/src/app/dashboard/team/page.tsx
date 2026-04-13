'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

const roleVariants: Record<string, 'success'|'warning'|'info'|'neutral'> = {
  owner: 'success', admin: 'warning', editor: 'info', viewer: 'neutral',
}

export default function TeamPage() {
  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn:  () => api.get('/v1/workspaces/me').then(r => r.data.data),
  })
  const { data: members } = useQuery({
    queryKey: ['members'],
    queryFn:  () => api.get('/v1/workspaces/me/members').then(r => r.data.data),
  })

  return (
    <>
      <Topbar title="Team" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {workspace && (
          <Card>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Workspace</p>
              <p className="text-sm font-semibold text-gray-900">{workspace.name}</p>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{workspace.slug}</p>
            </div>
          </Card>
        )}
        <Card>
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Members ({members?.length ?? 0})
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(members ?? []).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.userId}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={roleVariants[m.role] ?? 'neutral'}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </>
  )
}
