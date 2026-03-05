import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AuditLogRow {
  id: string
  actor_user_id: string | null
  action_type: string
  entity_type: string
  entity_id: string | null
  created_at: string
  profiles: Array<{ full_name: string; employee_id: string }> | null
}

export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, actor_user_id, action_type, entity_type, entity_id, created_at, profiles!audit_logs_actor_user_id_fkey(full_name, employee_id)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data ?? []) as AuditLogRow[]
    },
    refetchInterval: 15_000,
  })
}
