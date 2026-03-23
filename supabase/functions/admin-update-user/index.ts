// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface UpdateUserPayload {
  user_id?: string
  email?: string
  full_name?: string
  phone?: string
  is_active?: boolean
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Supabase environment is not configured.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const authorization = request.headers.get('Authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Missing bearer token.' })
  }

  let jwt = authorization.replace(/^Bearer\s+/i, '').trim()
  if (jwt.toLowerCase().startsWith('bearer ')) {
    jwt = jwt.slice(7).trim()
  }

  const callerClient = createClient(supabaseUrl, anonKey)
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser(jwt)
  if (callerAuthError || !callerAuth.user) {
    return jsonResponse(401, { error: callerAuthError?.message ?? 'Invalid JWT' })
  }

  const callerUserId = callerAuth.user.id

  const { data: callerRoles, error: callerRolesError } = await callerClient
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
    return jsonResponse(403, { error: 'Only L5 admins can update users.' })
  }

  let payload: UpdateUserPayload
  try {
    payload = (await request.json()) as UpdateUserPayload
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const userId = payload.user_id?.trim()
  const isActive = payload.is_active
  const email = payload.email?.trim().toLowerCase()
  const fullName = payload.full_name?.trim()
  const phone = payload.phone?.trim()

  if (!userId) {
    return jsonResponse(400, { error: 'user_id is required.' })
  }

  if (typeof isActive === 'boolean') {
    const { error: statusUpdateError } = await adminClient
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)

    if (statusUpdateError) {
      return jsonResponse(500, { error: statusUpdateError.message })
    }

    return jsonResponse(200, {
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
      user_id: userId,
      is_active: isActive,
    })
  }

  if (!email || !fullName || !phone) {
    return jsonResponse(400, { error: 'user_id, email, full_name, and phone are required for profile updates.' })
  }

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
    email,
    user_metadata: {
      full_name: fullName,
      phone,
    },
  })

  if (authUpdateError) {
    return jsonResponse(400, { error: authUpdateError.message })
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({
      email,
      full_name: fullName,
      phone,
    })
    .eq('id', userId)

  if (profileUpdateError) {
    return jsonResponse(500, { error: profileUpdateError.message })
  }

  return jsonResponse(200, {
    message: 'User updated successfully.',
    user_id: userId,
  })
})
