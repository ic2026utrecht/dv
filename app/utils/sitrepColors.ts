import type { Incident, Priority } from '~/types/models'

export type SitrepSeverity = 'critical' | 'high' | 'warning' | 'ok' | 'closed'

const PRIORITY_SEVERITY: Record<Priority, SitrepSeverity> = {
  Critical: 'critical',
  Hoog: 'high',
  Middel: 'warning',
  Laag: 'ok',
}

export function getIncidentSeverity(incident: Incident): SitrepSeverity {
  if (!incident.isOpen) {
    return 'closed'
  }
  return PRIORITY_SEVERITY[incident.priority] ?? 'ok'
}

const SEVERITY_RANK: Record<SitrepSeverity, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  ok: 3,
  closed: 4,
}

export function getHighestSeverity(severities: SitrepSeverity[]): SitrepSeverity {
  if (severities.length === 0) {
    return 'ok'
  }
  return severities.reduce((highest, current) =>
    SEVERITY_RANK[current] < SEVERITY_RANK[highest] ? current : highest,
  )
}

export function severityLabel(severity: SitrepSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Critical'
    case 'high':
      return 'Hoog'
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
