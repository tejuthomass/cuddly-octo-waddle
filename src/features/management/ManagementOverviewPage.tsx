import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useManagementOverview } from '@/hooks/useManagementReports'

export default function ManagementOverviewPage() {
  const { data, isLoading } = useManagementOverview()

  const summary = data?.summary
  const byClient = data?.byClient ?? []

  return (
    <main className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clients</CardTitle>
            <CardDescription>Accessible client accounts</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : summary?.totalClients ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspections</CardTitle>
            <CardDescription>Total records across clients</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : summary?.totalInspections ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Tickets</CardTitle>
            <CardDescription>Open + acknowledged</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : summary?.openTickets ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalated Tickets</CardTitle>
            <CardDescription>Escalated exceptions</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : summary?.escalatedTickets ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Rollup</CardTitle>
          <CardDescription>Read-only KPI summary by client.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading overview...</p>
          ) : byClient.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Client</th>
                    <th className="p-2 text-left">Inspections</th>
                    <th className="p-2 text-left">Open</th>
                    <th className="p-2 text-left">Escalated</th>
                    <th className="p-2 text-left">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map((client) => (
                    <tr key={client.clientId} className="border-b">
                      <td className="p-2">{client.clientName}</td>
                      <td className="p-2">{client.inspections}</td>
                      <td className="p-2">{client.openTickets}</td>
                      <td className="p-2">{client.escalatedTickets}</td>
                      <td className="p-2">{client.resolvedTickets}</td>
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
