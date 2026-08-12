import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  corsHeaders,
  errorResponse,
  isValidE164,
  isValidPin,
  jsonResponse,
  normalizePhone,
  phoneToEmail,
} from '../_shared/staffAuth.ts'

interface StaffRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  auth_user_id: string | null
  pin_set_at: string | null
  is_admin: boolean
  created_at: string
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function getAnonClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse('Niet ingelogd', 401) }
  }
  const token = authHeader.slice(7)
  const service = getServiceClient()
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) {
    return { error: errorResponse('Sessie ongeldig', 401) }
  }
  return { user: data.user, token, service }
}

async function requireAdmin(req: Request) {
  const auth = await requireUser(req)
  if ('error' in auth && auth.error) return auth

  const { data: staff, error } = await auth.service!
    .from('staff')
    .select('*')
    .eq('auth_user_id', auth.user!.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff) return { error: errorResponse('Geen staff-profiel gevonden', 404) }
  if (!staff.is_admin) {
    return { error: errorResponse('Alleen admins mogen dit doen', 403) }
  }

  return { ...auth, staff: staff as StaffRow }
}

function mapStaff(row: StaffRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    pinSetAt: row.pin_set_at,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  }
}

const STAFF_SELECT =
  'id, first_name, last_name, phone, pin_set_at, created_at, auth_user_id, is_admin'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body = await req.json()
    const action = String(body.action ?? '')

    switch (action) {
      case 'check':
        return await handleCheck(body)
      case 'login':
        return await handleLogin(body)
      case 'change-pin':
        return await handleChangePin(req, body)
      case 'list-staff':
        return await handleListStaff(req)
      case 'add-staff':
        return await handleAddStaff(req, body)
      case 'update-staff':
        return await handleUpdateStaff(req, body)
      case 'remove-staff':
        return await handleRemoveStaff(req, body)
      case 'me':
        return await handleMe(req)
      case 'setup':
        return errorResponse(
          'PIN wordt door een admin ingesteld. Neem contact op met je beheerder.',
          403,
        )
      default:
        return errorResponse(`Onbekende action: ${action}`)
    }
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    console.error('[staff-auth]', message)
    return errorResponse(message, 500)
  }
})

async function handleCheck(body: Record<string, unknown>) {
  const phone = normalizePhone(body.phone)
  if (!isValidE164(phone)) {
    return errorResponse('Ongeldig telefoonnummer')
  }

  const service = getServiceClient()
  const { data, error } = await service
    .from('staff')
    .select('id, pin_set_at, first_name, last_name')
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return errorResponse('Dit nummer staat niet op de toeganglijst', 403)
  }
  if (!data.pin_set_at) {
    return errorResponse(
      'Nog geen PIN ingesteld. Vraag een admin om je account aan te maken.',
      403,
    )
  }

  return jsonResponse({
    ok: true,
    firstName: data.first_name,
    lastName: data.last_name,
  })
}

async function handleLogin(body: Record<string, unknown>) {
  const phone = normalizePhone(body.phone)
  const pin = body.pin
  if (!isValidE164(phone)) return errorResponse('Ongeldig telefoonnummer')
  if (!isValidPin(pin)) return errorResponse('PIN moet 6 cijfers zijn')

  const service = getServiceClient()
  const { data: staff, error: staffError } = await service
    .from('staff')
    .select(STAFF_SELECT)
    .eq('phone', phone)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff) return errorResponse('Dit nummer staat niet op de toeganglijst', 403)
  if (!staff.pin_set_at) {
    return errorResponse(
      'Nog geen PIN ingesteld. Vraag een admin om je account aan te maken.',
      403,
    )
  }

  const anon = getAnonClient()
  const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: pin as string,
  })
  if (signInError) {
    return errorResponse('Onjuiste PIN', 401)
  }

  return jsonResponse({
    ok: true,
    session: sessionData.session,
    staff: mapStaff(staff as StaffRow),
  })
}

