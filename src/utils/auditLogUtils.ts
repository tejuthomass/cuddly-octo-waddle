import { AuditLogRow } from '@/hooks/useAuditLogs'

export function formatAuditLogAction(log: AuditLogRow): string {
  const { action_type, entity_type } = log

  const entityMap: Record<string, string> = {
    profiles: 'User Account',
    companies: 'Client Account',
    facilities: 'Service Site',
    user_role_assignments: 'Role Assignment',
    user_companies: 'Company Access',
    user_facilities: 'Site Assignment',
    active_sessions: 'User Session',
  }

  const actionMap: Record<string, string> = {
    INSERT: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Removed',
  }

  const friendlyEntity = entityMap[entity_type] || entity_type
  const friendlyAction = actionMap[action_type] || action_type

  // Special cases for better natural language
  if (action_type === 'INSERT' && entity_type === 'profiles') return 'Registered new user'
  if (action_type === 'UPDATE' && entity_type === 'profiles') return 'Modified user profile'
  if (action_type === 'UPDATE' && entity_type === 'companies') return 'Updated client details'
  if (entity_type === 'user_facilities') {
    return action_type === 'INSERT' ? 'Assigned staff to site' : 'Revoked site access'
  }
  if (entity_type === 'user_companies') {
    return action_type === 'INSERT' ? 'Granted company access' : 'Revoked company access'
  }

  return `${friendlyAction} ${friendlyEntity.toLowerCase()}`
}
