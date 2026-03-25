import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminCompanyRow {
  id: string
  company_code: string
  company_name: string
  logo_url: string | null
  facility_count: number
  scoped_user_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminFacilityRow {
  id: string
  facility_code: string
  company_id: string
  facility_name: string
  address_line_1: string
  city: string
  state: string
  country: string
  is_active: boolean
  created_at: string
  updated_at: string
  companies: Array<{ company_name: string }> | null
}

export interface AdminFacilityDetailsRow extends AdminFacilityRow {
  companies: Array<{ id: string; company_code: string; company_name: string; is_active: boolean }> | null
}

export interface AdminFacilityWithUserStats extends AdminFacilityRow {
  total_user_count: number
  l1_user_count: number
  l2_user_count: number
  l3_user_count: number
}

export interface FacilityAssignedUser {
  user_id: string
  full_name: string
  employee_id: string
  role_code: 'L1' | 'L2' | 'L3'
}

export interface FacilityAssignableUser extends FacilityAssignedUser {
  assigned: boolean
}

export interface AdminFacilityMembers {
  facility: AdminFacilityDetailsRow
  assignedUsers: FacilityAssignedUser[]
  companyAssignableUsers: FacilityAssignableUser[]
}

export interface AdminCompanyStats {
  sites: { active: number; inactive: number }
  clients: { active: number; inactive: number }
  users: { active: number; inactive: number }
}

export interface AdminCompanyDetails {
  company: AdminCompanyRow
  stats: AdminCompanyStats
  facilities: AdminFacilityRow[]
  accountUsers: Array<{
    user_id: string
    employee_id: string
    full_name: string
    email: string
    role_code: RoleCode
    is_active: boolean
  }>
  clientAccessUsers: Array<{
    user_id: string
    employee_id: string
    full_name: string
    email: string
    is_active: boolean
  }>
  clientAccessCandidates: Array<{
    user_id: string
    employee_id: string
    full_name: string
    email: string
    is_active: boolean
  }>
}

type RoleCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'CLIENT'

const scopedRoles = new Set<RoleCode>(['L1', 'L2', 'L3', 'CLIENT'])

const companiesKey = ['admin', 'companies'] as const
const companyDetailsPrefix = ['admin', 'company-details'] as const
const companyDetailsKey = (companyId?: string) => ['admin', 'company-details', companyId ?? 'missing'] as const
const facilitiesKey = (companyId?: string) => ['admin', 'facilities', companyId ?? 'all'] as const
const facilityMembersKey = (facilityId?: string) => ['admin', 'facility-members', facilityId ?? 'missing'] as const
const adminKey = ['admin'] as const

function buildActiveScopedRoleByUser(rows: Array<{ user_id: string; role_code: RoleCode; is_active: boolean }> | null | undefined) {
  const map = new Map<string, RoleCode>()
  for (const row of rows ?? []) {
    if (!row.is_active) continue
    if (!scopedRoles.has(row.role_code)) continue
    map.set(row.user_id, row.role_code)
  }
  return map
}

export function useAdminCompanies() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-organizations-companies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: companiesKey })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return useQuery({
    queryKey: companiesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_code, company_name, logo_url, is_active, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row) => ({
        ...row,
        facility_count: 0,
        scoped_user_count: 0,
      })) as AdminCompanyRow[]
    },
  })
}

