'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { FlagStatusBadge } from '@/components/ui/badge'
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

const defaultVariants = [
  { key: 'control', name: 'Control', weight: 50, value: {} },
  { key: 'treatment', name: 'Treatment', weight: 50, value: {} },
]

export default function ExperimentsPage() {
  const projectId = useProjectId()
  const qc        = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState({
    key: '', name: '', hypothesis: '',
    primaryMetric: '', confidenceLevel: 0.95, variants: defaultVariants,
  })
  const [formError, setFormError]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['experiments', projectId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/experiments`).then(r => r.data),
    enabled:  !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post(`/v1/projects/${projectId}/experiments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiments', projectId] })
      setShowCreate(false)
      setForm({ key: '', name: '', hypothesis: '', primaryMetric: '', confidenceLevel: 0.95, variants: defaultVariants })
    },
    onError: (err: any) => setFormError(err.response?.data?.error?.message ?? 'Failed to create experiment'),
  })

  const launchMutation = useMutation({
    mutationFn: (expId: string) => api.post(`/v1/projects/${projectId}/experiments/${expId}/launch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments', projectId] }),
  })

  const totalWeight = form.variants.reduce((s, v) => s + (Number(v.weight) || 0), 0)
  const experiments = data?.data ?? []

  return (
    <>
      <Topbar title="Experiments" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {data?.pagination?.total ?? 0} experiment{data?.pagination?.total !== 1 ? 's' : ''}
          </span>
          <Button onClick={() => setShowCreate(true)}>+ New experiment</Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : experiments.length === 0 ? (
          <EmptyState title="No experiments yet"
            description="Run A/B tests to improve your product with data"
            action={<Button onClick={() => setShowCreate(true)}>Create experiment</Button>} />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {experiments.map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                  <div>
                    <Link href={`/dashboard/experiments/${exp.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600">
                      {exp.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">{exp.key}</p>
                    <p className="mt-0.5 text-xs text-gray-500">metric: {exp.primaryMetric}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <FlagStatusBadge status={exp.status} />
                    {exp.status === 'draft' && (
                      <Button variant="primary" size="sm"
                        onClick={() => launchMutation.mutate(exp.id)}>
                        Launch
                      </Button>
                    )}
                    <Link href={`/dashboard/experiments/${exp.id}`}>
                      <Button variant="secondary" size="sm">View results</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New experiment" size="lg">
        <div className="space-y-4">
          <Input label="Experiment name" value={form.name} required
            onChange={e => setForm(f => ({...f, name: e.target.value,
              key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'')}))} />
          <Input label="Key" value={form.key} required
            onChange={e => setForm(f => ({...f, key: e.target.value}))} />
          <Input label="Primary metric" value={form.primaryMetric} required
            placeholder="purchase_completed"
            onChange={e => setForm(f => ({...f, primaryMetric: e.target.value}))}
            helper="The event name vault.track() sends on conversion" />
          <Input label="Hypothesis (optional)" value={form.hypothesis}
            onChange={e => setForm(f => ({...f, hypothesis: e.target.value}))} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Variants
                <span className={`ml-2 text-xs font-normal ${totalWeight === 100 ? 'text-brand-600' : 'text-red-500'}`}>
                  (weights sum: {totalWeight}/100)
                </span>
              </label>
            </div>
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Key" value={v.key} className="flex-1"
                    onChange={e => setForm(f => ({...f, variants: f.variants.map((vv,ii) => ii===i ? {...vv,key:e.target.value} : vv)}))} />
                  <Input placeholder="Name" value={v.name} className="flex-1"
                    onChange={e => setForm(f => ({...f, variants: f.variants.map((vv,ii) => ii===i ? {...vv,name:e.target.value} : vv)}))} />
                  <Input placeholder="%" type="number" value={v.weight} className="w-16"
                    onChange={e => setForm(f => ({...f, variants: f.variants.map((vv,ii) => ii===i ? {...vv,weight:Number(e.target.value)} : vv)}))} />
                  {form.variants.length > 2 && (
                    <button onClick={() => setForm(f => ({...f, variants: f.variants.filter((_,ii) => ii!==i)}))}
                      className="text-gray-400 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
              {form.variants.length < 5 && (
                <button onClick={() => setForm(f => ({...f, variants: [...f.variants, {key:'',name:'',weight:0,value:{}}]}))}
                  className="text-sm text-brand-600 hover:text-brand-800">+ Add variant</button>
              )}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button loading={createMutation.isPending}
              disabled={totalWeight !== 100}
              onClick={() => createMutation.mutate(form)}>
              Create experiment
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