async function handleChangePin(req: Request, body: Record<string, unknown>) {
  const auth = await requireUser(req)
  if ('error' in auth && auth.error) return auth.error

  const currentPin = body.currentPin
  const newPin = body.newPin
  if (!isValidPin(currentPin)) return errorResponse('Huidige PIN is ongeldig')
  if (!isValidPin(newPin)) return errorResponse('Nieuwe PIN moet 6 cijfers zijn')
  if (currentPin === newPin) return errorResponse('Nieuwe PIN moet anders zijn')

  const service = auth.service!
  const { data: staff, error: staffError } = await service
    .from('staff')
    .select('*')
    .eq('auth_user_id', auth.user!.id)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff) return errorResponse('Geen staff-profiel gevonden', 404)

  const anon = getAnonClient()
  const { error: verifyError } = await anon.auth.signInWithPassword({
    email: phoneToEmail(staff.phone),
    password: currentPin as string,
  })
  if (verifyError) return errorResponse('Huidige PIN is onjuist', 401)

  const { error: updateError } = await service.auth.admin.updateUserById(auth.user!.id, {
    password: newPin as string,
  })
  if (updateError) throw new Error(updateError.message)

  const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({
    email: phoneToEmail(staff.phone),
    password: newPin as string,
  })
  if (signInError) throw new Error(signInError.message)

  return jsonResponse({ ok: true, session: sessionData.session })
}

async function handleListStaff(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const { data, error } = await auth.service!
    .from('staff')
    .select(STAFF_SELECT)
    .order('last_name')
    .order('first_name')

  if (error) throw new Error(error.message)

  return jsonResponse({
    data: (data ?? []).map(row => mapStaff(row as StaffRow)),
  })
}

async function handleAddStaff(req: Request, body: Record<string, unknown>) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const phone = normalizePhone(body.phone)
  const pin = body.pin
  const isAdmin = Boolean(body.isAdmin)

  if (!firstName || !lastName) return errorResponse('Voor- en achternaam verplicht')
  if (!isValidE164(phone)) return errorResponse('Ongeldig telefoonnummer')
  if (!isValidPin(pin)) return errorResponse('PIN moet 6 cijfers zijn')

  const service = auth.service!
  const email = phoneToEmail(phone)

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: pin as string,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      phone,
    },
  })

  if (createError) {
    if (createError.message.toLowerCase().includes('already')) {
      return errorResponse('Dit telefoonnummer heeft al een login')
    }
    throw new Error(createError.message)
  }
  if (!created.user) throw new Error('Kon gebruiker niet aanmaken')

  const { data, error } = await service
    .from('staff')
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone,
      auth_user_id: created.user.id,
      pin_set_at: new Date().toISOString(),
      is_admin: isAdmin,
    })
    .select(STAFF_SELECT)
    .single()

  if (error) {
    // Roll back auth user if staff insert fails
    await service.auth.admin.deleteUser(created.user.id).catch(() => {})
    if (error.code === '23505') {
      return errorResponse('Dit telefoonnummer staat al op de lijst')
    }
    throw new Error(error.message)
  }

  return jsonResponse({ data: mapStaff(data as StaffRow) })
}

