import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface TechnicianAssignmentTemplate {
  id: string
  name: string
  description: string | null
  frequency: 'once_per_shift' | 'hourly' | 'daily' | 'weekly'
  schema: Json
  shift_id: string | null
}

export interface TechnicianInspectionRow {
  id: string
  template_id: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  started_at: string
  submitted_at: string | null
  data: Json
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

export function useTechnicianAssignments() {
  const { activeContext, user } = useAuth()
  const clientId = activeContext?.clientId
  const userId = user?.id

  return useQuery({
    queryKey: ['technician', 'assignments', clientId, userId],
    queryFn: async () => {
      const context = assertContext({ clientId, userId })

      const { data: assignments, error: assignmentsError } = await supabase
        .from('checklist_assignments')
        .select('template_id, shift_id')
        .eq('client_id', context.clientId)
        .eq('is_active', true)
        .or(`assigned_user_id.is.null,assigned_user_id.eq.${context.userId}`)

      if (assignmentsError) {
        throw assignmentsError
      }

      const templateIds = [...new Set((assignments ?? []).map((row) => row.template_id))]
      if (templateIds.length === 0) {
        return [] as TechnicianAssignmentTemplate[]
      }

      const shiftByTemplate = new Map<string, string | null>()
      for (const assignment of assignments ?? []) {
        if (!shiftByTemplate.has(assignment.template_id)) {
          shiftByTemplate.set(assignment.template_id, assignment.shift_id)
        }
      }

      const { data: templates, error: templatesError } = await supabase
        .from('checklist_templates')
        .select('id, name, description, frequency, schema')
        .eq('client_id', context.clientId)
        .eq('is_active', true)
        .in('id', templateIds)
        .order('name', { ascending: true })

      if (templatesError) {
        throw templatesError
      }

      return (templates ?? []).map((template) => ({
        ...template,
        shift_id: shiftByTemplate.get(template.id) ?? null,
      })) as TechnicianAssignmentTemplate[]
    },
    enabled: Boolean(clientId && userId),
  })
}

export function useTechnicianInspections() {
  const { activeContext, user } = useAuth()
  const clientId = activeContext?.clientId
  const userId = user?.id

  return useQuery({
    queryKey: ['technician', 'inspections', clientId, userId],
    queryFn: async () => {
      const context = assertContext({ clientId, userId })

      const { data, error } = await supabase
        .from('inspections')
        .select('id, template_id, status, started_at, submitted_at, data')
        .eq('client_id', context.clientId)
        .eq('submitted_by', context.userId)
        .order('started_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as TechnicianInspectionRow[]
    },
    enabled: Boolean(clientId && userId),
  })
}

export function useTechnicianInspectionDetail(inspectionId: string | undefined) {
  const { activeContext, user } = useAuth()
  const clientId = activeContext?.clientId
  const userId = user?.id

  return useQuery({
    queryKey: ['technician', 'inspection-detail', inspectionId, clientId, userId],
    queryFn: async () => {
      const context = assertContext({ clientId, userId })
      if (!inspectionId) {
        throw new Error('Inspection id is required.')
      }

      const { data: inspection, error: inspectionError } = await supabase
        .from('inspections')
        .select('id, template_id, status, started_at, submitted_at, data')
        .eq('id', inspectionId)
        .eq('client_id', context.clientId)
        .eq('submitted_by', context.userId)
        .maybeSingle<TechnicianInspectionRow>()

      if (inspectionError) {
        throw inspectionError
      }

      if (!inspection) {
        throw new Error('Inspection was not found.')
      }

      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .select('id, name, schema')
        .eq('id', inspection.template_id)
        .eq('client_id', context.clientId)
        .maybeSingle<{ id: string; name: string; schema: Json }>()

      if (templateError) {
        throw templateError
      }

      if (!template) {
        throw new Error('Checklist template was not found.')
      }

      return {
        inspection,
        template,
      }
    },
    enabled: Boolean(inspectionId && clientId && userId),
  })
}

export function useCreateDraftInspection() {
  const { activeContext, user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { templateId: string; shiftId?: string | null }) => {
      const context = assertContext({ clientId: activeContext?.clientId, userId: user?.id })

      const { data, error } = await supabase
        .from('inspections')
        .insert({
          template_id: payload.templateId,
          client_id: context.clientId,
          submitted_by: context.userId,
          shift_id: payload.shiftId ?? null,
          status: 'draft',
          data: {},
        })
        .select('id')
        .single<{ id: string }>()

      if (error) {
        throw error
      }

      return data.id
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['technician', 'inspections'] })
    },
  })
}

export function useUpdateDraftInspection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { inspectionId: string; data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('inspections')
        .update({
          data: payload.data,
        })
        .eq('id', payload.inspectionId)

      if (error) {
        throw error
      }
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['technician', 'inspections'] }),
        queryClient.invalidateQueries({ queryKey: ['technician', 'inspection-detail', variables.inspectionId] }),
      ])
    },
  })
}

export function useSubmitInspection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { inspectionId: string; data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('inspections')
        .update({
          data: payload.data,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', payload.inspectionId)

      if (error) {
        throw error
      }
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['technician', 'inspections'] }),
        queryClient.invalidateQueries({ queryKey: ['technician', 'inspection-detail', variables.inspectionId] }),
      ])
    },
  })
}
