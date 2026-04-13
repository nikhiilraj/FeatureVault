'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
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

export default function SDKKeysPage() {
  const projectId = useProjectId()
  const qc        = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey]         = useState<string | null>(null)
  const [form, setForm]             = useState({ name: '', keyType: 'server', environment: 'development' })

  const { data, isLoading } = useQuery({
    queryKey: ['sdk-keys', projectId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/sdk-keys`).then(r => r.data.data),
    enabled:  !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post(`/v1/projects/${projectId}/sdk-keys`, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sdk-keys', projectId] })
      setNewKey(res.data.data.key)
      setShowCreate(false)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/v1/projects/${projectId}/sdk-keys/${keyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sdk-keys', projectId] }),
  })

  const keys = data ?? []

  return (
    <>
      <Topbar title="SDK Keys" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex justify-end">
          <Button onClick={() => setShowCreate(true)}>+ Create SDK key</Button>
        </div>

        {newKey && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Save this key — it won&apos;t be shown again</p>
            <code className="block rounded bg-white border border-amber-200 p-2 text-sm font-mono text-gray-900 break-all">
              {newKey}
            </code>
            <Button variant="secondary" size="sm" className="mt-2"
              onClick={() => { navigator.clipboard.writeText(newKey); }}>
              Copy key
            </Button>
          </div>
        )}

        {isLoading ? <div className="h-32 rounded-lg bg-gray-100 animate-pulse" /> :
         keys.length === 0 ? (
          <EmptyState title="No SDK keys" description="Create an API key to connect your application"
            action={<Button onClick={() => setShowCreate(true)}>Create SDK key</Button>} />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {keys.map((key: any) => (
                <div key={key.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{key.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">
                      {key.keyPrefix}...{key.keyPreview}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="neutral">{key.keyType}</Badge>
                    <Badge variant={key.environment === 'production' ? 'danger' : 'info'}>{key.environment}</Badge>
                    {key.revokedAt ? (
                      <Badge variant="danger">Revoked</Badge>
                    ) : (
                      <Button variant="secondary" size="sm"
                        onClick={() => { if (confirm('Revoke this key? This cannot be undone.')) revokeMutation.mutate(key.id) }}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create SDK key">
        <div className="space-y-4">
          <Input label="Key name" value={form.name} required placeholder="Production server"
            onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select value={form.keyType} onChange={e => setForm(f => ({...f, keyType: e.target.value}))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="server">Server-side</option>
              <option value="client">Client-side</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Environment</label>
            <select value={form.environment} onChange={e => setForm(f => ({...f, environment: e.target.value}))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}>Create key</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
