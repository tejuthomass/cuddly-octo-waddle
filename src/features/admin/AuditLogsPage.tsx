import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import { formatAuditLogAction } from '@/utils/auditLogUtils'
import { Clock, User, Activity, ArrowLeft, ArrowRight } from 'lucide-react'

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
    <main className="space-y-6 p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">System Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Detailed history of all administrative actions and system events.</p>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center justify-between font-medium text-sm">
            <span>Event History</span>
            <span className="text-muted-foreground font-normal">{logs.length} total entries</span>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 w-full animate-pulse bg-muted/20 rounded-md" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
               No audit logs available for display.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/40 bg-card/50">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/40 text-muted-foreground">
                    <th className="p-4 text-left font-semibold uppercase tracking-wider text-[10px]">Timestamp</th>
                    <th className="p-4 text-left font-semibold uppercase tracking-wider text-[10px]">Actor</th>
                    <th className="p-4 text-left font-semibold uppercase tracking-wider text-[10px]">Event Description</th>
                    <th className="p-4 text-left font-semibold uppercase tracking-wider text-[10px]">Entity</th>
                    <th className="p-4 text-left font-semibold uppercase tracking-wider text-[10px]">Target ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pagedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col">
                           <span className="font-medium">{new Date(log.created_at).toLocaleDateString()}</span>
                           <span className="text-[10px] text-muted-foreground uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <div className="flex flex-col">
                             <span className="font-semibold">{log.profiles?.[0]?.full_name || 'System'}</span>
                             {log.profiles?.[0]?.employee_id && <span className="text-[10px] text-muted-foreground">{log.profiles[0].employee_id}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-primary/5 text-primary text-xs font-bold border border-primary/10">
                          {formatAuditLogAction(log)}
                        </span>
                      </td>
                      <td className="p-4">
                         <div className="flex items-center gap-2 text-muted-foreground font-medium italic">
                            <Activity className="w-3.5 h-3.5" />
                            {log.entity_type}
                         </div>
                      </td>
                      <td className="p-4">
                        <code className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground/80 font-mono tracking-tighter">
                          {log.entity_id || 'N/A'}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold text-foreground">{pagedLogs.length}</span> of <span className="font-bold text-foreground">{logs.length}</span> entries
              </p>
              <PageSizeSelect value={pageSize} onChange={setPageSize} options={[25, 50, 100]} />
            </div>
            
            <div className="flex items-center gap-1.5 font-bold">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="h-8 w-8 p-0" 
                onClick={() => setPage((prev) => Math.max(1, prev - 1))} 
                disabled={page <= 1}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="px-3 h-8 flex items-center bg-muted/50 rounded-md text-xs">
                {page} <span className="text-muted-foreground mx-1">/</span> {totalPages}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="h-8 w-8 p-0" 
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} 
                disabled={page >= totalPages}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
