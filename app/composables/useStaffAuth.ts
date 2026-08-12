import type { Staff } from '~/types/models'
import { formatStaffName } from '~/utils/staffName'
import { isValidE164, isValidPin, normalizePhone } from '~/utils/phone'

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
    if (!isValidPin(pin)) throw new Error('PIN moet 4–6 cijfers zijn')
    const result = await callStaffAuth({ action: 'login', phone, pin })
    await applySession(result.session)
    if (result.staff) staff.value = result.staff
    return result.staff
  }

  async function changePin(currentPin: string, newPin: string) {
    if (!isValidPin(currentPin) || !isValidPin(newPin)) {
      throw new Error('PIN moet 4–6 cijfers zijn')
    }
    const result = await callStaffAuth(
      { action: 'change-pin', currentPin, newPin },
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
  }) {
    if (!isValidPin(payload.pin)) throw new Error('PIN moet 4–6 cijfers zijn')
    const result = await callStaffAuth({
      action: 'add-staff',
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: normalizePhone(payload.phone),
      pin: payload.pin,
      isAdmin: Boolean(payload.isAdmin),
    }, true)
    return result.data as Staff
  }

  async function updateStaff(payload: {
    id: string
    firstName: string
    lastName: string
    pin?: string
    isAdmin?: boolean
  }) {
    const result = await callStaffAuth({
      action: 'update-staff',
      id: payload.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      pin: payload.pin,
      isAdmin: payload.isAdmin,
    }, true)
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