async function handleUpdateStaff(req: Request, body: Record<string, unknown>) {
  const auth = await requireUser(req)
  if ('error' in auth && auth.error) return auth.error

  const id = String(body.id ?? '').trim()
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const pin = body.pin
  if (!id) return errorResponse('id verplicht')
  if (!firstName || !lastName) return errorResponse('Voor- en achternaam verplicht')

  const service = auth.service!
  const { data: actor, error: actorError } = await service
    .from('staff')
    .select(STAFF_SELECT)
    .eq('auth_user_id', auth.user!.id)
    .maybeSingle()

  if (actorError) throw new Error(actorError.message)
  if (!actor) return errorResponse('Geen staff-profiel gevonden', 404)

  const { data: target, error: targetError } = await service
    .from('staff')
    .select(STAFF_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (targetError) throw new Error(targetError.message)
  if (!target) return errorResponse('Medewerker niet gevonden', 404)

  const isOwn = target.auth_user_id === auth.user!.id
  if (!isOwn && !actor.is_admin) {
    return errorResponse('Alleen admins mogen andere medewerkers bewerken', 403)
  }

  // Optional PIN reset (admin for others, or anyone for self)
  if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
    if (!isValidPin(pin)) return errorResponse('PIN moet 6 cijfers zijn')
    if (!target.auth_user_id) {
      return errorResponse('Deze medewerker heeft nog geen login')
    }
    const { error: pinError } = await service.auth.admin.updateUserById(target.auth_user_id, {
      password: String(pin),
    })
    if (pinError) throw new Error(pinError.message)
  }

  const updates: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
  }

  // Only admins can change is_admin; cannot remove own admin flag
  if (actor.is_admin && typeof body.isAdmin === 'boolean') {
    if (isOwn && body.isAdmin === false) {
      return errorResponse('Je kunt je eigen admin-rol niet uitzetten')
    }
    updates.is_admin = body.isAdmin
  }

  if (body.phone !== undefined && body.phone !== null && String(body.phone).trim() !== '') {
    if (!actor.is_admin) {
      return errorResponse('Alleen admins mogen het telefoonnummer wijzigen', 403)
    }
    const newPhone = normalizePhone(body.phone)
    if (!isValidE164(newPhone)) return errorResponse('Ongeldig telefoonnummer')
    if (newPhone !== target.phone) {
      const { data: existing, error: existingError } = await service
        .from('staff')
        .select('id')
        .eq('phone', newPhone)
        .maybeSingle()
      if (existingError) throw new Error(existingError.message)
      if (existing && existing.id !== id) {
        return errorResponse('Dit telefoonnummer staat al op de lijst')
      }
      if (!target.auth_user_id) {
        return errorResponse('Deze medewerker heeft nog geen login')
      }
      const { error: emailError } = await service.auth.admin.updateUserById(target.auth_user_id, {
        email: phoneToEmail(newPhone),
      })
      if (emailError) throw new Error(emailError.message)
      updates.phone = newPhone
    }
  }

  const { data, error } = await service
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select(STAFF_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return jsonResponse({ data: mapStaff(data as StaffRow) })
}

async function handleRemoveStaff(req: Request, body: Record<string, unknown>) {
  const auth = await requireAdmin(req)
  if ('error' in auth && auth.error) return auth.error

  const id = String(body.id ?? '').trim()
  if (!id) return errorResponse('id verplicht')

  const { data: target, error: targetError } = await auth.service!
    .from('staff')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (targetError) throw new Error(targetError.message)
  if (!target) return errorResponse('Medewerker niet gevonden', 404)

  if (target.auth_user_id === auth.user!.id) {
    return errorResponse('Je kunt jezelf niet verwijderen')
  }

  if (target.auth_user_id) {
    const { error: deleteAuthError } = await auth.service!.auth.admin.deleteUser(
      target.auth_user_id,
    )
    if (deleteAuthError) {
      console.error('[staff-auth] deleteUser', deleteAuthError.message)
    }
  }

  const { error } = await auth.service!.from('staff').delete().eq('id', id)
  if (error) throw new Error(error.message)

  return jsonResponse({ ok: true })
}

async function handleMe(req: Request) {
  const auth = await requireUser(req)
  if ('error' in auth && auth.error) return auth.error

  const { data, error } = await auth.service!
    .from('staff')
    .select(STAFF_SELECT)
    .eq('auth_user_id', auth.user!.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return errorResponse('Geen staff-profiel gevonden', 404)

  return jsonResponse({ data: mapStaff(data as StaffRow) })
}
