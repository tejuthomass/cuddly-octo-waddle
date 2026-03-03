import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface ManagerCategoryRow {
  id: string
  name: string
  created_at: string
}

export interface ManagerAssetRow {
  id: string
  name: string
  location: string
  is_active: boolean
  category_id: string | null
  asset_categories: Array<{ name: string }> | null
  created_at: string
}

function assertClientId(clientId: string | undefined): string {
  if (!clientId) {
    throw new Error('Active client context is required.')
  }

  return clientId
}

export function useManagerCategories() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['manager', 'categories', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const { data, error } = await supabase
        .from('asset_categories')
        .select('id, name, created_at')
        .eq('client_id', resolvedClientId)
        .order('name', { ascending: true })

      if (error) {
        throw error
      }

      return (data ?? []) as ManagerCategoryRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useManagerAssets() {
  const { activeContext } = useAuth()
  const clientId = activeContext?.clientId

  return useQuery({
    queryKey: ['manager', 'assets', clientId],
    queryFn: async () => {
      const resolvedClientId = assertClientId(clientId)

      const { data, error } = await supabase
        .from('assets')
        .select('id, name, location, is_active, category_id, created_at, asset_categories(name)')
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as ManagerAssetRow[]
    },
    enabled: Boolean(clientId),
  })
}

export function useCreateManagerCategory() {
  const queryClient = useQueryClient()
  const { activeContext } = useAuth()

  return useMutation({
    mutationFn: async (payload: { name: string }) => {
      const clientId = assertClientId(activeContext?.clientId)

      const { error } = await supabase.from('asset_categories').insert({
        client_id: clientId,
        name: payload.name,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager', 'categories', activeContext?.clientId] })
    },
  })
}

export function useCreateManagerAsset() {
  const queryClient = useQueryClient()
  const { activeContext } = useAuth()

  return useMutation({
    mutationFn: async (payload: { name: string; location: string; categoryId?: string }) => {
      const clientId = assertClientId(activeContext?.clientId)

      const { error } = await supabase.from('assets').insert({
        client_id: clientId,
        name: payload.name,
        location: payload.location,
        category_id: payload.categoryId || null,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['manager', 'assets', activeContext?.clientId] }),
        queryClient.invalidateQueries({ queryKey: ['manager', 'categories', activeContext?.clientId] }),
      ])
    },
  })
}
