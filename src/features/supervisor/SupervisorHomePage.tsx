import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function SupervisorHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Supervisor</CardTitle>
          <CardDescription>Reviews and tickets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block h-9 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/supervisor/reviews">
            Reviews
          </Link>
          <Link className="block h-9 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/supervisor/tickets">
            Tickets
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
