import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClientViewerOverview } from '@/hooks/useClientViewerReports'

export default function ClientOverviewPage() {
  const { data, isLoading } = useClientViewerOverview()

  return (
    <main className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspections</CardTitle>
            <CardDescription>Total inspection records</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : data?.totalInspections ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approved</CardTitle>
            <CardDescription>Approved inspections</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : data?.approvedInspections ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Tickets</CardTitle>
            <CardDescription>Open + acknowledged</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : data?.openTickets ?? 0}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalated</CardTitle>
            <CardDescription>Escalated abnormalities</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{isLoading ? '...' : data?.escalatedTickets ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Snapshot</CardTitle>
          <CardDescription>Current client-only inspection and abnormality status counts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading snapshot...</p>
          ) : (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>Submitted inspections: {data?.submittedInspections ?? 0}</p>
              <p>Rejected inspections: {data?.rejectedInspections ?? 0}</p>
              <p>Resolved tickets: {data?.resolvedTickets ?? 0}</p>
              <p>Escalated tickets: {data?.escalatedTickets ?? 0}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
