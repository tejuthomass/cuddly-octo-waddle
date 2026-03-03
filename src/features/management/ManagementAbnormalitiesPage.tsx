import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useManagementRecentTickets } from '@/hooks/useManagementReports'

export default function ManagementAbnormalitiesPage() {
  const { data: tickets = [], isLoading } = useManagementRecentTickets()

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Abnormalities</CardTitle>
          <CardDescription>Read-only cross-client abnormality ticket history.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading abnormalities...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Client</th>
                    <th className="p-2 text-left">Field</th>
                    <th className="p-2 text-left">Severity</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b">
                      <td className="p-2">{ticket.clients?.[0]?.name ?? 'Unknown client'}</td>
                      <td className="p-2">{ticket.field_label}</td>
                      <td className="p-2">{ticket.severity}</td>
                      <td className="p-2">{ticket.status}</td>
                      <td className="p-2 text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</td>
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