export function useAdminCompanyDetails(companyId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel(`admin-company-details-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: companyDetailsKey(companyId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: companyDetailsKey(companyId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: companyDetailsKey(companyId) })
      })

      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: companyDetailsKey(companyId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_role_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: companyDetailsKey(companyId) })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId, queryClient])

  return useQuery({
    queryKey: companyDetailsKey(companyId),
    enabled: Boolean(companyId),
    queryFn: async (): Promise<AdminCompanyDetails> => {
      if (!companyId) throw new Error('Company not found.')

      const [companyResponse, facilitiesResponse, userCompaniesResponse, profilesResponse, rolesResponse] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_code, company_name, logo_url, is_active, created_at, updated_at')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('facilities')
          .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, updated_at, companies(company_name)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_companies')
          .select('company_id, user_id, is_active')
          .eq('company_id', companyId),
        supabase
          .from('profiles')
          .select('id, employee_id, full_name, email, is_active'),
        supabase
          .from('user_role_assignments')
          .select('user_id, role_code, is_active'),
      ])

      if (companyResponse.error) throw companyResponse.error
      if (facilitiesResponse.error) throw facilitiesResponse.error
      if (userCompaniesResponse.error) throw userCompaniesResponse.error

      if (profilesResponse.error) throw profilesResponse.error
      if (rolesResponse.error) throw rolesResponse.error

      if (!companyResponse.data) throw new Error('Client not found.')

      const facilities = (facilitiesResponse.data ?? []) as AdminFacilityRow[]

      const activeScopedRoleByUser = buildActiveScopedRoleByUser(rolesResponse.data as Array<{ user_id: string; role_code: RoleCode; is_active: boolean }> | null)

      const companyUserIds = new Set<string>()
      for (const row of userCompaniesResponse.data ?? []) {
        if (!row.is_active) continue
        companyUserIds.add(row.user_id)
      }

      const profileById = new Map<string, { employee_id: string; full_name: string; email: string; is_active: boolean }>()
      for (const row of (profilesResponse.data ?? []) as Array<{ id: string; employee_id: string | null; full_name: string | null; email: string | null; is_active: boolean }>) {
        const fallbackName = row.full_name?.trim() || row.employee_id?.trim() || 'Unnamed user'

        profileById.set(row.id, {
          employee_id: row.employee_id ?? '-',
          full_name: fallbackName,
          email: row.email ?? '-',
          is_active: row.is_active,
        })
      }

      const accountUsers = Array.from(companyUserIds)
        .map((userId) => {
          const profile = profileById.get(userId)
          const roleCode = activeScopedRoleByUser.get(userId)

          if (!profile || !roleCode) return null

          return {
            user_id: userId,
            employee_id: profile.employee_id,
            full_name: profile.full_name,
            email: profile.email,
            role_code: roleCode,
            is_active: profile.is_active,
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))

      const clientAccessUsers = accountUsers
        .filter((row) => row.role_code === 'CLIENT')
        .map((row) => ({
          user_id: row.user_id,
          employee_id: row.employee_id,
          full_name: row.full_name,
          email: row.email,
          is_active: row.is_active,
        }))

      const clientAccessCandidates = Array.from(activeScopedRoleByUser.entries())
        .filter(([, role]) => role === 'CLIENT')
        .map(([userId]) => {
          const profile = profileById.get(userId)
          if (!profile || !profile.is_active) return null

          return {
            user_id: userId,
            employee_id: profile.employee_id,
            full_name: profile.full_name,
            email: profile.email,
            is_active: profile.is_active,
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .filter((row) => !clientAccessUsers.some((existing) => existing.user_id === row.user_id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))

      const company: AdminCompanyRow = {
        ...companyResponse.data,
        facility_count: facilities.length,
        scoped_user_count: accountUsers.length,
      }

      const stats: AdminCompanyStats = {
        sites: { active: 0, inactive: 0 },
        clients: { active: 0, inactive: 0 },
        users: { active: 0, inactive: 0 },
      }

      for (const facility of facilities) {
        if (facility.is_active) stats.sites.active++
        else stats.sites.inactive++
      }

      const primaryRoleByUser = new Map<string, { role_code: RoleCode; is_active: boolean }>()
      for (const row of (rolesResponse.data ?? []) as Array<{ user_id: string; role_code: RoleCode; is_active: boolean }>) {
        if (!scopedRoles.has(row.role_code)) continue
        const existing = primaryRoleByUser.get(row.user_id)
        if (!existing || (!existing.is_active && row.is_active)) {
          primaryRoleByUser.set(row.user_id, { role_code: row.role_code, is_active: row.is_active })
        }
      }

      for (const row of userCompaniesResponse.data ?? []) {
        if (!row.is_active) continue

        const userId = row.user_id
        const profile = profileById.get(userId)
        const roleInfo = primaryRoleByUser.get(userId)
        
        if (!profile || !roleInfo) continue
        
        const isFullyActive = row.is_active && profile.is_active && roleInfo.is_active

        if (roleInfo.role_code === 'CLIENT') {
          if (isFullyActive) stats.clients.active++
          else stats.clients.inactive++
        } else if (roleInfo.role_code === 'L1' || roleInfo.role_code === 'L2' || roleInfo.role_code === 'L3') {
          if (isFullyActive) stats.users.active++
          else stats.users.inactive++
        }
      }

      return {
        company,
        stats,
        facilities,
        accountUsers,
        clientAccessUsers,
        clientAccessCandidates,
      }
    },
  })
}

export function useGrantCompanyClientAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string; userIds: string[] }) => {
      if (payload.userIds.length === 0) return

      const rows = payload.userIds.map((userId) => ({
        user_id: userId,
        company_id: payload.companyId,
        is_active: true,
      }))

      const { error } = await supabase
        .from('user_companies')
        .upsert(rows, { onConflict: 'user_id,company_id' })

      if (error) throw error
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: companyDetailsKey(variables.companyId) })
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useRevokeCompanyClientAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string; userId: string }) => {
      const { error } = await supabase
        .from('user_companies')
        .update({ is_active: false })
        .eq('company_id', payload.companyId)
        .eq('user_id', payload.userId)

      if (error) throw error
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: companyDetailsKey(variables.companyId) })
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}
export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyName: string }) => {
      const { error } = await supabase.from('companies').insert({
        name: payload.companyName,
        company_name: payload.companyName,
        is_active: true,
      })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: companiesKey })
    },
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string; companyName: string }) => {
      const { error } = await supabase
        .from('companies')
        .update({
          name: payload.companyName,
          company_name: payload.companyName,
        })
        .eq('id', payload.companyId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: companiesKey })
      await queryClient.invalidateQueries({ queryKey: companyDetailsPrefix })
    },
  })
}

export function useUpdateCompanyLogo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string; logoBlob: Blob | null }) => {
      const storagePath = `${payload.companyId}/logo.webp`
      let logoUrl: string | null = null

      if (payload.logoBlob) {
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(storagePath, payload.logoBlob, { upsert: true, contentType: 'image/webp' })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('company-logos').getPublicUrl(storagePath)
        logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
      } else {
        const { error: removeError } = await supabase.storage.from('company-logos').remove([storagePath])

        if (removeError && !String(removeError.message ?? '').toLowerCase().includes('not found')) {
          throw removeError
        }
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoUrl })
        .eq('id', payload.companyId)

      if (updateError) throw updateError
      return logoUrl
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: companiesKey })
      await queryClient.invalidateQueries({ queryKey: companyDetailsPrefix })
    },
  })
}

export function useToggleCompanyActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string; isActive: boolean }) => {
      const { data: facilityRows, error: facilitySelectError } = await supabase
        .from('facilities')
        .select('id')
        .eq('company_id', payload.companyId)

      if (facilitySelectError) throw facilitySelectError

      const facilityIds = (facilityRows ?? []).map((row) => row.id)

      const updates = [
        supabase.from('companies').update({ is_active: payload.isActive }).eq('id', payload.companyId),
        supabase.from('facilities').update({ is_active: payload.isActive }).eq('company_id', payload.companyId),
        supabase.from('user_companies').update({ is_active: payload.isActive }).eq('company_id', payload.companyId),
      ]

      if (facilityIds.length > 0) {
        updates.push(supabase.from('user_facilities').update({ is_active: payload.isActive }).in('facility_id', facilityIds))
      }

      const results = await Promise.all(updates)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useHardDeleteCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyId: string }) => {
      const storagePath = `${payload.companyId}/logo.webp`
      const { error: removeError } = await supabase.storage.from('company-logos').remove([storagePath])

      if (removeError && !String(removeError.message ?? '').toLowerCase().includes('not found')) {
        throw removeError
      }

      const { error } = await supabase.from('companies').delete().eq('id', payload.companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useAdminFacilities(companyId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channelName = companyId ? `admin-organizations-facilities-${companyId}` : 'admin-organizations-facilities-all'
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilitiesKey(companyId) })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId, queryClient])

  return useQuery({
    queryKey: facilitiesKey(companyId),
    queryFn: async () => {
      let query = supabase
        .from('facilities')
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, updated_at, companies(company_name)')
        .order('created_at', { ascending: false })

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data, error } = await query

      if (error) throw error
      return (data ?? []) as AdminFacilityRow[]
    },
  })
}

export function useCreateFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      facilityCode?: string
      companyId: string
      facilityName: string
      addressLine1: string
      city: string
      state: string
      country: string
    }) => {
      const { error } = await supabase.from('facilities').insert({
        facility_code: payload.facilityCode,
        company_id: payload.companyId,
        facility_name: payload.facilityName,
        address_line_1: payload.addressLine1,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        is_active: true,
      })

      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'facilities'] }),
        queryClient.invalidateQueries({ queryKey: companiesKey }),
        queryClient.invalidateQueries({ queryKey: companyDetailsPrefix }),
      ])
    },
  })
}

export function useUpdateFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      facilityId: string
      facilityName: string
      addressLine1: string
      city: string
      state: string
      country: string
    }) => {
      const { error } = await supabase
        .from('facilities')
        .update({
          facility_name: payload.facilityName,
          address_line_1: payload.addressLine1,
          city: payload.city,
          state: payload.state,
          country: payload.country,
        })
        .eq('id', payload.facilityId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'facilities'] })
      await queryClient.invalidateQueries({ queryKey: companyDetailsPrefix })
    },
  })
}

export function useToggleFacilityActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { facilityId: string; isActive: boolean }) => {
      const updates = await Promise.all([
        supabase.from('facilities').update({ is_active: payload.isActive }).eq('id', payload.facilityId),
        supabase.from('user_facilities').update({ is_active: payload.isActive }).eq('facility_id', payload.facilityId),
      ])

      const failed = updates.find((result) => result.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useHardDeleteFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { facilityId: string }) => {
      const { error } = await supabase.from('facilities').delete().eq('id', payload.facilityId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useAdminFacility(facilityId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'facility', facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, updated_at, companies(id, company_code, company_name, is_active)')
        .eq('id', facilityId)
        .maybeSingle<AdminFacilityDetailsRow>()

      if (error) throw error
      if (!data) throw new Error('Facility not found.')
      return data
    },
  })
}

export function useAdminFacilityMembers(facilityId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!facilityId) return

    const channel = supabase
      .channel(`admin-facility-members-${facilityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilityMembersKey(facilityId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilityMembersKey(facilityId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilityMembersKey(facilityId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_role_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilityMembersKey(facilityId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: facilityMembersKey(facilityId) })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [facilityId, queryClient])

  return useQuery({
    queryKey: facilityMembersKey(facilityId),
    enabled: Boolean(facilityId),
    queryFn: async (): Promise<AdminFacilityMembers> => {
      if (!facilityId) throw new Error('Facility not found.')

      const facilityResponse = await supabase
        .from('facilities')
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, updated_at, companies(id, company_code, company_name, is_active)')
        .eq('id', facilityId)
        .maybeSingle<AdminFacilityDetailsRow>()

      if (facilityResponse.error) throw facilityResponse.error
      if (!facilityResponse.data) throw new Error('Facility not found.')

      const companyId = facilityResponse.data.company_id

      const [profilesResponse, rolesResponse, companyAccessResponse, facilityAccessResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, employee_id, is_active'),
        supabase
          .from('user_role_assignments')
          .select('user_id, role_code, is_active')
          .in('role_code', ['L1', 'L2', 'L3']),
        supabase
          .from('user_companies')
          .select('user_id, is_active')
          .eq('company_id', companyId),
        supabase
          .from('user_facilities')
          .select('user_id, is_active')
          .eq('facility_id', facilityId),
      ])

      if (profilesResponse.error) throw profilesResponse.error
      if (rolesResponse.error) throw rolesResponse.error
      if (companyAccessResponse.error) throw companyAccessResponse.error
      if (facilityAccessResponse.error) throw facilityAccessResponse.error

      const activeProfiles = new Map<string, { full_name: string; employee_id: string }>()
      for (const row of profilesResponse.data ?? []) {
        if (!row.is_active) continue
        activeProfiles.set(row.id, {
          full_name: row.full_name ?? 'Unnamed user',
          employee_id: row.employee_id ?? '-',
        })
      }

      const roleByUser = new Map<string, 'L1' | 'L2' | 'L3'>()
      for (const row of (rolesResponse.data ?? []) as Array<{ user_id: string; role_code: 'L1' | 'L2' | 'L3'; is_active: boolean }>) {
        if (!row.is_active) continue
        roleByUser.set(row.user_id, row.role_code)
      }

      const activeCompanyUsers = new Set<string>()
      for (const row of companyAccessResponse.data ?? []) {
        if (!row.is_active) continue
        activeCompanyUsers.add(row.user_id)
      }

      const activeFacilityUsers = new Set<string>()
      for (const row of facilityAccessResponse.data ?? []) {
        if (!row.is_active) continue
        activeFacilityUsers.add(row.user_id)
      }

      const companyAssignableUsers: FacilityAssignableUser[] = []
      for (const userId of activeCompanyUsers) {
        const profile = activeProfiles.get(userId)
        const role = roleByUser.get(userId)
        if (!profile || !role) continue

        companyAssignableUsers.push({
          user_id: userId,
          full_name: profile.full_name,
          employee_id: profile.employee_id,
          role_code: role,
          assigned: activeFacilityUsers.has(userId),
        })
      }

      companyAssignableUsers.sort((a, b) => {
        const byName = a.full_name.localeCompare(b.full_name)
        if (byName !== 0) return byName
        return a.employee_id.localeCompare(b.employee_id)
      })

      const assignedUsers = companyAssignableUsers
        .filter((row) => row.assigned)
        .map(({ assigned, ...user }) => user)

      return {
        facility: facilityResponse.data,
        assignedUsers,
        companyAssignableUsers,
      }
    },
  })
}

export function useAssignFacilityUsers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { facilityId: string; userIds: string[] }) => {
      if (payload.userIds.length === 0) return

      const rows = payload.userIds.map((userId) => ({
        user_id: userId,
        facility_id: payload.facilityId,
        is_active: true,
      }))

      const { error } = await supabase
        .from('user_facilities')
        .upsert(rows, { onConflict: 'user_id,facility_id' })

      if (error) throw error
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: facilityMembersKey(variables.facilityId) })
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}

export function useRemoveFacilityUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { facilityId: string; userId: string }) => {
      const { error } = await supabase
        .from('user_facilities')
        .update({ is_active: false })
        .eq('facility_id', payload.facilityId)
        .eq('user_id', payload.userId)

      if (error) throw error
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: facilityMembersKey(variables.facilityId) })
      await queryClient.invalidateQueries({ queryKey: adminKey })
    },
  })
}
