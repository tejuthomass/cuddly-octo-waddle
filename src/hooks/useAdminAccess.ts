import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type RoleCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'CLIENT'

export interface OptionRow {
  id: string
  label: string
  companyId?: string
}

export interface RoleAssignmentRow {
  id: string
  user_id: string
  role_code: RoleCode
  role_title: string
  is_active: boolean
  created_at: string
  profiles: Array<{ full_name: string; employee_id: string }> | null
}

export interface UserCompanyRow {
  id: string
  user_id: string
  company_id: string
  is_active: boolean
  created_at: string
  profiles: Array<{ full_name: string; employee_id: string }> | null
  companies: Array<{ company_name: string; company_code: string }> | null
}

export interface UserFacilityRow {
  id: string
  user_id: string
  facility_id: string
  is_active: boolean
  created_at: string
  profiles: Array<{ full_name: string; employee_id: string }> | null
  facilities: Array<{ facility_name: string; facility_code: string }> | null
}

const rolesKey = ['admin', 'role-assignments'] as const
const userCompaniesKey = ['admin', 'user-companies'] as const
const userFacilitiesKey = ['admin', 'user-facilities'] as const
const usersOptionsKey = ['admin', 'users-options-v2'] as const
const companiesOptionsKey = ['admin', 'companies-options-v2'] as const
const facilitiesOptionsKey = ['admin', 'facilities-options-v2'] as const

const realtimeUsersOptionTables = ['profiles'] as const
const realtimeCompanyOptionTables = ['companies'] as const
const realtimeFacilityOptionTables = ['facilities'] as const
const realtimeRoleTables = ['user_role_assignments', 'profiles'] as const
const realtimeUserCompanyTables = ['user_companies', 'profiles', 'companies'] as const
const realtimeUserFacilityTables = ['user_facilities', 'profiles', 'facilities'] as const

function useAdminRealtimeInvalidate(queryKey: readonly string[], tables: readonly string[], channelName: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = tables
      .reduce(
        (currentChannel, table) =>
          currentChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
            void queryClient.invalidateQueries({ queryKey })
          }),
        supabase.channel(channelName),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelName, queryClient, queryKey, tables])
}

async function enforceAtLeastOneL5OnDeactivate(assignmentId: string) {
  const { data: assignment, error: assignmentError } = await supabase
    .from('user_role_assignments')
    .select('role_code, is_active')
    .eq('id', assignmentId)
    .maybeSingle<{ role_code: RoleCode; is_active: boolean }>()

  if (assignmentError) throw assignmentError

  if (assignment?.role_code !== 'L5' || !assignment.is_active) {
    return
  }

  const { count, error: countError } = await supabase
    .from('user_role_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('role_code', 'L5')
    .eq('is_active', true)

  if (countError) throw countError

  if ((count ?? 0) <= 1) {
    throw new Error('At least one active L5 admin must remain.')
  }
}

export function useRoleFormUsers() {
  useAdminRealtimeInvalidate(usersOptionsKey, realtimeUsersOptionTables, 'admin-users-options-realtime')

  return useQuery({
    queryKey: usersOptionsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        label: `${row.full_name || 'Unnamed user'} (${row.employee_id})`,
      })) as OptionRow[]
    },
  })
}

export function useCompanyOptions() {
  useAdminRealtimeInvalidate(companiesOptionsKey, realtimeCompanyOptionTables, 'admin-companies-options-realtime')

  return useQuery({
    queryKey: companiesOptionsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_name, company_code')
        .eq('is_active', true)
        .order('company_name', { ascending: true })

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        label: `${row.company_name} (${row.company_code})`,
      })) as OptionRow[]
    },
  })
}

export function useFacilityOptions() {
  useAdminRealtimeInvalidate(facilitiesOptionsKey, realtimeFacilityOptionTables, 'admin-facilities-options-realtime')

  return useQuery({
    queryKey: facilitiesOptionsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, company_id, facility_name, facility_code')
        .eq('is_active', true)
        .order('facility_name', { ascending: true })

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        label: `${row.facility_name} (${row.facility_code})`,
        companyId: row.company_id,
      })) as OptionRow[]
    },
  })
}

export function useRoleAssignments() {
  useAdminRealtimeInvalidate(rolesKey, realtimeRoleTables, 'admin-role-assignments-realtime')

  return useQuery({
    queryKey: rolesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_role_assignments')
        .select('id, user_id, role_code, role_title, is_active, created_at, profiles(full_name, employee_id)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as RoleAssignmentRow[]
    },
  })
}

export function useAssignRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string; roleCode: RoleCode; roleTitle: string }) => {
      const { data: existing, error: existingError } = await supabase
        .from('user_role_assignments')
        .select('id')
        .eq('user_id', payload.userId)
        .limit(1)

      if (existingError) throw existingError

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('user_role_assignments')
          .update({ role_code: payload.roleCode, role_title: payload.roleTitle, is_active: true })
          .eq('id', existing[0].id)

        if (error) throw error
        return
      }

      const { error } = await supabase.from('user_role_assignments').insert({
        user_id: payload.userId,
        role_code: payload.roleCode,
        role_title: payload.roleTitle,
        is_active: true,
      })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKey })
    },
  })
}

export function useToggleRoleActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { assignmentId: string; isActive: boolean }) => {
      if (!payload.isActive) {
        await enforceAtLeastOneL5OnDeactivate(payload.assignmentId)
      }

      const { error } = await supabase
        .from('user_role_assignments')
        .update({ is_active: payload.isActive })
        .eq('id', payload.assignmentId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKey })
    },
  })
}

export function useUserCompanies() {
  useAdminRealtimeInvalidate(userCompaniesKey, realtimeUserCompanyTables, 'admin-user-companies-realtime')

  return useQuery({
    queryKey: userCompaniesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_companies')
        .select('id, user_id, company_id, is_active, created_at, profiles(full_name, employee_id), companies(company_name, company_code)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as UserCompanyRow[]
    },
  })
}

export function useAssignUserCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string; companyId: string }) => {
      const { error } = await supabase.from('user_companies').upsert(
        {
          user_id: payload.userId,
          company_id: payload.companyId,
          is_active: true,
        },
        { onConflict: 'user_id,company_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userCompaniesKey })
    },
  })
}

export function useToggleUserCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { rowId: string; isActive: boolean }) => {
      const { error } = await supabase.from('user_companies').update({ is_active: payload.isActive }).eq('id', payload.rowId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userCompaniesKey })
    },
  })
}

export function useUserFacilities() {
  useAdminRealtimeInvalidate(userFacilitiesKey, realtimeUserFacilityTables, 'admin-user-facilities-realtime')

  return useQuery({
    queryKey: userFacilitiesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_facilities')
        .select('id, user_id, facility_id, is_active, created_at, profiles(full_name, employee_id), facilities(facility_name, facility_code)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as UserFacilityRow[]
    },
  })
}

export function useAssignUserFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string; facilityId: string }) => {
      const { error } = await supabase.from('user_facilities').upsert(
        {
          user_id: payload.userId,
          facility_id: payload.facilityId,
          is_active: true,
        },
        { onConflict: 'user_id,facility_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userFacilitiesKey })
    },
  })
}

export function useToggleUserFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { rowId: string; isActive: boolean }) => {
      const { error } = await supabase.from('user_facilities').update({ is_active: payload.isActive }).eq('id', payload.rowId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userFacilitiesKey })
    },
  })
}
