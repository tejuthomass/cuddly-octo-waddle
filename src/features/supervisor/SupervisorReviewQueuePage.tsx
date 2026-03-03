import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApproveInspection, useRejectInspection, useSupervisorReviewQueue } from '@/hooks/useSupervisorOperations'
import { toHumanErrorMessage } from '@/lib/errors'

export default function SupervisorReviewQueuePage() {
  const { data: inspections = [], isLoading } = useSupervisorReviewQueue()
  const approveMutation = useApproveInspection()
  const rejectMutation = useRejectInspection()
  const [remarksByInspectionId, setRemarksByInspectionId] = useState<Record<string, string>>({})

  const setRemarks = (inspectionId: string, value: string) => {
    setRemarksByInspectionId((previous) => ({
      ...previous,
      [inspectionId]: value,
    }))
  }

  const onApprove = async (inspectionId: string) => {
    try {
      await approveMutation.mutateAsync({
        inspectionId,
        remarks: remarksByInspectionId[inspectionId],
      })
      toast.success('Inspection approved.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to approve inspection.'))
    }
  }

  const onReject = async (inspectionId: string) => {
    try {
      const remarks = (remarksByInspectionId[inspectionId] ?? '').trim()
      if (!remarks) {
        throw new Error('Remarks are required when rejecting an inspection.')
      }

      await rejectMutation.mutateAsync({
        inspectionId,
        remarks,
      })
      toast.success('Inspection rejected.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to reject inspection.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Inspection Review Queue</CardTitle>
          <CardDescription>Approve or reject submitted inspections with supervisor remarks.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading review queue...</p>
          ) : inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submitted inspections in queue.</p>
          ) : (
            <div className="space-y-4">
              {inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                    <p>
                      <span className="font-medium">Inspection:</span> {inspection.id.slice(0, 8)}...
                    </p>
                    <p>
                      <span className="font-medium">Status:</span> {inspection.status}
                    </p>
                    <p>
                      <span className="font-medium">Started:</span> {new Date(inspection.started_at).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Submitted:</span>{' '}
                      {inspection.submitted_at ? new Date(inspection.submitted_at).toLocaleString() : '—'}
                    </p>
                  </div>

                  <div className="mb-3 space-y-2">
                    <Label htmlFor={`remarks-${inspection.id}`}>Supervisor Remarks</Label>
                    <Input
                      id={`remarks-${inspection.id}`}
                      value={remarksByInspectionId[inspection.id] ?? inspection.supervisor_remarks ?? ''}
                      onChange={(event) => setRemarks(inspection.id, event.target.value)}
                      placeholder="Optional for approve, required for reject"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void onApprove(inspection.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void onReject(inspection.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
