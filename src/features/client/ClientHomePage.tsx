import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function ClientHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Client Viewer Dashboard</CardTitle>
          <CardDescription>Read-only client reports and abnormality history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/client/overview">
            Open Client Overview
          </Link>
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/client/history">
            Open Inspection & Ticket History
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
