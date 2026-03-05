import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuditLogs } from '@/hooks/useAuditLogs'

export default function AuditLogsPage() {
  const { data: logs = [], isLoading } = useAuditLogs(300)

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
                  {logs.map((log) => (
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
        </CardContent>
      </Card>
    </main>
  )
}
