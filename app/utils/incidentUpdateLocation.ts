import type { IncidentUpdateEntry, Location } from '~/types/models'
import { formatSector } from '~/utils/incidentOptions'

export interface IncidentLocationSnapshot {
  locationId: string
  sectorRow: string
  sectorColumn: number | null
  sectorLabel: string
}

export interface LocationChange {
  from: string
  to: string
}

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function asSectorColumn(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

export function emptyLocationSnapshot(): IncidentLocationSnapshot {
  return {
    locationId: '',
    sectorRow: '',
    sectorColumn: null,
    sectorLabel: '',
  }
}

export function mergeLocationSnapshot(
  prev: IncidentLocationSnapshot,
  payload: Record<string, unknown> | null | undefined,
): IncidentLocationSnapshot {
  if (!payload) {
    return { ...prev }
  }

  const next = { ...prev }

  if ('locationId' in payload) {
    next.locationId = asString(payload.locationId)
  }
  if ('sectorRow' in payload) {
    next.sectorRow = asString(payload.sectorRow)
  }
  if ('sectorColumn' in payload) {
    next.sectorColumn = asSectorColumn(payload.sectorColumn)
  }
  if ('sectorLabel' in payload) {
    next.sectorLabel = asString(payload.sectorLabel)
  }

  return next
}

export function snapshotsEqual(
  a: IncidentLocationSnapshot,
  b: IncidentLocationSnapshot,
): boolean {
  return (
    a.locationId === b.locationId
    && a.sectorRow === b.sectorRow
    && a.sectorColumn === b.sectorColumn
    && a.sectorLabel === b.sectorLabel
  )
}

function sectorDisplay(snapshot: IncidentLocationSnapshot): string {
  if (snapshot.sectorRow && snapshot.sectorColumn != null) {
    return formatSector(snapshot.sectorRow, snapshot.sectorColumn)
  }
  return snapshot.sectorLabel.trim()
}

export function formatLocationLabel(
  snapshot: IncidentLocationSnapshot,
  locations: Location[],
): string {
  const locationName = locations.find(location => location.id === snapshot.locationId)?.name
    ?? snapshot.locationId
  const sector = sectorDisplay(snapshot)

  if (locationName && sector) {
    return `${locationName} · ${sector}`
  }
  if (locationName) {
    return locationName
  }
  if (sector) {
    return sector
  }
  return 'Onbekend'
}

function foldSnapshotAt(
  entries: IncidentUpdateEntry[],
  index: number,
): IncidentLocationSnapshot {
  let snapshot = emptyLocationSnapshot()
  for (let i = 0; i <= index; i++) {
    snapshot = mergeLocationSnapshot(snapshot, entries[i]?.payload)
  }
  return snapshot
}

export function getLocationChangeForEntry(
  entries: IncidentUpdateEntry[],
  index: number,
  locations: Location[],
): LocationChange | null {
  if (index <= 0 || index >= entries.length) {
    return null
  }

  const previous = foldSnapshotAt(entries, index - 1)
  const current = foldSnapshotAt(entries, index)

  if (snapshotsEqual(previous, current)) {
    return null
  }

  return {
    from: formatLocationLabel(previous, locations),
    to: formatLocationLabel(current, locations),
  }
}
