import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { useAuditLogs } from '@/hooks/useAuditLogs'

export default function AuditLogsPage() {
  const { data: logs = [], isLoading } = useAuditLogs(300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const pagedLogs = useMemo(() => {
    const start = (page - 1) * pageSize
    return logs.slice(start, start + pageSize)
  }, [logs, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Recent activity.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">Actor</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">Entity</th>
                    <th className="p-3 text-left">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="p-3 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-3">{log.profiles?.[0] ? `${log.profiles[0].full_name} (${log.profiles[0].employee_id})` : 'System/Unknown'}</td>
                      <td className="p-3">{log.action_type}</td>
                      <td className="p-3">{log.entity_type}</td>
                      <td className="p-3 text-xs">{log.entity_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Showing {pagedLogs.length} of {logs.length}</p>
            <div className="flex items-center gap-2">
              <PageSizeSelect value={pageSize} onChange={setPageSize} options={[25, 50, 100]} />
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
