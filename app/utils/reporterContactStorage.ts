const STORAGE_KEY = 'ic2026-reporter-contact'

export interface ReporterContact {
  name: string
  phone: string
}

export function loadReporterContact(): ReporterContact {
  if (import.meta.server) {
    return { name: '', phone: '' }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { name: '', phone: '' }
    }

    const parsed = JSON.parse(raw) as Partial<ReporterContact>
    return {
      name: String(parsed.name ?? '').trim(),
      phone: String(parsed.phone ?? '').trim(),
    }
  }
  catch {
    return { name: '', phone: '' }
  }
}

export function saveReporterContact(contact: ReporterContact): void {
  if (import.meta.server) {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: contact.name.trim(),
      phone: contact.phone.trim(),
    }))
  }
  catch {
    // Private mode or quota — ignore
  }
}

/** Sheet stores one melder column: "Naam · 06…" */
export function formatReporter(name: string, phone: string): string {
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()

  if (trimmedName && trimmedPhone) {
    return `${trimmedName} · ${trimmedPhone}`
  }

  return trimmedName || trimmedPhone
}
