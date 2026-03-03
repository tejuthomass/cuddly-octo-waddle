import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function SupervisorHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Supervisor Dashboard</CardTitle>
          <CardDescription>Review submitted inspections and manage abnormality tickets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/supervisor/reviews">
            Open Review Queue
          </Link>
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/supervisor/tickets">
            Open Abnormality Tickets
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
