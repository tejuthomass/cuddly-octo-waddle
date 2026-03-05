// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeleteUserPayload {
  user_id?: string
}

async function purgeUserLinkedRows(adminClient: ReturnType<typeof createClient>, userId: string) {
  // Delete inspection ownership rows first (submitted_by is ON DELETE RESTRICT).
  const { error: deleteInspectionsError } = await adminClient
    .from('inspections')
    .delete()
    .eq('submitted_by', userId)

  if (deleteInspectionsError) {
    throw deleteInspectionsError
  }

  // Clear optional references to the user to avoid stale links.
  const cleanupOps = [
    adminClient.from('inspections').update({ approved_by: null }).eq('approved_by', userId),
    adminClient.from('abnormality_tickets').update({ assigned_to: null }).eq('assigned_to', userId),
    adminClient.from('abnormality_tickets').update({ acknowledged_by: null }).eq('acknowledged_by', userId),
    adminClient.from('checklist_assignments').update({ assigned_user_id: null }).eq('assigned_user_id', userId),
    adminClient.from('checklist_assignments').update({ created_by: null }).eq('created_by', userId),
    adminClient.from('checklist_templates').update({ created_by: null }).eq('created_by', userId),
    adminClient.from('vendor_permits').update({ generated_by: null }).eq('generated_by', userId),
    adminClient.from('audit_logs').delete().eq('actor_user_id', userId),
    adminClient.from('audit_logs').delete().eq('target_user_id', userId),
  ]

  const cleanupResults = await Promise.all(cleanupOps)
  const failed = cleanupResults.find((result) => result.error)
  if (failed?.error) {
    throw failed.error
  }
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Supabase environment is not configured.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const authorization = request.headers.get('Authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Missing bearer token.' })
  }

  const jwt = authorization.replace('Bearer ', '')
  const { data: callerAuth, error: callerAuthError } = await adminClient.auth.getUser(jwt)

  if (callerAuthError || !callerAuth.user) {
    return jsonResponse(401, { error: 'Invalid caller token.' })
  }

  const callerUserId = callerAuth.user.id

  let payload: DeleteUserPayload
  try {
    payload = (await request.json()) as DeleteUserPayload
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const targetUserId = payload.user_id?.trim()
  if (!targetUserId) {
    return jsonResponse(400, { error: 'user_id is required.' })
  }

  if (targetUserId === callerUserId) {
    return jsonResponse(400, { error: 'You cannot permanently delete your own account.' })
  }

  const { data: callerRoles, error: callerRolesError } = await adminClient
    .from('user_role_assignments')
    .select('id')
    .eq('user_id', callerUserId)
    .eq('role_code', 'L5')
    .eq('is_active', true)
    .limit(1)

  if (callerRolesError) {
    return jsonResponse(500, { error: callerRolesError.message })
  }

  if (!callerRoles || callerRoles.length === 0) {
    const { data: legacyRoles, error: legacyRolesError } = await adminClient
      .from('user_roles')
      .select('id')
      .eq('user_id', callerUserId)
      .eq('role', 'l5_admin')
      .eq('is_active', true)
      .limit(1)

    if (legacyRolesError) {
      return jsonResponse(500, { error: legacyRolesError.message })
    }

    if (!legacyRoles || legacyRoles.length === 0) {
      return jsonResponse(403, { error: 'Only L5 admins can permanently delete users.' })
    }
  }

  const { data: targetRoleRows, error: targetRoleError } = await adminClient
    .from('user_role_assignments')
    .select('role_code, is_active')
    .eq('user_id', targetUserId)

  if (targetRoleError) {
    return jsonResponse(500, { error: targetRoleError.message })
  }

  const isTargetL5 = (targetRoleRows ?? []).some((row) => row.role_code === 'L5' && row.is_active)

  if (isTargetL5) {
    const { count, error: countError } = await adminClient
      .from('user_role_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('role_code', 'L5')
      .eq('is_active', true)

    if (countError) {
      return jsonResponse(500, { error: countError.message })
    }

    if ((count ?? 0) <= 1) {
      return jsonResponse(400, { error: 'Cannot permanently delete the last active L5 admin.' })
    }
  }

  try {
    await purgeUserLinkedRows(adminClient, targetUserId)
  } catch (error) {
    return jsonResponse(500, { error: (error as Error).message })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId)
  if (deleteError) {
    return jsonResponse(500, { error: deleteError.message })
  }

  return jsonResponse(200, {
    message: 'User permanently deleted.',
    user_id: targetUserId,
  })
})
