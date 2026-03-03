import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface AdminUserRow {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  company_id: string | null
  created_at: string
  is_super_admin: boolean
}

interface CreateUserPayload {
  email: string
  password: string
  fullName: string
  phone?: string
}

const usersQueryKey = ['admin', 'users'] as const

export function useAdminUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, is_active, company_id, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const users = (data ?? []) as Omit<AdminUserRow, 'is_super_admin'>[]

      const { data: superAdminRows, error: superAdminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'l5_admin')
        .eq('is_active', true)

      if (superAdminError) {
        throw superAdminError
      }

      const superAdminIds = new Set((superAdminRows ?? []).map((row) => row.user_id))

      return users.map((row) => ({
        ...row,
        is_super_admin: superAdminIds.has(row.id),
      }))
    },
  })
}

export function useToggleUserActive() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: { userId: string; isActive: boolean }) => {
      if (payload.isActive === false) {
        const { data: roles, error: roleError } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', payload.userId)
          .eq('role', 'l5_admin')
          .eq('is_active', true)
          .limit(1)

        if (roleError) {
          throw roleError
        }

        if (roles && roles.length > 0) {
          throw new Error('Super Admin cannot be deactivated.')
        }
      }

      if (user?.id === payload.userId && payload.isActive === false) {
        throw new Error('You cannot deactivate your own account.')
      }

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: payload.isActive })
        .eq('id', payload.userId)

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: payload.email,
          password: payload.password,
          full_name: payload.fullName,
          phone: payload.phone,
        },
      })

      if (error) {
        const maybeContext = (error as { context?: Response }).context
        if (maybeContext) {
          try {
            const body = (await maybeContext.json()) as { error?: string; message?: string }
            const detailedMessage = body.error || body.message
            if (detailedMessage) {
              throw new Error(detailedMessage)
            }
          } catch {
            if (maybeContext.statusText) {
              throw new Error(maybeContext.statusText)
            }
          }
        }

        throw error
      }

      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}
