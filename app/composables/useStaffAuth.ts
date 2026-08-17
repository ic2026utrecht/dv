import type { Staff } from '~/types/models'
import { formatStaffName } from '~/utils/staffName'
import { isValidE164, isValidExistingPin, isValidPin, normalizePhone, normalizePin } from '~/utils/phone'

interface StaffAuthResponse {
  ok?: boolean
  firstName?: string
  lastName?: string
  session?: {
    access_token: string
    refresh_token: string
    expires_in?: number
    expires_at?: number
    token_type?: string
    user?: unknown
  }
  staff?: Staff
  data?: Staff | Staff[]
  error?: string
}

export function useStaffAuth() {
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const staff = useState<Staff | null>('staff-profile', () => null)
  const loading = useState('staff-loading', () => false)
  const error = useState<string | null>('staff-error', () => null)

  const isLoggedIn = computed(() => Boolean(user.value))
  const isAdmin = computed(() => Boolean(staff.value?.isAdmin))
  const displayName = computed(() => formatStaffName(staff.value))

  function functionsUrl(): string {
    const base = (config.public.supabaseUrl as string || '').replace(/\/$/, '')
    return `${base}/functions/v1/staff-auth`
  }

  async function callStaffAuth(
    body: Record<string, unknown>,
    withAuth = false,
  ): Promise<StaffAuthResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: config.public.supabaseAnonKey as string,
    }

    if (withAuth) {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        throw new Error('Niet ingelogd')
      }
      headers.Authorization = `Bearer ${token}`
    }
    else {
      headers.Authorization = `Bearer ${config.public.supabaseAnonKey}`
    }

    const res = await fetch(functionsUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const json = await res.json().catch(() => ({})) as StaffAuthResponse
    if (!res.ok) {
      throw new Error(json.error || `Request mislukt (${res.status})`)
    }
    if (json.error) {
      throw new Error(json.error)
    }
    return json
  }

  async function applySession(session: StaffAuthResponse['session']) {
    if (!session?.access_token || !session.refresh_token) {
      throw new Error('Geen sessie ontvangen')
    }
    const { error: setError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (setError) throw new Error(setError.message)
  }

  async function checkPhone(phoneInput: string) {
    const phone = normalizePhone(phoneInput)
    if (!isValidE164(phone)) {
      throw new Error('Voer een geldig telefoonnummer in (bijv. 06… of +31…)')
    }
    const result = await callStaffAuth({ action: 'check', phone })
    return {
      phone,
      firstName: result.firstName ?? '',
      lastName: result.lastName ?? '',
    }
  }

  async function login(phoneInput: string, pin: string) {
    const phone = normalizePhone(phoneInput)
    const normalizedPin = normalizePin(pin)
    if (!isValidExistingPin(normalizedPin)) throw new Error('PIN moet 4 of 6 cijfers zijn')
    const result = await callStaffAuth({ action: 'login', phone, pin: normalizedPin })
    await applySession(result.session)
    if (result.staff) staff.value = result.staff
    return result.staff
  }

  async function changePin(currentPin: string, newPin: string) {
    const current = normalizePin(currentPin)
    const next = normalizePin(newPin)
    if (!isValidExistingPin(current)) {
      throw new Error('Huidige PIN moet 4–6 cijfers zijn')
    }
    if (!isValidPin(next)) {
      throw new Error('Nieuwe PIN moet 6 cijfers zijn')
    }
    const result = await callStaffAuth(
      { action: 'change-pin', currentPin: current, newPin: next },
      true,
    )
    await applySession(result.session)
  }

  async function fetchMe(force = false) {
    if (!user.value) {
      staff.value = null
      return null
    }
    if (staff.value && !force) return staff.value
    loading.value = true
    error.value = null
    try {
      const result = await callStaffAuth({ action: 'me' }, true)
      staff.value = (result.data as Staff) ?? null
      return staff.value
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Profiel laden mislukt'
      staff.value = null
      return null
    }
    finally {
      loading.value = false
    }
  }

  async function listStaff() {
    const result = await callStaffAuth({ action: 'list-staff' }, true)
    return (result.data as Staff[]) ?? []
  }

  async function addStaff(payload: {
    firstName: string
    lastName: string
    phone: string
    pin: string
    isAdmin?: boolean
    active?: boolean
  }) {
    if (!isValidPin(normalizePin(payload.pin))) throw new Error('PIN moet 6 cijfers zijn')
    const result = await callStaffAuth({
      action: 'add-staff',
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: normalizePhone(payload.phone),
      pin: normalizePin(payload.pin),
      isAdmin: Boolean(payload.isAdmin),
      active: payload.active !== false,
    }, true)
    return result.data as Staff
  }

  async function updateStaff(payload: {
    id: string
    firstName: string
    lastName: string
    phone?: string
    pin?: string
    isAdmin?: boolean
    active?: boolean
  }) {
    const body: Record<string, unknown> = {
      action: 'update-staff',
      id: payload.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      pin: payload.pin,
      isAdmin: payload.isAdmin,
    }
    if (payload.phone !== undefined) {
      body.phone = normalizePhone(payload.phone)
    }
    if (payload.active !== undefined) {
      body.active = payload.active
    }
    const result = await callStaffAuth(body, true)
    const updated = result.data as Staff
    if (staff.value?.id === updated.id) {
      staff.value = updated
    }
    return updated
  }

  async function removeStaff(id: string) {
    await callStaffAuth({ action: 'remove-staff', id }, true)
  }

  async function logout() {
    await supabase.auth.signOut()
    staff.value = null
  }

  return {
    staff,
    loading,
    error,
    isLoggedIn,
    isAdmin,
    displayName,
    user,
    checkPhone,
    login,
    changePin,
    fetchMe,
    listStaff,
    addStaff,
    updateStaff,
    removeStaff,
    logout,
  }
}
