'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Topbar } from '@/components/layout/topbar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'

const actionColors: Record<string, string> = {
  'flag.created':         'bg-blue-50 text-blue-700',
  'flag.updated':         'bg-gray-100 text-gray-700',
  'flag.active':          'bg-brand-50 text-brand-700',
  'flag.inactive':        'bg-gray-100 text-gray-600',
  'flag.killed':          'bg-red-50 text-red-700',
  'flag.deleted':         'bg-red-50 text-red-700',
  'experiment.created':   'bg-blue-50 text-blue-700',
  'experiment.launched':  'bg-brand-50 text-brand-700',
  'experiment.stopped':   'bg-gray-100 text-gray-700',
}

export default function AuditLogPage() {
  const [cursor, setCursor] = useState<string | undefined>()
  const [allLogs, setAllLogs] = useState<any[]>([])

  const { data, isFetching } = useQuery({
    queryKey: ['audit-logs', cursor],
    queryFn: async () => {
      const params = cursor ? `?cursor=${cursor}&limit=25` : '?limit=25'
      const res = await api.get(`/v1/workspaces/me/audit-logs${params}`)
      const { logs, nextCursor, hasMore } = res.data.data
      setAllLogs(prev => cursor ? [...prev, ...logs] : logs)
      return { nextCursor, hasMore }
    },
  })

  return (
    <>
      <Topbar title="Audit log" />
      <main className="flex-1 overflow-y-auto p-6">
        {allLogs.length === 0 && !isFetching ? (
          <EmptyState title="No audit entries yet"
            description="System changes will appear here" />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {allLogs.map((log: any) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </div>
            {data?.hasMore && (
              <div className="flex justify-center border-t p-4">
                <button
                  onClick={() => setCursor(data.nextCursor)}
                  disabled={isFetching}
                  className="text-sm text-brand-600 hover:text-brand-800 disabled:opacity-50">
                  {isFetching ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </Card>
        )}
      </main>
    </>
  )
}

function AuditRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = actionColors[log.action] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="px-5 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(e => !e)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium ${colorClass}`}>
            {log.action}
          </span>
          <span className="text-xs text-gray-500">{log.actorEmail ?? 'system'}</span>
        </div>
        <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
      </div>
      {expanded && (log.before || log.after) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {log.before && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Before</p>
              <pre className="overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700 max-h-32">
                {JSON.stringify(log.before, null, 2)}
              </pre>
            </div>
          )}
          {log.after && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">After</p>
              <pre className="overflow-auto rounded bg-green-50 p-2 text-xs text-green-800 max-h-32">
                {JSON.stringify(log.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
