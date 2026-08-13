import type { Department, Incident, Priority } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'

export type SitrepStatusValue = 'open' | 'Open' | 'In behandeling' | 'Afgesloten'
export type SitrepSortKey = 'priority' | 'newest' | 'oldest' | 'age'
export type SitrepView = 'map' | 'table' | 'timeline' | 'analytics'

export interface SitrepListFilters {
  department: Department[]
  priority: Priority[]
  status: SitrepStatusValue[]
  location: string[]
  sort: SitrepSortKey
}

export const DEFAULT_SITREP_LIST_FILTERS: SitrepListFilters = {
  department: [],
  priority: [],
  status: ['open'],
  location: [],
  sort: 'priority',
}

const STATUS_VALUES: SitrepStatusValue[] = ['open', 'Open', 'In behandeling', 'Afgesloten']
const SORT_KEYS: SitrepSortKey[] = ['priority', 'newest', 'oldest', 'age']

function queryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value ?? undefined
}

function queryValues(value: string | string[] | null | undefined): string[] {
  if (!value) {
    return []
  }
  const raw = Array.isArray(value) ? value : [value]
  return raw.flatMap(item => item.split(',')).map(item => item.trim()).filter(Boolean)
}

function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as readonly string[]).includes(value)
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

function isStatusValue(value: string): value is SitrepStatusValue {
  return (STATUS_VALUES as readonly string[]).includes(value)
}

function parseDepartmentFilter(query: Record<string, string | string[] | null | undefined>): Department[] {
  const values = queryValues(query.dept)
  if (values.length === 0 || values.includes('all')) {
    return DEFAULT_SITREP_LIST_FILTERS.department
  }
  return values.filter(isDepartment)
}

function parsePriorityFilter(query: Record<string, string | string[] | null | undefined>): Priority[] {
  const values = queryValues(query.priority)
  if (values.length === 0 || values.includes('all')) {
    return DEFAULT_SITREP_LIST_FILTERS.priority
  }
  return values.filter(isPriority)
}

function parseStatusFilter(query: Record<string, string | string[] | null | undefined>): SitrepStatusValue[] {
  const values = queryValues(query.status)
  if (values.length === 0) {
    return DEFAULT_SITREP_LIST_FILTERS.status
  }
  if (values.includes('all')) {
    return []
  }
  return values.filter(isStatusValue)
}

function parseLocationFilter(query: Record<string, string | string[] | null | undefined>): string[] {
  const values = queryValues(query.location)
  if (values.length === 0 || values.includes('all')) {
    return DEFAULT_SITREP_LIST_FILTERS.location
  }
  return values
}

function isSortKey(value: string): value is SitrepSortKey {
  return (SORT_KEYS as readonly string[]).includes(value)
}

export function parseSitrepFiltersFromQuery(
  query: Record<string, string | string[] | null | undefined>,
): SitrepListFilters {
  const sort = queryValue(query.sort)

  return {
    department: parseDepartmentFilter(query),
    priority: parsePriorityFilter(query),
    status: parseStatusFilter(query),
    location: parseLocationFilter(query),
    sort: sort && isSortKey(sort) ? sort : DEFAULT_SITREP_LIST_FILTERS.sort,
  }
}

export function parseSitrepViewFromQuery(
  query: Record<string, string | string[] | null | undefined>,
): SitrepView {
  const value = queryValue(query.view)
  if (value === 'table') {
    return 'table'
  }
  if (value === 'timeline') {
    return 'timeline'
  }
  if (value === 'analytics') {
    return 'analytics'
  }
  return 'map'
}

export function buildSitrepQuery(
  filters: SitrepListFilters,
  view: SitrepView,
): Record<string, string> {
  const query: Record<string, string> = {}

  if (filters.department.length > 0) {
    query.dept = filters.department.join(',')
  }
  if (filters.priority.length > 0) {
    query.priority = filters.priority.join(',')
  }
  if (filters.location.length > 0) {
    query.location = filters.location.join(',')
  }
  if (!arraysEqual(filters.status, DEFAULT_SITREP_LIST_FILTERS.status)) {
    query.status = filters.status.length > 0 ? filters.status.join(',') : 'all'
  }
  if (filters.sort !== DEFAULT_SITREP_LIST_FILTERS.sort) {
    query.sort = filters.sort
  }
  if (view !== 'map') {
    query.view = view
  }

  return query
}

export function stripSitrepQueryKeys(
  query: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...query }
  delete next.dept
  delete next.priority
  delete next.status
  delete next.location
  delete next.sort
  delete next.view
  return next
}

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 1,
  Hoog: 2,
  Middel: 3,
  Laag: 4,
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function matchesDepartment(incident: Incident, filters: Department[]): boolean {
  return filters.length === 0 || filters.includes(incident.department)
}

function matchesPriority(incident: Incident, filters: Priority[]): boolean {
  return filters.length === 0 || filters.includes(incident.priority)
}

function matchesStatus(incident: Incident, filters: SitrepStatusValue[]): boolean {
  if (filters.length === 0) {
    return true
  }
  return filters.some((filter) => {
    if (filter === 'open') {
      return incident.isOpen
    }
    return incident.status === filter
  })
}

function matchesLocation(
  incident: Incident,
  locationIds: string[],
  locationNamesById: Record<string, string> = {},
): boolean {
  if (locationIds.length === 0) {
    return true
  }
  if (incident.locationId && locationIds.includes(incident.locationId)) {
    return true
  }
  const selectedNames = locationIds
    .map(id => locationNamesById[id])
    .filter(Boolean)
  return selectedNames.includes(incident.locationName)
}

function compareIncidents(a: Incident, b: Incident, sort: SitrepSortKey): number {
  switch (sort) {
    case 'newest':
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    case 'oldest':
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    case 'age':
      return b.ageMinutes - a.ageMinutes
    case 'priority':
    default: {
      const rankDiff = (a.priorityRank || PRIORITY_ORDER[a.priority]) - (b.priorityRank || PRIORITY_ORDER[b.priority])
      if (rankDiff !== 0) {
        return rankDiff
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
  }
}

export function filterAndSortIncidents(
  incidents: Incident[],
  filters: SitrepListFilters,
  locationNamesById: Record<string, string> = {},
): Incident[] {
  return incidents
    .filter(incident =>
      matchesDepartment(incident, filters.department)
      && matchesPriority(incident, filters.priority)
      && matchesStatus(incident, filters.status)
      && matchesLocation(incident, filters.location, locationNamesById),
    )
    .sort((a, b) => compareIncidents(a, b, filters.sort))
}
