import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { RoleCode } from '@/hooks/useAdminAccess'
import { supabase } from '@/lib/supabase'

export interface AdminUserRow {
  id: string
  user_id: string
  full_name: string
  email: string
  avatar_url: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  role_code: RoleCode | null
  role_title: string | null
  company_id: string | null
  facility_id: string | null
  is_l5_admin: boolean
}

interface CreateUserPayload {
  email: string
  fullName: string
  phone: string
  roleCode: RoleCode
  roleTitle?: string
  companyId?: string
  facilityId?: string
}

interface UpdateUserPayload {
  userId: string
  email: string
  fullName: string
  phone: string
  roleCode: RoleCode
  roleTitle: string
  companyId?: string
  facilityId?: string
}

const usersQueryKey = ['admin', 'users'] as const

const defaultRoleTitleByCode: Record<RoleCode, string> = {
  L1: 'Technician',
  L2: 'Supervisor',
  L3: 'Manager',
  L4: 'Management',
  L5: 'L5 Admin',
  CLIENT: 'Client User',
}

function isGlobalRole(roleCode: RoleCode) {
  return roleCode === 'L4' || roleCode === 'L5'
}

async function parseFunctionInvokeError(error: unknown): Promise<never> {
  const maybeContext = (error as { context?: Response })?.context
  if (maybeContext) {
    let detailedMessage = ''

    try {
      const body = (await maybeContext.json()) as { error?: string; message?: string }
      detailedMessage = body.error || body.message || ''
    } catch {
      // Ignore JSON parse failures and fall back to status text.
    }

    if (detailedMessage) {
      throw new Error(detailedMessage)
    }

    if (maybeContext.statusText) {
      throw new Error(maybeContext.statusText)
    }
  }

  throw error
}

async function upsertSingleRoleForUser(payload: { userId: string; roleCode: RoleCode; roleTitle: string }) {
  const { data: existing, error: existingError } = await supabase
    .from('user_role_assignments')
    .select('id')
    .eq('user_id', payload.userId)
    .limit(1)

  if (existingError) {
    throw existingError
  }

  if (existing && existing.length > 0) {
    const { error: updateError } = await supabase
      .from('user_role_assignments')
      .update({
        role_code: payload.roleCode,
        role_title: payload.roleTitle,
        is_active: true,
      })
      .eq('id', existing[0].id)

    if (updateError) {
      throw updateError
    }

    return
  }

  const { error: insertError } = await supabase.from('user_role_assignments').insert({
    user_id: payload.userId,
    role_code: payload.roleCode,
    role_title: payload.roleTitle,
    is_active: true,
  })

  if (insertError) {
    throw insertError
  }
}

async function resolveCompanyIdFromFacility(facilityId: string | undefined): Promise<string | undefined> {
  if (!facilityId) {
    return undefined
  }

  const { data, error } = await supabase
    .from('facilities')
    .select('company_id')
    .eq('id', facilityId)
    .maybeSingle<{ company_id: string }>()

  if (error) {
    throw error
  }

  return data?.company_id
}

async function syncOptionalScopeMappings(payload: {
  userId: string
  roleCode: RoleCode
  companyId?: string
  facilityId?: string
}) {
  if (isGlobalRole(payload.roleCode)) {
    const [companyDeactivate, facilityDeactivate] = await Promise.all([
      supabase.from('user_companies').update({ is_active: false }).eq('user_id', payload.userId),
      supabase.from('user_facilities').update({ is_active: false }).eq('user_id', payload.userId),
    ])

    if (companyDeactivate.error) {
      throw companyDeactivate.error
    }

    if (facilityDeactivate.error) {
      throw facilityDeactivate.error
    }

    return
  }

  let effectiveCompanyId = payload.companyId
  if (!effectiveCompanyId && payload.facilityId) {
    effectiveCompanyId = await resolveCompanyIdFromFacility(payload.facilityId)
  }

  const { error: deactivateCompaniesError } = await supabase
    .from('user_companies')
    .update({ is_active: false })
    .eq('user_id', payload.userId)

  if (deactivateCompaniesError) {
    throw deactivateCompaniesError
  }

  const { error: deactivateFacilitiesError } = await supabase
    .from('user_facilities')
    .update({ is_active: false })
    .eq('user_id', payload.userId)

  if (deactivateFacilitiesError) {
    throw deactivateFacilitiesError
  }

  if (effectiveCompanyId) {
    const { error: upsertCompanyError } = await supabase.from('user_companies').upsert(
      {
        user_id: payload.userId,
        company_id: effectiveCompanyId,
        is_active: true,
      },
      { onConflict: 'user_id,company_id' },
    )

    if (upsertCompanyError) {
      throw upsertCompanyError
    }
  }

  if (payload.facilityId) {
    const { error: upsertFacilityError } = await supabase.from('user_facilities').upsert(
      {
        user_id: payload.userId,
        facility_id: payload.facilityId,
        is_active: true,
      },
      { onConflict: 'user_id,facility_id' },
    )

    if (upsertFacilityError) {
      throw upsertFacilityError
    }
  }
}

