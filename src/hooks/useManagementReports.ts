import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface ManagementSummary {
  totalClients: number
  totalInspections: number
  submittedInspections: number
  approvedInspections: number
  rejectedInspections: number
  openTickets: number
  escalatedTickets: number
  resolvedTickets: number
}

export interface ManagementClientRollup {
  clientId: string
  clientName: string
  inspections: number
  openTickets: number
  escalatedTickets: number
  resolvedTickets: number
}

export interface ManagementTicketRow {
  id: string
  client_id: string
  field_label: string
  severity: 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved'
  created_at: string
  clients: Array<{ name: string }> | null
}

function uniqueClientIds(roles: Array<{ clientId: string }>): string[] {
  return [...new Set(roles.map((role) => role.clientId))]
}

export function useManagementOverview() {
  const { roles } = useAuth()
  const clientIds = uniqueClientIds(roles)

  return useQuery({
    queryKey: ['management', 'overview', clientIds.sort().join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) {
        return {
          summary: {
            totalClients: 0,
            totalInspections: 0,
            submittedInspections: 0,
            approvedInspections: 0,
            rejectedInspections: 0,
            openTickets: 0,
            escalatedTickets: 0,
            resolvedTickets: 0,
          } satisfies ManagementSummary,
          byClient: [] as ManagementClientRollup[],
        }
      }

      const [{ data: clients, error: clientsError }, { data: inspections, error: inspectionsError }, { data: tickets, error: ticketsError }] =
        await Promise.all([
          supabase.from('clients').select('id, name').in('id', clientIds),
          supabase.from('inspections').select('client_id, status').in('client_id', clientIds),
          supabase.from('abnormality_tickets').select('client_id, status').in('client_id', clientIds),
        ])

      if (clientsError) {
        throw clientsError
      }

      if (inspectionsError) {
        throw inspectionsError
      }

      if (ticketsError) {
        throw ticketsError
      }

      const clientNameById = new Map((clients ?? []).map((client) => [client.id, client.name]))

      const byClientMap = new Map<string, ManagementClientRollup>()
      for (const clientId of clientIds) {
        byClientMap.set(clientId, {
          clientId,
          clientName: clientNameById.get(clientId) ?? 'Unknown client',
          inspections: 0,
          openTickets: 0,
          escalatedTickets: 0,
          resolvedTickets: 0,
        })
      }

      let submittedInspections = 0
      let approvedInspections = 0
      let rejectedInspections = 0

      for (const inspection of inspections ?? []) {
        const rollup = byClientMap.get(inspection.client_id)
        if (!rollup) {
          continue
        }

        rollup.inspections += 1

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
        const rollup = byClientMap.get(ticket.client_id)
        if (!rollup) {
          continue
        }

        if (ticket.status === 'open' || ticket.status === 'acknowledged') {
          rollup.openTickets += 1
          openTickets += 1
        }

        if (ticket.status === 'escalated') {
          rollup.escalatedTickets += 1
          escalatedTickets += 1
        }

        if (ticket.status === 'resolved') {
          rollup.resolvedTickets += 1
          resolvedTickets += 1
        }
      }

      return {
        summary: {
          totalClients: clientIds.length,
          totalInspections: (inspections ?? []).length,
          submittedInspections,
          approvedInspections,
          rejectedInspections,
          openTickets,
          escalatedTickets,
          resolvedTickets,
        } satisfies ManagementSummary,
        byClient: [...byClientMap.values()].sort((a, b) => a.clientName.localeCompare(b.clientName)),
      }
    },
    enabled: clientIds.length > 0,
  })
}

export function useManagementRecentTickets() {
  const { roles } = useAuth()
  const clientIds = uniqueClientIds(roles)

  return useQuery({
    queryKey: ['management', 'recent-tickets', clientIds.sort().join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) {
        return [] as ManagementTicketRow[]
      }

      const { data, error } = await supabase
        .from('abnormality_tickets')
        .select('id, client_id, field_label, severity, status, created_at, clients(name)')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }

      return (data ?? []) as ManagementTicketRow[]
    },
    enabled: clientIds.length > 0,
  })
}
