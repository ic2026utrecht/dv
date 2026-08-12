/** Normalize NL-friendly phone input to E.164 (+316…) */
export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`
  }
  const only = digits.replace(/\D/g, '')
  if (only.startsWith('0') && only.length === 10) {
    return `+31${only.slice(1)}`
  }
  if (only.startsWith('31') && only.length >= 11) {
    return `+${only}`
  }
  if (only.length >= 9) {
    return `+${only}`
  }
  return only ? `+${only}` : ''
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone)
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}