export function useAdminUsers() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_role_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => {
      const [profilesResponse, rolesResponse, companiesResponse, facilitiesResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, employee_id, full_name, email, avatar_url, phone, is_active, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_role_assignments')
          .select('user_id, role_code, role_title, is_active')
          .eq('is_active', true),
        supabase
          .from('user_companies')
          .select('user_id, company_id, is_active')
          .eq('is_active', true),
        supabase
          .from('user_facilities')
          .select('user_id, facility_id, is_active')
          .eq('is_active', true),
      ])

      if (profilesResponse.error) throw profilesResponse.error
      if (rolesResponse.error) throw rolesResponse.error
      if (companiesResponse.error) throw companiesResponse.error
      if (facilitiesResponse.error) throw facilitiesResponse.error

      const roleByUserId = new Map<string, { role_code: RoleCode; role_title: string }>()
      ;(rolesResponse.data ?? []).forEach((row) => {
        if (!roleByUserId.has(row.user_id)) {
          roleByUserId.set(row.user_id, {
            role_code: row.role_code as RoleCode,
            role_title: row.role_title,
          })
        }
      })

      const companyByUserId = new Map<string, string>()
      ;(companiesResponse.data ?? []).forEach((row) => {
        if (!companyByUserId.has(row.user_id)) {
          companyByUserId.set(row.user_id, row.company_id)
        }
      })

      const facilityByUserId = new Map<string, string>()
      ;(facilitiesResponse.data ?? []).forEach((row) => {
        if (!facilityByUserId.has(row.user_id)) {
          facilityByUserId.set(row.user_id, row.facility_id)
        }
      })

      return (profilesResponse.data ?? []).map((profile) => {
        const role = roleByUserId.get(profile.id)

        return {
          id: profile.id,
          user_id: profile.employee_id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          phone: profile.phone,
          is_active: profile.is_active,
          created_at: profile.created_at,
          role_code: role?.role_code ?? null,
          role_title: role?.role_title ?? null,
          company_id: companyByUserId.get(profile.id) ?? null,
          facility_id: facilityByUserId.get(profile.id) ?? null,
          is_l5_admin: role?.role_code === 'L5',
        } as AdminUserRow
      })
    },
  })
}

export function useToggleUserActive() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: { userId: string; isActive: boolean }) => {
      if (user?.id === payload.userId && payload.isActive === false) {
        throw new Error('You cannot deactivate your own account.')
      }

      if (payload.isActive === false) {
        const { data: roles, error: roleError } = await supabase
          .from('user_role_assignments')
          .select('id')
          .eq('user_id', payload.userId)
          .eq('role_code', 'L5')
          .eq('is_active', true)
          .limit(1)

        if (roleError) {
          throw roleError
        }

        if (roles && roles.length > 0) {
          const { count, error: countError } = await supabase
            .from('user_role_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('role_code', 'L5')
            .eq('is_active', true)

          if (countError) {
            throw countError
          }

          if ((count ?? 0) <= 1) {
            throw new Error('At least one active admin must remain.')
          }
        }
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
      const roleTitle = payload.roleTitle?.trim() || defaultRoleTitleByCode[payload.roleCode]

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: payload.email,
          full_name: payload.fullName,
          phone: payload.phone,
        },
      })

      if (error) {
        await parseFunctionInvokeError(error)
      }

      const userId = (data as { user_id?: string } | null)?.user_id
      if (!userId) {
        throw new Error('User created but user id was not returned.')
      }

      await upsertSingleRoleForUser({ userId, roleCode: payload.roleCode, roleTitle })
      await syncOptionalScopeMappings({
        userId,
        roleCode: payload.roleCode,
        companyId: payload.companyId,
        facilityId: payload.facilityId,
      })

      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      const { error: updateError } = await supabase.functions.invoke('admin-update-user', {
        body: {
          user_id: payload.userId,
          email: payload.email,
          full_name: payload.fullName,
          phone: payload.phone,
        },
      })

      if (updateError) {
        await parseFunctionInvokeError(updateError)
      }

      await upsertSingleRoleForUser({
        userId: payload.userId,
        roleCode: payload.roleCode,
        roleTitle: payload.roleTitle,
      })

      await syncOptionalScopeMappings({
        userId: payload.userId,
        roleCode: payload.roleCode,
        companyId: payload.companyId,
        facilityId: payload.facilityId,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}

export function useHardDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string }) => {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: {
          user_id: payload.userId,
        },
      })

      if (error) {
        await parseFunctionInvokeError(error)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })
}
