import type { SitrepSeverity } from '~/utils/sitrepColors'

export type SitrepMapLegendSeverity = 'critical' | 'high' | 'warning' | 'ok'

export interface SitrepMapLegendSeverityMeta {
  id: SitrepMapLegendSeverity
  label: string
}

export const SITREP_MAP_LEGEND_SEVERITIES: SitrepMapLegendSeverityMeta[] = [
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'Hoog' },
  { id: 'warning', label: 'Middel' },
  { id: 'ok', label: 'Laag' },
]

export interface SitrepMapPrefs {
  severityVisible: Record<SitrepMapLegendSeverity, boolean>
}

const STORAGE_KEY = 'ic2026-sitrep-map-prefs'

function defaultSeverityVisibility(): Record<SitrepMapLegendSeverity, boolean> {
  return {
    critical: true,
    high: true,
    warning: true,
    ok: true,
  }
}

export function defaultSitrepMapPrefs(): SitrepMapPrefs {
  return {
    severityVisible: defaultSeverityVisibility(),
  }
}

function isLegendSeverity(value: string): value is SitrepMapLegendSeverity {
  return SITREP_MAP_LEGEND_SEVERITIES.some(item => item.id === value)
}

function parseStoredPrefs(raw: string | null): SitrepMapPrefs | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SitrepMapPrefs>
    const defaults = defaultSitrepMapPrefs()
    const severityVisible = { ...defaults.severityVisible }

    if (parsed.severityVisible && typeof parsed.severityVisible === 'object') {
      for (const [key, value] of Object.entries(parsed.severityVisible)) {
        if (isLegendSeverity(key) && typeof value === 'boolean') {
          severityVisible[key] = value
        }
      }
    }

    return { severityVisible }
  }
  catch {
    return null
  }
}

export function useSitrepMapPrefs() {
  const prefs = useState<SitrepMapPrefs>('sitrep-map-prefs', defaultSitrepMapPrefs)

  onMounted(() => {
    if (!import.meta.client) {
      return
    }

    const stored = parseStoredPrefs(localStorage.getItem(STORAGE_KEY))
    if (stored) {
      prefs.value = stored
    }
  })

  watch(
    prefs,
    (value) => {
      if (!import.meta.client) {
        return
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    },
    { deep: true },
  )

  function isSeverityVisible(severity: SitrepSeverity): boolean {
    if (severity === 'closed') {
      return true
    }
    return prefs.value.severityVisible[severity] ?? true
  }

  function setSeverityVisible(severity: SitrepMapLegendSeverity, visible: boolean) {
    prefs.value = {
      ...prefs.value,
      severityVisible: {
        ...prefs.value.severityVisible,
        [severity]: visible,
      },
    }
  }

  function showAllSeverities() {
    prefs.value = {
      ...prefs.value,
      severityVisible: defaultSeverityVisibility(),
    }
  }

  return {
    prefs,
    isSeverityVisible,
    setSeverityVisible,
    showAllSeverities,
  }
}
