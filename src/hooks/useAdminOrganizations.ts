import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminCompanyRow {
  id: string
  company_code: string
  company_name: string
  billing_address: string
  logo_url: string | null
  facility_count: number
  scoped_user_count: number
  is_active: boolean
  created_at: string
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
  client_user_count: number
}

export interface AdminCompanyDetails {
  company: AdminCompanyRow
  stats: {
    total_user_count: number
    l1_user_count: number
    l2_user_count: number
    l3_user_count: number
    client_user_count: number
  }
  facilities: AdminFacilityWithUserStats[]
}

type RoleCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'CLIENT'

const scopedRoles = new Set<RoleCode>(['L1', 'L2', 'L3', 'CLIENT'])

const companiesKey = ['admin', 'companies'] as const
const companyDetailsPrefix = ['admin', 'company-details'] as const
const companyDetailsKey = (companyId?: string) => ['admin', 'company-details', companyId ?? 'missing'] as const
const facilitiesKey = (companyId?: string) => ['admin', 'facilities', companyId ?? 'all'] as const
const adminKey = ['admin'] as const

function buildActiveProfileSet(rows: Array<{ id: string; is_active: boolean }> | null | undefined) {
  const set = new Set<string>()
  for (const row of rows ?? []) {
    if (row.is_active) set.add(row.id)
  }
  return set
}

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => {
        void queryClient.invalidateQueries({ queryKey: companiesKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_companies' }, () => {
        void queryClient.invalidateQueries({ queryKey: companiesKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: companiesKey })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_role_assignments' }, () => {
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
      const [companiesResponse, facilitiesResponse, companyAccessResponse, profilesResponse, rolesResponse] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_code, company_name, billing_address, logo_url, is_active, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('facilities')
          .select('company_id'),
        supabase
          .from('user_companies')
          .select('company_id, user_id, is_active'),
        supabase
          .from('profiles')
          .select('id, is_active'),
        supabase
          .from('user_role_assignments')
          .select('user_id, role_code, is_active'),
      ])

      if (companiesResponse.error) throw companiesResponse.error
      if (facilitiesResponse.error) throw facilitiesResponse.error
      if (companyAccessResponse.error) throw companyAccessResponse.error
      if (profilesResponse.error) throw profilesResponse.error
      if (rolesResponse.error) throw rolesResponse.error

      const activeProfileIds = buildActiveProfileSet(profilesResponse.data)
      const activeScopedRoleByUser = buildActiveScopedRoleByUser(rolesResponse.data as Array<{ user_id: string; role_code: RoleCode; is_active: boolean }> | null)

      const facilityCountByCompanyId = new Map<string, number>()
      for (const row of facilitiesResponse.data ?? []) {
        facilityCountByCompanyId.set(row.company_id, (facilityCountByCompanyId.get(row.company_id) ?? 0) + 1)
      }

      const scopedUsersByCompanyId = new Map<string, Set<string>>()
      for (const row of companyAccessResponse.data ?? []) {
        if (!row.is_active) continue
        if (!activeProfileIds.has(row.user_id)) continue
        if (!activeScopedRoleByUser.has(row.user_id)) continue

        const current = scopedUsersByCompanyId.get(row.company_id) ?? new Set<string>()
        current.add(row.user_id)
        scopedUsersByCompanyId.set(row.company_id, current)
      }

      return (companiesResponse.data ?? []).map((row) => ({
        ...row,
        facility_count: facilityCountByCompanyId.get(row.id) ?? 0,
        scoped_user_count: scopedUsersByCompanyId.get(row.id)?.size ?? 0,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_facilities' }, () => {
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

      const [companyResponse, facilitiesResponse, userCompaniesResponse, userFacilitiesResponse, profilesResponse, rolesResponse] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_code, company_name, billing_address, logo_url, is_active, created_at')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('facilities')
          .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, companies(company_name)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_companies')
          .select('company_id, user_id, is_active')
          .eq('company_id', companyId),
        supabase
          .from('user_facilities')
          .select('facility_id, user_id, is_active'),
        supabase
          .from('profiles')
          .select('id, is_active'),
        supabase
          .from('user_role_assignments')
          .select('user_id, role_code, is_active'),
      ])

      if (companyResponse.error) throw companyResponse.error
      if (facilitiesResponse.error) throw facilitiesResponse.error
      if (userCompaniesResponse.error) throw userCompaniesResponse.error
      if (userFacilitiesResponse.error) throw userFacilitiesResponse.error
      if (profilesResponse.error) throw profilesResponse.error
      if (rolesResponse.error) throw rolesResponse.error

      if (!companyResponse.data) throw new Error('Client not found.')

      const facilityRows = (facilitiesResponse.data ?? []) as AdminFacilityRow[]
      const facilityIds = new Set(facilityRows.map((row) => row.id))

      const activeProfileIds = buildActiveProfileSet(profilesResponse.data)
      const activeScopedRoleByUser = buildActiveScopedRoleByUser(rolesResponse.data as Array<{ user_id: string; role_code: RoleCode; is_active: boolean }> | null)

      const companyScopedUsers = new Set<string>()
      for (const row of userCompaniesResponse.data ?? []) {
        if (!row.is_active) continue
        if (!activeProfileIds.has(row.user_id)) continue
        if (!activeScopedRoleByUser.has(row.user_id)) continue
        companyScopedUsers.add(row.user_id)
      }

      const companyStats = {
        total_user_count: companyScopedUsers.size,
        l1_user_count: 0,
        l2_user_count: 0,
        l3_user_count: 0,
        client_user_count: 0,
      }

      for (const userId of companyScopedUsers) {
        const roleCode = activeScopedRoleByUser.get(userId)
        if (roleCode === 'L1') companyStats.l1_user_count += 1
        if (roleCode === 'L2') companyStats.l2_user_count += 1
        if (roleCode === 'L3') companyStats.l3_user_count += 1
        if (roleCode === 'CLIENT') companyStats.client_user_count += 1
      }

      const facilityUserSets = new Map<string, {
        total: Set<string>
        l1: Set<string>
        l2: Set<string>
        l3: Set<string>
        client: Set<string>
      }>()

      for (const facilityId of facilityIds) {
        facilityUserSets.set(facilityId, {
          total: new Set<string>(),
          l1: new Set<string>(),
          l2: new Set<string>(),
          l3: new Set<string>(),
          client: new Set<string>(),
        })
      }

      for (const row of userFacilitiesResponse.data ?? []) {
        if (!row.is_active) continue
        if (!facilityIds.has(row.facility_id)) continue
        if (!activeProfileIds.has(row.user_id)) continue

        const roleCode = activeScopedRoleByUser.get(row.user_id)
        if (!roleCode) continue

        const statsSet = facilityUserSets.get(row.facility_id)
        if (!statsSet) continue

        statsSet.total.add(row.user_id)
        if (roleCode === 'L1') statsSet.l1.add(row.user_id)
        if (roleCode === 'L2') statsSet.l2.add(row.user_id)
        if (roleCode === 'L3') statsSet.l3.add(row.user_id)
        if (roleCode === 'CLIENT') statsSet.client.add(row.user_id)
      }

      const facilities = facilityRows.map((row) => {
        const statsSet = facilityUserSets.get(row.id)
        return {
          ...row,
          total_user_count: statsSet?.total.size ?? 0,
          l1_user_count: statsSet?.l1.size ?? 0,
          l2_user_count: statsSet?.l2.size ?? 0,
          l3_user_count: statsSet?.l3.size ?? 0,
          client_user_count: statsSet?.client.size ?? 0,
        }
      })

      const company: AdminCompanyRow = {
        ...companyResponse.data,
        facility_count: facilityRows.length,
        scoped_user_count: companyStats.total_user_count,
      }

      return {
        company,
        stats: companyStats,
        facilities,
      }
    },
  })
}

export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyName: string; billingAddress: string }) => {
      const { error } = await supabase.from('companies').insert({
        company_name: payload.companyName,
        billing_address: payload.billingAddress,
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
    mutationFn: async (payload: { companyId: string; companyName: string; billingAddress: string }) => {
      const { error } = await supabase
        .from('companies')
        .update({
          company_name: payload.companyName,
          billing_address: payload.billingAddress,
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
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, companies(company_name)')
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
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, companies(id, company_code, company_name, is_active)')
        .eq('id', facilityId)
        .maybeSingle<AdminFacilityDetailsRow>()

      if (error) throw error
      if (!data) throw new Error('Facility not found.')
      return data
    },
  })
}
