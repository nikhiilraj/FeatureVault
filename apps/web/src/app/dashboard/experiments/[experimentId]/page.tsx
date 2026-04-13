'use client'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { FlagStatusBadge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function useProjectId() {
  const { user } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['projects', user?.workspaceId],
    queryFn:  () => api.get('/v1/workspaces/me/projects').then(r => r.data.data),
    enabled:  !!user,
  })
  return data?.[0]?.id as string | undefined
}

export default function ExperimentResultsPage() {
  const { experimentId } = useParams<{ experimentId: string }>()
  const projectId        = useProjectId()
  const qc               = useQueryClient()

  const { data: exp } = useQuery({
    queryKey: ['experiment', experimentId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/experiments/${experimentId}`).then(r => r.data.data),
    enabled:  !!projectId,
  })

  const { data: results } = useQuery({
    queryKey: ['experiment-results', experimentId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/experiments/${experimentId}/results`).then(r => r.data.data),
    enabled:  !!projectId,
    refetchInterval: exp?.status === 'running' ? 30_000 : false,
  })

  const stopMutation = useMutation({
    mutationFn: (winnerVariantId?: string) =>
      api.post(`/v1/projects/${projectId}/experiments/${experimentId}/stop`, { winnerVariantId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  const launchMutation = useMutation({
    mutationFn: () => api.post(`/v1/projects/${projectId}/experiments/${experimentId}/launch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  if (!exp) return <div className="p-6 text-sm text-gray-500">Loading...</div>

  const variants        = exp.variants ?? []
  const resultsByVariant: Record<string, any> = {}
  ;(results?.results ?? []).forEach((r: any) => { resultsByVariant[r.variantId] = r })

  const chartData = variants.map((v: any, i: number) => {
    const r = resultsByVariant[v.id]
    return {
      name:           v.name,
      impressions:    r?.impressions ?? 0,
      conversions:    r?.conversions ?? 0,
      rate:           r ? (Number(r.conversionRate) * 100).toFixed(2) : '0',
      isSignificant:  r?.isSignificant ?? false,
      pValue:         r ? Number(r.pValue).toFixed(4) : 'N/A',
      uplift:         r?.uplift ? (Number(r.uplift) * 100).toFixed(1) : null,
      color:          i === 0 ? '#B4B2A9' : '#1D9E75',
    }
  })

  const significantVariant = chartData.find((d: any) => d.isSignificant)

  return (
    <>
      <Topbar title={exp.name} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <code className="text-sm bg-gray-100 rounded px-2 py-0.5 text-gray-700">{exp.key}</code>
            <FlagStatusBadge status={exp.status} />
          </div>
          <div className="flex gap-2">
            {exp.status === 'draft' && (
              <Button onClick={() => launchMutation.mutate()} loading={launchMutation.isPending}>Launch</Button>
            )}
            {(exp.status === 'running' || exp.status === 'paused') && (
              <Button variant="danger" size="sm"
                onClick={() => { if (confirm('Stop this experiment?')) stopMutation.mutate(undefined) }}>
                Stop experiment
              </Button>
            )}
          </div>
        </div>

        {exp.hypothesis && (
          <Card>
            <CardContent>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hypothesis</p>
              <p className="text-sm text-gray-700">{exp.hypothesis}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Primary metric', value: exp.primaryMetric },
            { label: 'Confidence level', value: `${(Number(exp.confidenceLevel) * 100).toFixed(0)}%` },
            { label: 'Traffic allocation', value: `${exp.trafficAllocation}%` },
            { label: 'Status', value: exp.status },
          ].map(item => (
            <div key={item.label} className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Significance banner */}
        {significantVariant && (
          <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400 text-white text-sm font-bold">✓</div>
            <div>
              <p className="text-sm font-semibold text-brand-800">
                Statistically significant — {significantVariant.name} wins
              </p>
              <p className="text-xs text-brand-600">
                p-value: {significantVariant.pValue} · {significantVariant.uplift}% uplift · 95% confidence
              </p>
            </div>
          </div>
        )}

        {/* Variant cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {chartData.map((v: any) => (
            <Card key={v.name} className={v.isSignificant ? 'ring-2 ring-brand-400' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{v.name}</h3>
                  {v.isSignificant && (
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 ring-1 ring-brand-200">
                      winner
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Conversion rate</p>
                    <p className="text-3xl font-semibold text-gray-900">{v.rate}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div><span className="font-medium text-gray-700">{v.impressions.toLocaleString()}</span> impressions</div>
                    <div><span className="font-medium text-gray-700">{v.conversions.toLocaleString()}</span> conversions</div>
                  </div>
                  {v.uplift && <p className="text-xs text-brand-600 font-medium">+{v.uplift}% uplift vs control</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        {chartData.some((d: any) => d.impressions > 0) && (
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Impressions vs conversions</h2></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="impressions" name="Impressions" radius={[4,4,0,0]}>
                    {chartData.map((d: any, i: number) => <Cell key={i} fill={d.color} fillOpacity={0.3} />)}
                  </Bar>
                  <Bar dataKey="conversions" name="Conversions" radius={[4,4,0,0]}>
                    {chartData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  )
}
