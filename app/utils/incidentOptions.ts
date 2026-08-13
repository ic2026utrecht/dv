import type { Department, IncidentType, Location, SectorRange, SelectOption } from '~/types/models'

export const RASTER_ROWS = 'ABCDEFGHIJKLM'.split('')
export const RASTER_COLUMNS = Array.from({ length: 22 }, (_, i) => i + 1)

export function formatSector(row: string, column: number): string {
  return `${row}${column}`
}

export interface ParsedSector {
  row: string
  column: number
  code: string
}

export function buildSectorOptions(
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): SelectOption[] {
  const options: SelectOption[] = []

  for (const row of rows) {
    for (const column of columns) {
      const code = formatSector(row, column)
      options.push({ value: code, label: code })
    }
  }

  return options
}

export function parseSectorCode(
  input: string | null | undefined,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): ParsedSector | null {
  if (!input) {
    return null
  }

  const normalized = String(input).trim().toUpperCase()
  const match = normalized.match(/^([A-M])(\d{1,2})$/)

  if (!match?.[1] || !match[2]) {
    return null
  }

  const row = match[1]
  const column = Number(match[2])

  if (!rows.includes(row) || !columns.includes(column)) {
    return null
  }

  return {
    row,
    column,
    code: formatSector(row, column),
  }
}

/** Expand one rectangle; corners may be given in any order. */
export function expandSectorRange(
  from: string,
  to: string,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): string[] {
  const a = parseSectorCode(from, rows, columns)
  const b = parseSectorCode(to, rows, columns)
  if (!a || !b) {
    return []
  }

  const rowA = rows.indexOf(a.row)
  const rowB = rows.indexOf(b.row)
  const colA = columns.indexOf(a.column)
  const colB = columns.indexOf(b.column)
  if (rowA < 0 || rowB < 0 || colA < 0 || colB < 0) {
    return []
  }

  const rowStart = Math.min(rowA, rowB)
  const rowEnd = Math.max(rowA, rowB)
  const colStart = Math.min(colA, colB)
  const colEnd = Math.max(colA, colB)

  const codes: string[] = []
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      codes.push(formatSector(rows[r]!, columns[c]!))
    }
  }
  return codes
}

function sortSectorCodes(
  codes: string[],
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): string[] {
  return [...codes].sort((left, right) => {
    const a = parseSectorCode(left, rows, columns)
    const b = parseSectorCode(right, rows, columns)
    if (!a || !b) {
      return left.localeCompare(right)
    }
    const rowDiff = rows.indexOf(a.row) - rows.indexOf(b.row)
    if (rowDiff !== 0) {
      return rowDiff
    }
    return columns.indexOf(a.column) - columns.indexOf(b.column)
  })
}

/**
 * Union of all ranges on a location.
 * Returns null when unrestricted (empty/missing ranges).
 */
export function expandLocationSectors(
  location: Location | undefined,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): string[] | null {
  const ranges = location?.sectorRanges ?? []
  if (!ranges.length) {
    return null
  }

  const set = new Set<string>()
  for (const range of ranges) {
    for (const code of expandSectorRange(range.from, range.to, rows, columns)) {
      set.add(code)
    }
  }

  if (!set.size) {
    return null
  }

  return sortSectorCodes([...set], rows, columns)
}

/** Dropdown options for a location (expanded + sorted). Empty ranges → full grid. */
export function sectorOptionsForLocation(
  location: Location | undefined,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
): SelectOption[] {
  const allowed = expandLocationSectors(location, rows, columns)
  if (!allowed) {
    return buildSectorOptions(rows, columns)
  }
  return allowed.map(code => ({ value: code, label: code }))
}

/** Normalize and validate sector ranges for persistence; throws on invalid corners. */
export function normalizeSectorRanges(ranges: SectorRange[]): SectorRange[] {
  const normalized: SectorRange[] = []

  for (const range of ranges) {
    const from = String(range.from ?? '').trim().toUpperCase()
    const to = String(range.to ?? '').trim().toUpperCase()
    if (!from && !to) {
      continue
    }
    if (!parseSectorCode(from) || !parseSectorCode(to)) {
      throw new Error(`Ongeldig sectorbereik: ${from || '?'}–${to || '?'}`)
    }
    normalized.push({ from, to })
  }

  return normalized
}

export function parseSectorRangesJson(value: unknown): SectorRange[] {
  if (!Array.isArray(value)) {
    return []
  }

  const ranges: SectorRange[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    const from = typeof row.from === 'string' ? row.from.trim().toUpperCase() : ''
    const to = typeof row.to === 'string' ? row.to.trim().toUpperCase() : ''
    if (!from || !to) {
      continue
    }
    ranges.push({ from, to })
  }
  return ranges
}

export function filterIncidentTypes(
  types: IncidentType[],
  department: Department | null,
): IncidentType[] {
  if (!department) return []
  return types.filter((t) => t.department === department)
}

export function toSelectOptions(items: { id: string, name: string }[]): SelectOption[] {
  return items.map((item) => ({ value: item.id, label: item.name }))
}

export function locationOptions(locations: Location[]): SelectOption[] {
  return locations
    .filter((l) => l.active)
    .map((l) => ({ value: l.id, label: l.name }))
}

export function rowOptions(rows: string[]): SelectOption[] {
  return rows.map((row) => ({ value: row, label: row }))
}

export function columnOptions(columns: number[]): SelectOption[] {
  return columns.map((col) => ({ value: String(col), label: String(col) }))
}

export function findLocationName(locations: Location[], id: string): string {
  return locations.find((l) => l.id === id)?.name ?? id
}

export function findIncidentTypeName(types: IncidentType[], id: string): string {
  return types.find((t) => t.id === id)?.name ?? id
}
