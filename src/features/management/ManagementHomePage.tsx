import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function ManagementHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Management Dashboard</CardTitle>
          <CardDescription>Cross-client read-only KPIs and abnormality trends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/management/overview">
            Open KPI Overview
          </Link>
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/management/abnormalities">
            View Recent Abnormalities
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
