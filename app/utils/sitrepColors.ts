import type { Incident, Priority } from '~/types/models'

export type SitrepSeverity = 'critical' | 'warning' | 'ok' | 'closed'

const PRIORITY_SEVERITY: Record<Priority, SitrepSeverity> = {
  Critical: 'critical',
  Hoog: 'critical',
  Middel: 'warning',
  Laag: 'ok',
}

export function getIncidentSeverity(incident: Incident): SitrepSeverity {
  if (!incident.isOpen) {
    return 'closed'
  }
  return PRIORITY_SEVERITY[incident.priority] ?? 'ok'
}

export function severityLabel(severity: SitrepSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Urgent'
    case 'warning':
      return 'Aandacht'
    case 'ok':
      return 'Laag'
    case 'closed':
      return 'Afgesloten'
  }
}

export function severityDotClass(severity: SitrepSeverity): string {
  return `ic-sitrep-dot ic-sitrep-dot--${severity}`
}

export function severityRowClass(severity: SitrepSeverity): string {
  return `ic-sitrep-row ic-sitrep-row--${severity}`
}

export function severityRowBtnClass(severity: SitrepSeverity): string {
  return `ic-sitrep-row-btn ic-sitrep-row-btn--${severity}`
}

export function severityMarkerClass(severity: SitrepSeverity): string {
  return `ic-sitrep-marker ic-sitrep-marker--${severity}`
}
