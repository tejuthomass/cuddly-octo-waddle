import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminCompanyRow {
  id: string
  company_code: string
  company_name: string
  billing_address: string
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

const companiesKey = ['admin', 'companies'] as const
const facilitiesKey = ['admin', 'facilities'] as const

export function useAdminCompanies() {
  return useQuery({
    queryKey: companiesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_code, company_name, billing_address, is_active, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as AdminCompanyRow[]
    },
  })
}

export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { companyCode?: string; companyName: string; billingAddress: string }) => {
      const { error } = await supabase.from('companies').insert({
        company_code: payload.companyCode,
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

export function useAdminFacilities() {
  return useQuery({
    queryKey: facilitiesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, facility_code, company_id, facility_name, address_line_1, city, state, country, is_active, created_at, companies(company_name)')
        .order('created_at', { ascending: false })

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
        queryClient.invalidateQueries({ queryKey: facilitiesKey }),
        queryClient.invalidateQueries({ queryKey: companiesKey }),
      ])
    },
  })
}
