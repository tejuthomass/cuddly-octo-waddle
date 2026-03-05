import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function ClientHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
          <CardDescription>Reports and history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block h-9 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/client/overview">
            Overview
          </Link>
          <Link className="block h-9 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/client/history">
            History
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
