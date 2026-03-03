import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface SupervisorInspectionRow {
  id: string
  template_id: string
  submitted_by: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  started_at: string
  submitted_at: string | null
  supervisor_remarks: string | null
}

export interface SupervisorTicketRow {
  id: string
  inspection_id: string
  field_label: string
  submitted_value: string | null
  severity: 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved'
  created_at: string
  escalated_at: string | null
  resolved_at: string | null
}

function assertContext(input: { clientId?: string; userId?: string }) {
  if (!input.clientId || !input.userId) {
    throw new Error('Active user and client context are required.')
  }

  return {
    clientId: input.clientId,
    userId: input.userId,
  }
}

export function useSupervisorReviewQueue() {
  const { activeContext, user } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['supervisor', 'review-queue', clientId],
    queryFn: async () => {
      const context = assertContext({ clientId, userId: user?.id })

      const { data, error } = await supabase
        .from('inspections')
        .select('id, template_id, submitted_by, status, started_at, submitted_at, supervisor_remarks')
        .eq('client_id', context.clientId)
        .in('status', ['submitted', 'approved', 'rejected'])
        .order('submitted_at', { ascending: false, nullsFirst: false })

      if (error) {
        throw error
      }

      return (data ?? []) as SupervisorInspectionRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useSupervisorTickets() {
  const { activeContext, user } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['supervisor', 'tickets', clientId],
    queryFn: async () => {
      const context = assertContext({ clientId, userId: user?.id })

      const { data, error } = await supabase
        .from('abnormality_tickets')
        .select('id, inspection_id, field_label, submitted_value, severity, status, created_at, escalated_at, resolved_at')
        .eq('client_id', context.clientId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as SupervisorTicketRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useApproveInspection() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: { inspectionId: string; remarks?: string }) => {
      const { data, error } = await supabase
        .from('inspections')
        .update({
          status: 'approved',
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
          supervisor_remarks: payload.remarks || null,
        })
        .eq('id', payload.inspectionId)
        .select('id')

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Inspection was not updated.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
  })
}

export function useRejectInspection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { inspectionId: string; remarks: string }) => {
      const { data, error } = await supabase
        .from('inspections')
        .update({
          status: 'rejected',
          supervisor_remarks: payload.remarks,
        })
        .eq('id', payload.inspectionId)
        .select('id')

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Inspection was not updated.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
  })
}

export function useAcknowledgeTicket() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: { ticketId: string }) => {
      const { data, error } = await supabase
        .from('abnormality_tickets')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id ?? null,
        })
        .eq('id', payload.ticketId)
        .select('id')

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Ticket was not updated.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
  })
}

export function useEscalateTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { ticketId: string }) => {
      const { data, error } = await supabase
        .from('abnormality_tickets')
        .update({
          status: 'escalated',
          escalated_at: new Date().toISOString(),
        })
        .eq('id', payload.ticketId)
        .select('id')

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Ticket was not updated.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
  })
}

export function useResolveTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { ticketId: string; resolutionNotes: string }) => {
      const { data, error } = await supabase
        .from('abnormality_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: payload.resolutionNotes,
        })
        .eq('id', payload.ticketId)
        .select('id')

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Ticket was not updated.')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
  })
}
