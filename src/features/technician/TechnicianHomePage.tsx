import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function TechnicianHomePage() {
  return (
    <main className="space-y-6 p-4 pb-24 lg:p-6 lg:pb-6">
      <Card>
        <CardHeader>
          <CardTitle>Technician Dashboard</CardTitle>
          <CardDescription>Use assignments to start inspections and submit checklist results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/technician/assignments">
            Open Assigned Checklists
          </Link>
          <Link className="block rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" to="/technician/inspections">
            View My Inspections
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
