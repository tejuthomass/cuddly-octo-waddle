import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'

export interface AdminRoleRow {
  id: string
  user_id: string
  client_id: string
  role: AppRole
  is_active: boolean
  created_at: string
  profiles: Array<{ full_name: string }> | null
  clients: Array<{ name: string }> | null
}

export interface RoleFormOption {
  id: string
  label: string
}

const rolesQueryKey = ['admin', 'roles'] as const
const usersOptionsQueryKey = ['admin', 'users-options'] as const
const clientsOptionsQueryKey = ['admin', 'clients-options'] as const

export function useAdminRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, user_id, client_id, role, is_active, created_at, profiles(full_name), clients(name)')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as AdminRoleRow[]
    },
  })
}

export function useRoleFormUsers() {
  return useQuery({
    queryKey: usersOptionsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (error) {
        throw error
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        label: row.full_name || 'Unnamed user',
      })) as RoleFormOption[]
    },
  })
}

export function useRoleFormClients() {
  return useQuery({
    queryKey: clientsOptionsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name', { ascending: true })

      if (error) {
        throw error
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        label: row.name,
      })) as RoleFormOption[]
    },
  })
}

export function useAssignRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string; clientId: string; role: AppRole }) => {
      if (payload.role === 'l5_admin') {
        const { data: existingSuperAdmin, error: existingSuperAdminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'l5_admin')
          .eq('is_active', true)
          .limit(1)

        if (existingSuperAdminError) {
          throw existingSuperAdminError
        }

        if (existingSuperAdmin && existingSuperAdmin.length > 0 && existingSuperAdmin[0].user_id !== payload.userId) {
          throw new Error('Only one active Super Admin is allowed.')
        }
      }

      const { error } = await supabase.from('user_roles').upsert(
        {
          user_id: payload.userId,
          client_id: payload.clientId,
          role: payload.role,
          is_active: true,
        },
        { onConflict: 'user_id,client_id,role' },
      )

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey })
    },
  })
}

export function useToggleRoleActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { roleId: string; isActive: boolean }) => {
      if (!payload.isActive) {
        const { data: roleRow, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', payload.roleId)
          .maybeSingle<{ role: AppRole }>()

        if (roleError) {
          throw roleError
        }

        if (roleRow?.role === 'l5_admin') {
          throw new Error('Super Admin role cannot be disabled.')
        }
      }

      const { error } = await supabase.from('user_roles').update({ is_active: payload.isActive }).eq('id', payload.roleId)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey })
    },
  })
}
