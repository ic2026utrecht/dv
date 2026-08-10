import type { Department, HelpOption, IncidentType, Location, SelectOption } from '~/types/models'

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

export function filterIncidentTypes(
  types: IncidentType[],
  department: Department | null,
): IncidentType[] {
  if (!department) return []
  return types.filter((t) => t.department === department)
}

export function filterHelpOptions(
  options: HelpOption[],
  department: Department | null,
): HelpOption[] {
  if (!department) return []
  return options.filter((o) => o.departments.includes(department))
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
