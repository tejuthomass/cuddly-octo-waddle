import type { AppRole } from '@/types/database'

export const rolePriority: Record<AppRole, number> = {
  l5_admin: 1,
  l4_management: 2,
  l3_manager: 3,
  l2_supervisor: 4,
  l1_technician: 5,
  client_viewer: 6,
}

export function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    l1_technician: 'L1 Technician',
    l2_supervisor: 'L2 Supervisor',
    l3_manager: 'L3 Manager',
    l4_management: 'L4 Management',
    l5_admin: 'L5 Admin',
    client_viewer: 'Client Viewer',
  }

  return labels[role]
}

export function getContextStorageKey(userId: string): string {
  return `cmms-active-context-${userId}`
}

export function contextId(clientId: string, role: AppRole): string {
  return `${clientId}:${role}`
}
