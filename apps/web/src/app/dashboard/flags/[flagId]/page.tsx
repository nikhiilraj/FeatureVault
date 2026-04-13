'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { FlagStatusBadge } from '@/components/ui/badge'
import { api } from '@/lib/api'

function useProjectId() {
  const { user } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['projects', user?.workspaceId],
    queryFn:  () => api.get('/v1/workspaces/me/projects').then(r => r.data.data),
    enabled:  !!user,
  })
  return data?.[0]?.id as string | undefined
}

export default function FlagDetailPage() {
  const { flagId } = useParams<{ flagId: string }>()
  const projectId  = useProjectId()
  const qc         = useQueryClient()
  const router     = useRouter()
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['flag', flagId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/flags/${flagId}`).then(r => r.data.data),
    enabled:  !!projectId,
  })

  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [changeReason, setReason] = useState('')

  const updateMutation = useMutation({
    mutationFn: (body: object) => api.patch(`/v1/projects/${projectId}/flags/${flagId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flag', flagId] })
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/v1/projects/${projectId}/flags/${flagId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flag', flagId] }),
  })

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!data) return null

  const currentName = name || data.name
  const currentDesc = description !== '' ? description : (data.description ?? '')

  return (
    <>
      <Topbar title={data.name} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <code className="text-sm bg-gray-100 rounded px-2 py-0.5 text-gray-700">{data.key}</code>
            <FlagStatusBadge status={data.status} />
            <span className="text-xs text-gray-400">v{data.version}</span>
          </div>
          <div className="flex gap-2">
            {data.status !== 'active' && (
              <Button variant="primary" size="sm" onClick={() => statusMutation.mutate('active')}>Enable</Button>
            )}
            {data.status === 'active' && (
              <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('inactive')}>Disable</Button>
            )}
            {data.status !== 'killed' && (
              <Button variant="danger" size="sm" onClick={() => {
                if (confirm('Kill this flag? It will immediately return false for all users.'))
                  statusMutation.mutate('killed')
              }}>
                Kill switch
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Settings</h2></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Name" value={currentName}
              onChange={e => setName(e.target.value)} />
            <Input label="Description" value={currentDesc}
              onChange={e => setDesc(e.target.value)} />
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Default value</p>
              <code className="text-sm text-gray-700">{JSON.stringify(data.defaultValue)}</code>
            </div>
            <Input label="Change reason (optional)" value={changeReason}
              onChange={e => setReason(e.target.value)}
              placeholder="What changed and why?" />
            <div className="flex items-center justify-between pt-1">
              <Button variant="secondary" size="sm" onClick={() => router.back()}>Back</Button>
              <Button size="sm" loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ name: currentName, description: currentDesc, changeReason })}>
                {saved ? '✓ Saved' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Version history</h2>
            </div>
          </CardHeader>
          <FlagVersions flagId={flagId} projectId={projectId!} />
        </Card>
      </main>
    </>
  )
}

function FlagVersions({ flagId, projectId }: { flagId: string; projectId: string }) {
  const { data } = useQuery({
    queryKey: ['flag-versions', flagId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/flags/${flagId}/versions`).then(r => r.data.data),
    enabled:  !!projectId,
  })
  if (!data?.length) return <CardContent><p className="text-sm text-gray-400">No version history yet.</p></CardContent>
  return (
    <div className="divide-y divide-gray-100">
      {data.slice(0, 10).map((v: any) => (
        <div key={v.id} className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500">v{v.version}</span>
            <span className="text-sm text-gray-700">{v.changeReason ?? 'No reason provided'}</span>
          </div>
          <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
