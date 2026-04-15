'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge, FlagStatusBadge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'
import Link from 'next/link'

function useProjectId() {
  const { user } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['projects', user?.workspaceId],
    queryFn:  () => api.get('/v1/workspaces/me/projects').then(r => r.data.data),
    enabled:  !!user,
  })
  return data?.[0]?.id as string | undefined
}

export default function FlagsPage() {
  const projectId = useProjectId()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch]         = useState('')
  const [form, setForm]             = useState({ key: '', name: '', type: 'boolean', defaultValue: 'false' })
  const [formError, setFormError]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['flags', projectId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/flags`).then(r => r.data),
    enabled:  !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post(`/v1/projects/${projectId}/flags`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      setShowCreate(false)
      setForm({ key: '', name: '', type: 'boolean', defaultValue: 'false' })
    },
    onError: (err: any) => setFormError(err.response?.data?.error?.message ?? 'Failed to create flag'),
  })

  const toggleStatus = useMutation({
    mutationFn: ({ flagId, status }: { flagId: string; status: string }) =>
      api.patch(`/v1/projects/${projectId}/flags/${flagId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags', projectId] }),
  })

  const flags = (data?.data ?? []).filter((f: any) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.key.includes(search.toLowerCase())
  )

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    let defaultValue: unknown = form.defaultValue
    try { defaultValue = JSON.parse(form.defaultValue) } catch {}
    createMutation.mutate({ key: form.key, name: form.name, type: form.type, defaultValue })
  }

  return (
    <>
      <Topbar title="Feature flags" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Input placeholder="Search flags..." value={search}
              onChange={e => setSearch(e.target.value)} className="w-64" />
            {data && (
              <span className="text-sm text-gray-500">
                {data.pagination?.total ?? 0} flag{data.pagination?.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Button onClick={() => setShowCreate(true)}>+ New flag</Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : flags.length === 0 ? (
          <EmptyState title="No flags yet"
            description="Create your first feature flag to get started"
            action={<Button onClick={() => setShowCreate(true)}>Create flag</Button>} />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {flags.map((flag: any) => (
                <div key={flag.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <Link href={`/dashboard/flags/${flag.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">
                        {flag.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">{flag.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="neutral">{flag.type}</Badge>
                    <FlagStatusBadge status={flag.status} />
                    <div className="flex gap-1.5">
                      {flag.status !== 'active' && (
                        <Button variant="secondary" size="sm"
                          onClick={() => toggleStatus.mutate({ flagId: flag.id, status: 'active' })}>
                          Enable
                        </Button>
                      )}
                      {flag.status === 'active' && (
                        <Button variant="secondary" size="sm"
                          onClick={() => toggleStatus.mutate({ flagId: flag.id, status: 'inactive' })}>
                          Disable
                        </Button>
                      )}
                      {flag.status !== 'killed' && (
                        <Button variant="danger" size="sm"
                          onClick={() => {
                            if (confirm(`Kill flag "${flag.key}"? This immediately turns it off for all users.`))
                              toggleStatus.mutate({ flagId: flag.id, status: 'killed' })
                          }}>
                          Kill
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create flag">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Flag name" value={form.name} required placeholder="Dark mode"
            onChange={e => setForm(f => ({...f, name: e.target.value,
              key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}))} />
          <Input label="Flag key" value={form.key} required placeholder="dark-mode"
            onChange={e => setForm(f => ({...f, key: e.target.value}))}
            helper="Lowercase letters, numbers, hyphens. Used in code." />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black bg-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="boolean">Boolean</option>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <Input label="Default value" value={form.defaultValue} required
            onChange={e => setForm(f => ({...f, defaultValue: e.target.value}))}
            helper={`For boolean: true or false. For string: "hello". For number: 42. For JSON: {"key":"value"}`} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create flag</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
