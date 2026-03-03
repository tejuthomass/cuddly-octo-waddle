// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateUserPayload {
  email?: string
  password?: string
  full_name?: string
  phone?: string
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

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('company_id')
    .eq('id', callerUserId)
    .maybeSingle<{ company_id: string | null }>()

  if (callerProfileError) {
    return jsonResponse(500, { error: callerProfileError.message })
  }

  if (!callerProfile?.company_id) {
    return jsonResponse(403, { error: 'Caller is not assigned to a company.' })
  }

  const { data: callerRoles, error: callerRolesError } = await adminClient
    .from('user_roles')
    .select('id')
    .eq('user_id', callerUserId)
    .eq('role', 'l5_admin')
    .eq('is_active', true)
    .limit(1)

  if (callerRolesError) {
    return jsonResponse(500, { error: callerRolesError.message })
  }

  if (!callerRoles || callerRoles.length === 0) {
    return jsonResponse(403, { error: 'Only L5 admins can create users.' })
  }

  let payload: CreateUserPayload

  try {
    payload = (await request.json()) as CreateUserPayload
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const password = payload.password ?? ''
  const fullName = payload.full_name?.trim() ?? ''
  const phone = payload.phone?.trim() ?? null

  if (!email || !password || !fullName) {
    return jsonResponse(400, { error: 'email, password, and full_name are required.' })
  }

  if (password.length < 8) {
    return jsonResponse(400, { error: 'Password must be at least 8 characters.' })
  }

  const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  })

  if (createUserError || !createdUserData.user) {
    return jsonResponse(400, { error: createUserError?.message ?? 'Unable to create auth user.' })
  }

  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: createdUserData.user.id,
    full_name: fullName,
    phone,
    company_id: callerProfile.company_id,
    is_active: true,
  })

  if (profileError) {
    return jsonResponse(500, { error: profileError.message })
  }

  return jsonResponse(200, {
    user_id: createdUserData.user.id,
    email,
    message: 'User created successfully.',
  })
})
