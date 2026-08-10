import type { Department, Incident, Priority } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'

export type SitrepDepartmentFilter = 'all' | Department
export type SitrepPriorityFilter = 'all' | Priority
export type SitrepStatusFilter = 'open' | 'all' | 'Open' | 'In behandeling' | 'Afgesloten'
export type SitrepSortKey = 'priority' | 'newest' | 'oldest' | 'age'
export type SitrepView = 'map' | 'timeline'

export interface SitrepListFilters {
  department: SitrepDepartmentFilter
  priority: SitrepPriorityFilter
  status: SitrepStatusFilter
  sort: SitrepSortKey
}

export const DEFAULT_SITREP_LIST_FILTERS: SitrepListFilters = {
  department: 'all',
  priority: 'all',
  status: 'open',
  sort: 'priority',
}

const STATUS_FILTERS: SitrepStatusFilter[] = ['open', 'all', 'Open', 'In behandeling', 'Afgesloten']
const SORT_KEYS: SitrepSortKey[] = ['priority', 'newest', 'oldest', 'age']

function queryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value ?? undefined
}

function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as readonly string[]).includes(value)
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

function isStatusFilter(value: string): value is SitrepStatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value)
}

function isSortKey(value: string): value is SitrepSortKey {
  return (SORT_KEYS as readonly string[]).includes(value)
}

export function parseSitrepFiltersFromQuery(
  query: Record<string, string | string[] | null | undefined>,
): SitrepListFilters {
  const dept = queryValue(query.dept)
  const priority = queryValue(query.priority)
  const status = queryValue(query.status)
  const sort = queryValue(query.sort)

  return {
    department: dept && isDepartment(dept) ? dept : DEFAULT_SITREP_LIST_FILTERS.department,
    priority: priority && isPriority(priority) ? priority : DEFAULT_SITREP_LIST_FILTERS.priority,
    status: status && isStatusFilter(status) ? status : DEFAULT_SITREP_LIST_FILTERS.status,
    sort: sort && isSortKey(sort) ? sort : DEFAULT_SITREP_LIST_FILTERS.sort,
  }
}

export function parseSitrepViewFromQuery(
  query: Record<string, string | string[] | null | undefined>,
): SitrepView {
  return queryValue(query.view) === 'timeline' ? 'timeline' : 'map'
}

export function buildSitrepQuery(
  filters: SitrepListFilters,
  view: SitrepView,
): Record<string, string> {
  const query: Record<string, string> = {}

  if (filters.department !== DEFAULT_SITREP_LIST_FILTERS.department) {
    query.dept = filters.department
  }
  if (filters.priority !== DEFAULT_SITREP_LIST_FILTERS.priority) {
    query.priority = filters.priority
  }
  if (filters.status !== DEFAULT_SITREP_LIST_FILTERS.status) {
    query.status = filters.status
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

function matchesDepartment(incident: Incident, filter: SitrepDepartmentFilter): boolean {
  return filter === 'all' || incident.department === filter
}

function matchesPriority(incident: Incident, filter: SitrepPriorityFilter): boolean {
  return filter === 'all' || incident.priority === filter
}

function matchesStatus(incident: Incident, filter: SitrepStatusFilter): boolean {
  if (filter === 'all') {
    return true
  }
  if (filter === 'open') {
    return incident.isOpen
  }
  return incident.status === filter
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
): Incident[] {
  return incidents
    .filter(incident =>
      matchesDepartment(incident, filters.department)
      && matchesPriority(incident, filters.priority)
      && matchesStatus(incident, filters.status),
    )
    .sort((a, b) => compareIncidents(a, b, filters.sort))
}
