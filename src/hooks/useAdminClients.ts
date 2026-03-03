import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminClientRow {
  id: string
  company_id: string
  name: string
  logo_url: string | null
  created_at: string
}

const clientsQueryKey = ['admin', 'clients'] as const

async function fetchCurrentCompanyId(): Promise<string> {
  const { data, error } = await supabase.rpc('current_company_id')
  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Current company is not resolved for this user.')
  }

  return data
}

export function useAdminClients() {
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_id, name, logo_url, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as AdminClientRow[]
    },
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { name: string; logoUrl?: string }) => {
      const companyId = await fetchCurrentCompanyId()

      const { error } = await supabase.from('clients').insert({
        company_id: companyId,
        name: payload.name,
        logo_url: payload.logoUrl ?? null,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clientsQueryKey })
    },
  })
}
