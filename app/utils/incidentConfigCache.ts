import type { IncidentConfig } from '~/types/models'

/** Bump when reference data shape/content changes so clients refetch config. */
export const INCIDENT_CONFIG_API_VERSION = 5

const STORAGE_KEY = 'ic2026-incident-config-v2'
const LEGACY_STORAGE_KEY = 'ic2026-incident-config'
export const INCIDENT_CONFIG_CACHE_TTL_MS = 60 * 60 * 1000

interface CachedIncidentConfig {
  savedAt: number
  config: IncidentConfig
}

function isIncidentConfig(value: unknown): value is IncidentConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const config = value as IncidentConfig
  return (
    Array.isArray(config.locations)
    && Array.isArray(config.incidentTypes)
    && Array.isArray(config.helpOptions)
    && config.apiVersion === INCIDENT_CONFIG_API_VERSION
  )
}

export function readIncidentConfigCache(): IncidentConfig | null {
  if (!import.meta.client) {
    return null
  }

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<CachedIncidentConfig>
    if (
      typeof parsed.savedAt !== 'number'
      || Date.now() - parsed.savedAt > INCIDENT_CONFIG_CACHE_TTL_MS
      || !isIncidentConfig(parsed.config)
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return parsed.config
  }
  catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function writeIncidentConfigCache(config: IncidentConfig) {
  if (!import.meta.client) {
    return
  }

  const payload: CachedIncidentConfig = {
    savedAt: Date.now(),
    config,
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // Quota exceeded or private browsing — ignore
  }
}

export function clearIncidentConfigCache() {
  if (!import.meta.client) {
    return
  }

  localStorage.removeItem(STORAGE_KEY)
}
