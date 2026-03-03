import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateDraftInspection, useTechnicianAssignments } from '@/hooks/useTechnicianInspections'
import { toHumanErrorMessage } from '@/lib/errors'

export default function TechnicianAssignmentsPage() {
  const navigate = useNavigate()
  const { data: assignments = [], isLoading } = useTechnicianAssignments()
  const createDraftMutation = useCreateDraftInspection()

  const onStartInspection = async (templateId: string, shiftId: string | null) => {
    try {
      const inspectionId = await createDraftMutation.mutateAsync({
        templateId,
        shiftId,
      })

      toast.success('Draft inspection started.')
      navigate(`/technician/inspections/${inspectionId}`)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to start inspection.'))
    }
  }

  return (
    <main className="space-y-6 p-4 pb-24 lg:p-6 lg:pb-6">
      <Card>
        <CardHeader>
          <CardTitle>Assigned Checklists</CardTitle>
          <CardDescription>Start an inspection from your active template assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading assignments...</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active checklist assignments available.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-border p-4">
                  <div className="mb-2">
                    <p className="text-sm font-semibold">{assignment.name}</p>
                    <p className="text-xs text-muted-foreground">{assignment.description || 'No description'}</p>
                  </div>
                  <div className="mb-3 text-xs text-muted-foreground">Frequency: {assignment.frequency}</div>
                  <Button
                    size="sm"
                    onClick={() => void onStartInspection(assignment.id, assignment.shift_id)}
                    disabled={createDraftMutation.isPending}
                  >
                    {createDraftMutation.isPending ? 'Starting...' : 'Start Inspection'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
