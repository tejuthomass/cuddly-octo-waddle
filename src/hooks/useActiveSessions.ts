import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ActiveSessionRow {
  user_id: string
  session_token: string
  last_seen: string
  profiles: Array<{ full_name: string }> | null
}

const sessionsQueryKey = ['admin', 'active-sessions'] as const

export function useActiveSessions() {
  return useQuery({
    queryKey: sessionsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('user_id, session_token, last_seen, profiles(full_name)')
        .order('last_seen', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as ActiveSessionRow[]
    },
  })
}

export function useClearActiveSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const { error } = await supabase.from('active_sessions').delete().eq('user_id', payload.userId)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey })
    },
  })
}
