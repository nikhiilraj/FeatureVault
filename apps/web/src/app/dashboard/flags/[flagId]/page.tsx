'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { FlagStatusBadge } from '@/components/ui/badge'
import { api } from '@/lib/api'

const OPERATORS = ['eq','neq','gt','gte','lt','lte','contains','not_contains','starts_with','ends_with','in','not_in','regex']

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
  const [saved, setSaved]         = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [defaultValue, setDefault] = useState('')
  const [changeReason, setReason] = useState('')
  const [rules, setRules]         = useState<any[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['flag', flagId],
    queryFn:  () => api.get(`/v1/projects/${projectId}/flags/${flagId}`).then(r => r.data.data),
    enabled:  !!projectId,
  })

  useEffect(() => {
    if (data) {
      setName(data.name)
      setDesc(data.description ?? '')
      setDefault(JSON.stringify(data.defaultValue))
      setRules(data.targetingRules ?? [])
    }
  }, [data])

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flag', flagId] })
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
    },
  })

  const rulesMutation = useMutation({
    mutationFn: (r: any[]) => api.put(`/v1/projects/${projectId}/flags/${flagId}/rules`, { rules: r }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flag', flagId] })
      setRulesSaved(true); setTimeout(() => setRulesSaved(false), 2000)
    },
  })

  const addRule = () => setRules(r => [...r, {
    id: crypto.randomUUID(),
    ruleOrder: r.length,
    conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
    rolloutPercentage: 100,
    serveValue: true,
  }])

  const removeRule = (idx: number) => setRules(r => r.filter((_, i) => i !== idx))

  const updateRule = (idx: number, field: string, value: any) =>
    setRules(r => r.map((rule, i) => i === idx ? { ...rule, [field]: value } : rule))

  const updateCondition = (ruleIdx: number, condIdx: number, field: string, value: string) =>
    setRules(r => r.map((rule, i) => i === ruleIdx ? {
      ...rule,
      conditions: rule.conditions.map((c: any, j: number) => j === condIdx ? { ...c, [field]: value } : c)
    } : rule))

  if (isLoading || !data) return <div className="p-6 text-sm text-gray-500">Loading...</div>

  return (
    <>
      <Topbar title={data.name} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          background: data.status === 'killed' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <code style={{ fontSize: 13, background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 8px', color: '#5DCAA5' }}>
              {data.key}
            </code>
            <FlagStatusBadge status={data.status} />
            <span style={{ fontSize: 12, color: '#606060' }}>v{data.version}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {data.status !== 'active' && data.status !== 'killed' && (
              <button
                onClick={() => statusMutation.mutate('active')}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(29,158,117,0.4)',
                  background: 'rgba(29,158,117,0.1)', color: '#1D9E75',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Enable
              </button>
            )}
            {data.status === 'active' && (
              <button
                onClick={() => statusMutation.mutate('inactive')}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: '#a0a0a0',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                Disable
              </button>
            )}
            {data.status === 'killed' && (
              <button
                onClick={() => statusMutation.mutate('inactive')}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(29,158,117,0.4)',
                  background: 'rgba(29,158,117,0.1)', color: '#1D9E75',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Restore flag
              </button>
            )}
            {data.status !== 'killed' && (
              <button
                onClick={() => {
                  if (confirm('Kill this flag? It immediately returns false for ALL users, overriding all rules.'))
                    statusMutation.mutate('killed')
                }}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                🚨 Kill switch
              </button>
            )}
          </div>
        </div>

        {data.status === 'killed' && (
          <div style={{
            padding: '12px 16px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', fontSize: 13,
          }}>
            This flag is killed — returning <strong>false</strong> for all users regardless of rules. Click "Restore flag" to re-enable.
          </div>
        )}

        {/* Settings */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Settings</h2></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Description" value={description} onChange={e => setDesc(e.target.value)} />
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#888', display: 'block', marginBottom: 6 }}>
                Default value
              </label>
              <input
                value={defaultValue}
                onChange={e => setDefault(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)', color: '#5DCAA5',
                  fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 11, color: '#505050', marginTop: 4 }}>
                Type: <strong style={{ color: '#707070' }}>{data.type}</strong> — use true/false for boolean, "string" for string, 42 for number
              </p>
            </div>
            <Input label="Change reason (optional)" value={changeReason}
              onChange={e => setReason(e.target.value)} placeholder="What changed and why?" />
            <div className="flex items-center justify-between pt-1">
              <Button variant="secondary" size="sm" onClick={() => router.back()}>Back</Button>
              <Button size="sm" loading={updateMutation.isPending}
                onClick={() => {
                  let parsedDefault: unknown = defaultValue
                  try { parsedDefault = JSON.parse(defaultValue) } catch {}
                  updateMutation.mutate({ name, description, defaultValue: parsedDefault, changeReason })
                }}>
                {saved ? '✓ Saved' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Targeting rules */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="text-sm font-semibold">Targeting rules</h2>
                <p style={{ fontSize: 12, color: '#606060', marginTop: 2 }}>
                  Rules are evaluated top-down. First match wins. Users not matching any rule get the default value.
                </p>
              </div>
              <button onClick={addRule} style={{
                padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(29,158,117,0.3)',
                background: 'rgba(29,158,117,0.08)', color: '#1D9E75',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                + Add rule
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#505050', fontSize: 13 }}>
                No targeting rules — all users get the default value.
                <br />
                <span style={{ fontSize: 12, color: '#404040' }}>Add a rule to serve different values to specific users.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rules.map((rule, rIdx) => (
                  <div key={rule.id ?? rIdx} style={{
                    padding: '16px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1D9E75', fontFamily: 'monospace' }}>
                        Rule {rIdx + 1}
                      </span>
                      <button onClick={() => removeRule(rIdx)} style={{
                        fontSize: 11, color: '#606060', background: 'none', border: 'none', cursor: 'pointer',
                      }}>Remove</button>
                    </div>

                    {/* Conditions */}
                    {rule.conditions.map((cond: any, cIdx: number) => (
                      <div key={cIdx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          value={cond.attribute}
                          onChange={e => updateCondition(rIdx, cIdx, 'attribute', e.target.value)}
                          placeholder="attribute"
                          style={inputStyle}
                        />
                        <select
                          value={cond.operator}
                          onChange={e => updateCondition(rIdx, cIdx, 'operator', e.target.value)}
                          style={{ ...inputStyle, width: 130 }}>
                          {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                        <input
                          value={cond.value}
                          onChange={e => updateCondition(rIdx, cIdx, 'value', e.target.value)}
                          placeholder="value"
                          style={inputStyle}
                        />
                      </div>
                    ))}

                    {/* Serve + Rollout */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#606060', display: 'block', marginBottom: 4 }}>Serve value</label>
                        <input
                          value={JSON.stringify(rule.serveValue)}
                          onChange={e => {
                            let v: unknown = e.target.value
                            try { v = JSON.parse(e.target.value) } catch {}
                            updateRule(rIdx, 'serveValue', v)
                          }}
                          style={{ ...inputStyle, width: 100 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#606060', display: 'block', marginBottom: 4 }}>
                          Rollout % <span style={{ color: '#404040' }}>(0–100)</span>
                        </label>
                        <input
                          type="number" min={0} max={100}
                          value={rule.rolloutPercentage}
                          onChange={e => updateRule(rIdx, 'rolloutPercentage', Number(e.target.value))}
                          style={{ ...inputStyle, width: 80 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rules.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => rulesMutation.mutate(rules)}
                  disabled={rulesMutation.isPending}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#1D9E75', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {rulesSaved ? '✓ Rules saved' : rulesMutation.isPending ? 'Saving...' : 'Save rules'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version history */}
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Version history</h2></CardHeader>
          <FlagVersions flagId={flagId} projectId={projectId!} />
        </Card>
      </main>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#f0f0f0',
  fontSize: 12, outline: 'none', minWidth: 80,
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
