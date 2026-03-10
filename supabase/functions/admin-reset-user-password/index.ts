// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ResetPasswordPayload {
  user_id?: string
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
      return jsonResponse(403, { error: 'Only L5 admins can reset passwords.' })
    }
  }

  let payload: ResetPasswordPayload
  try {
    payload = (await request.json()) as ResetPasswordPayload
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const targetUserId = payload.user_id?.trim()
  if (!targetUserId) {
    return jsonResponse(400, { error: 'user_id is required.' })
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('phone')
    .eq('id', targetUserId)
    .maybeSingle<{ phone: string | null }>()

  if (targetProfileError) {
    return jsonResponse(500, { error: targetProfileError.message })
  }

  const phone = (targetProfile?.phone ?? '').trim()
  if (!phone) {
    return jsonResponse(400, { error: 'Target user has no phone number configured.' })
  }

  const { error: resetError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: phone,
  })

  if (resetError) {
    return jsonResponse(400, { error: resetError.message })
  }

  return jsonResponse(200, {
    message: 'Password reset to user phone number.',
    user_id: targetUserId,
  })
})
