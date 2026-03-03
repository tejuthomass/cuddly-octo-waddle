import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface ClientViewerOverview {
  totalInspections: number
  submittedInspections: number
  approvedInspections: number
  rejectedInspections: number
  openTickets: number
  escalatedTickets: number
  resolvedTickets: number
}

export interface ClientViewerInspectionRow {
  id: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  started_at: string
  submitted_at: string | null
}

export interface ClientViewerTicketRow {
  id: string
  field_label: string
  severity: 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved'
  created_at: string
  resolved_at: string | null
}

function assertClientId(clientId: string | undefined): string {
  if (!clientId) {
    throw new Error('Active client context is required.')
  }

  return clientId
}

export function useClientViewerOverview() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['client-viewer', 'overview', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const [{ data: inspections, error: inspectionsError }, { data: tickets, error: ticketsError }] = await Promise.all([
        supabase.from('inspections').select('status').eq('client_id', resolvedClientId),
        supabase.from('abnormality_tickets').select('status').eq('client_id', resolvedClientId),
      ])

      if (inspectionsError) {
        throw inspectionsError
      }

      if (ticketsError) {
        throw ticketsError
      }

      let submittedInspections = 0
      let approvedInspections = 0
      let rejectedInspections = 0

      for (const inspection of inspections ?? []) {
        if (inspection.status === 'submitted') {
          submittedInspections += 1
        }

        if (inspection.status === 'approved') {
          approvedInspections += 1
        }

        if (inspection.status === 'rejected') {
          rejectedInspections += 1
        }
      }

      let openTickets = 0
      let escalatedTickets = 0
      let resolvedTickets = 0

      for (const ticket of tickets ?? []) {
        if (ticket.status === 'open' || ticket.status === 'acknowledged') {
          openTickets += 1
        }

        if (ticket.status === 'escalated') {
          escalatedTickets += 1
        }

        if (ticket.status === 'resolved') {
          resolvedTickets += 1
        }
      }

      return {
        totalInspections: (inspections ?? []).length,
        submittedInspections,
        approvedInspections,
        rejectedInspections,
        openTickets,
        escalatedTickets,
        resolvedTickets,
      } satisfies ClientViewerOverview
    },
    enabled: Boolean(clientId),
  })
}

export function useClientViewerInspectionHistory() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['client-viewer', 'inspection-history', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const { data, error } = await supabase
        .from('inspections')
        .select('id, status, started_at, submitted_at')
        .eq('client_id', resolvedClientId)
        .order('started_at', { ascending: false })
        .limit(100)

      if (error) {
        throw error
      }

      return (data ?? []) as ClientViewerInspectionRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useClientViewerTicketHistory() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['client-viewer', 'ticket-history', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const { data, error } = await supabase
        .from('abnormality_tickets')
        .select('id, field_label, severity, status, created_at, resolved_at')
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        throw error
      }

      return (data ?? []) as ClientViewerTicketRow[]
    },
    enabled: Boolean(clientId),
  })
}
