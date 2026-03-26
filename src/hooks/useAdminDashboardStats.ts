import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalCompanies: number
  totalFacilities: number
  activeSessions: number
  roleDistribution: Array<{ name: string; value: number }>
}

const statsQueryKey = ['admin', 'dashboard-stats'] as const

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: statsQueryKey,
    queryFn: async (): Promise<DashboardStats> => {
      const [
        usersCount,
        activeUsersCount,
        companiesCount,
        facilitiesCount,
        sessionsCount,
        rolesData,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        supabase.from('active_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('user_role_assignments').select('role_code').eq('is_active', true)
      ])

      const roleCounts: Record<string, number> = {}
      ;(rolesData.data ?? []).forEach((r) => {
        const role = r.role_code || 'Unassigned'
        roleCounts[role] = (roleCounts[role] || 0) + 1
      })

      const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({
        name: name === 'CLIENT' ? 'Clients' : name === 'L1' ? 'L1 Techs' : name === 'L2' ? 'L2 Supers' : name === 'L3' ? 'L3 Mgrs' : name === 'L4' ? 'L4 Mgmt' : name === 'L5' ? 'Admins' : name,
        value,
      }))

      return {
        totalUsers: usersCount.count ?? 0,
        activeUsers: activeUsersCount.count ?? 0,
        totalCompanies: companiesCount.count ?? 0,
        totalFacilities: facilitiesCount.count ?? 0,
        activeSessions: sessionsCount.count ?? 0,
        roleDistribution,
      }
    },
    refetchInterval: 30_000, 
  })
}
