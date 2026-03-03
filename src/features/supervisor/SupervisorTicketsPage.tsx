import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAcknowledgeTicket, useEscalateTicket, useResolveTicket, useSupervisorTickets } from '@/hooks/useSupervisorOperations'
import { toHumanErrorMessage } from '@/lib/errors'

export default function SupervisorTicketsPage() {
  const { data: tickets = [], isLoading } = useSupervisorTickets()
  const acknowledgeMutation = useAcknowledgeTicket()
  const escalateMutation = useEscalateTicket()
  const resolveMutation = useResolveTicket()
  const [resolutionByTicketId, setResolutionByTicketId] = useState<Record<string, string>>({})

  const setResolution = (ticketId: string, value: string) => {
    setResolutionByTicketId((previous) => ({
      ...previous,
      [ticketId]: value,
    }))
  }

  const onAcknowledge = async (ticketId: string) => {
    try {
      await acknowledgeMutation.mutateAsync({ ticketId })
      toast.success('Ticket acknowledged.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to acknowledge ticket.'))
    }
  }

  const onEscalate = async (ticketId: string) => {
    try {
      await escalateMutation.mutateAsync({ ticketId })
      toast.success('Ticket escalated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to escalate ticket.'))
    }
  }

  const onResolve = async (ticketId: string) => {
    try {
      const resolutionNotes = (resolutionByTicketId[ticketId] ?? '').trim()
      if (!resolutionNotes) {
        throw new Error('Resolution notes are required to resolve a ticket.')
      }

      await resolveMutation.mutateAsync({ ticketId, resolutionNotes })
      toast.success('Ticket resolved.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to resolve ticket.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Abnormality Tickets</CardTitle>
          <CardDescription>Acknowledge, escalate, or resolve abnormality tickets.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No abnormality tickets available.</p>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
                    <p>
                      <span className="font-medium">Field:</span> {ticket.field_label}
                    </p>
                    <p>
                      <span className="font-medium">Severity:</span> {ticket.severity}
                    </p>
                    <p>
                      <span className="font-medium">Status:</span> {ticket.status}
                    </p>
                    <p>
                      <span className="font-medium">Value:</span> {ticket.submitted_value || '—'}
                    </p>
                    <p>
                      <span className="font-medium">Created:</span> {new Date(ticket.created_at).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Inspection:</span> {ticket.inspection_id.slice(0, 8)}...
                    </p>
                  </div>

                  <div className="mb-3">
                    <Input
                      placeholder="Resolution notes for resolve action"
                      value={resolutionByTicketId[ticket.id] ?? ''}
                      onChange={(event) => setResolution(ticket.id, event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={acknowledgeMutation.isPending || escalateMutation.isPending || resolveMutation.isPending || ticket.status === 'resolved'}
                      onClick={() => void onAcknowledge(ticket.id)}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      disabled={acknowledgeMutation.isPending || escalateMutation.isPending || resolveMutation.isPending || ticket.status === 'resolved'}
                      onClick={() => void onEscalate(ticket.id)}
                    >
                      Escalate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={acknowledgeMutation.isPending || escalateMutation.isPending || resolveMutation.isPending || ticket.status === 'resolved'}
                      onClick={() => void onResolve(ticket.id)}
                    >
                      Resolve
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
