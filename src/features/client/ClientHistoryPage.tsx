import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClientViewerInspectionHistory, useClientViewerTicketHistory } from '@/hooks/useClientViewerReports'

export default function ClientHistoryPage() {
  const { data: inspections = [], isLoading: inspectionsLoading } = useClientViewerInspectionHistory()
  const { data: tickets = [], isLoading: ticketsLoading } = useClientViewerTicketHistory()

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Inspection History</CardTitle>
          <CardDescription>Read-only inspection timeline for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {inspectionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading inspection history...</p>
          ) : inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inspections available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Inspection</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Started</th>
                    <th className="p-2 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => (
                    <tr key={inspection.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{inspection.id.slice(0, 8)}...</td>
                      <td className="p-2">{inspection.status}</td>
                      <td className="p-2 text-muted-foreground">{new Date(inspection.started_at).toLocaleString()}</td>
                      <td className="p-2 text-muted-foreground">
                        {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abnormality History</CardTitle>
          <CardDescription>Read-only abnormality ticket timeline for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <p className="text-sm text-muted-foreground">Loading abnormality history...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No abnormality tickets available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Field</th>
                    <th className="p-2 text-left">Severity</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Created</th>
                    <th className="p-2 text-left">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b">
                      <td className="p-2">{ticket.field_label}</td>
                      <td className="p-2">{ticket.severity}</td>
                      <td className="p-2">{ticket.status}</td>
                      <td className="p-2 text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</td>
                      <td className="p-2 text-muted-foreground">{ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : '—'}</td>
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
