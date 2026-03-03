import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { ChecklistFrequency } from '@/types/database'

export interface ManagerTemplateRow {
  id: string
  name: string
  description: string | null
  frequency: ChecklistFrequency
  is_active: boolean
  updated_at: string
}

function assertClientId(clientId: string | undefined): string {
  if (!clientId) {
    throw new Error('Active client context is required.')
  }

  return clientId
}

export function useManagerTemplates() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['manager', 'templates', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description, frequency, is_active, updated_at')
        .eq('client_id', resolvedClientId)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as ManagerTemplateRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useCreateManagerTemplate() {
  const queryClient = useQueryClient()
  const { activeContext } = useAuth()

  return useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      frequency: ChecklistFrequency
      schema: Record<string, unknown>[]
    }) => {
      const clientId = assertClientId(activeContext?.clientId)

      const { error } = await supabase.from('checklist_templates').insert({
        client_id: clientId,
        name: payload.name,
        description: payload.description || null,
        frequency: payload.frequency,
        schema: payload.schema,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager', 'templates', activeContext?.clientId] })
    },
  })
}

export function useToggleManagerTemplateActive() {
  const queryClient = useQueryClient()
  const { activeContext } = useAuth()

  return useMutation({
    mutationFn: async (payload: { templateId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('checklist_templates')
        .update({ is_active: payload.isActive })
        .eq('id', payload.templateId)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager', 'templates', activeContext?.clientId] })
    },
  })
}
