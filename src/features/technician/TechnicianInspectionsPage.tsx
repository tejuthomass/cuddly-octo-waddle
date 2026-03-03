import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTechnicianInspections } from '@/hooks/useTechnicianInspections'

export default function TechnicianInspectionsPage() {
  const { data: inspections = [], isLoading } = useTechnicianInspections()

  return (
    <main className="space-y-6 p-4 pb-24 lg:p-6 lg:pb-6">
      <Card>
        <CardHeader>
          <CardTitle>My Inspections</CardTitle>
          <CardDescription>Draft and submitted inspections in your active client context.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading inspections...</p>
          ) : inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inspections recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Inspection ID</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Started</th>
                    <th className="p-2 text-left">Submitted</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => (
                    <tr className="border-b" key={inspection.id}>
                      <td className="p-2 font-mono text-xs">{inspection.id.slice(0, 8)}...</td>
                      <td className="p-2">{inspection.status}</td>
                      <td className="p-2 text-muted-foreground">{new Date(inspection.started_at).toLocaleString()}</td>
                      <td className="p-2 text-muted-foreground">
                        {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="p-2">
                        {inspection.status === 'draft' ? (
                          <Link className="text-sm font-medium text-primary hover:underline" to={`/technician/inspections/${inspection.id}`}>
                            Continue
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read only</span>
                        )}
                      </td>
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
