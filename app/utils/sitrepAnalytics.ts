import type { Department, Incident, Priority } from '~/types/models'
import { DEPARTMENTS, PRIORITIES } from '~/constants/incident'

export type SitrepAnalyticsBucket = '30m' | '1h' | '1d'

export interface SitrepTimeBucket {
  key: string
  start: Date
  end: Date
  label: string
}

export interface SitrepAnalyticsSnapshot {
  totalOpen: number
  criticalOpen: number
  inProgress: number
  newInPeriod: number
  byPriority: Record<Priority, number>
  byDepartment: Record<Department, number>
  byStatus: Record<string, number>
  byType: { label: string, count: number }[]
}

export interface SitrepTimelineSeries {
  labels: string[]
  totals: number[]
  byPriority: Record<Priority, number[]>
  byDepartment: Record<Department, number[]>
}

const BUCKET_MS: Record<SitrepAnalyticsBucket, number> = {
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
}

const LOOKBACK_MS: Record<SitrepAnalyticsBucket, number> = {
  '30m': 12 * 60 * 60 * 1000,
  '1h': 24 * 60 * 60 * 1000,
  '1d': 14 * 24 * 60 * 60 * 1000,
}

export function getBucketLabel(bucket: SitrepAnalyticsBucket): string {
  switch (bucket) {
    case '30m':
      return '30 minuten'
    case '1h':
      return '1 uur'
    case '1d':
      return '1 dag'
  }
}

export function getLookbackLabel(bucket: SitrepAnalyticsBucket): string {
  switch (bucket) {
    case '30m':
      return 'laatste 12 uur'
    case '1h':
      return 'laatste 24 uur'
    case '1d':
      return 'laatste 14 dagen'
  }
}

function emptyPriorityCounts(): Record<Priority, number> {
  return {
    Critical: 0,
    Hoog: 0,
    Middel: 0,
    Laag: 0,
  }
}

function emptyDepartmentCounts(): Record<Department, number> {
  return {
    Parkeer: 0,
    Dienstverlening: 0,
    EHBO: 0,
  }
}

function floorToBucket(date: Date, bucketMs: number): Date {
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs)
}

function formatBucketLabel(date: Date, bucket: SitrepAnalyticsBucket): string {
  if (bucket === '1d') {
    return date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function buildTimeBuckets(
  bucket: SitrepAnalyticsBucket,
  now = new Date(),
): SitrepTimeBucket[] {
  const bucketMs = BUCKET_MS[bucket]
  const lookbackMs = LOOKBACK_MS[bucket]
  const end = floorToBucket(now, bucketMs)
  const startBoundary = new Date(end.getTime() - lookbackMs)
  const buckets: SitrepTimeBucket[] = []

  for (let cursor = new Date(startBoundary.getTime()); cursor <= end; cursor = new Date(cursor.getTime() + bucketMs)) {
    const bucketStart = floorToBucket(cursor, bucketMs)
    const bucketEnd = new Date(bucketStart.getTime() + bucketMs)
    buckets.push({
      key: bucketStart.toISOString(),
      start: bucketStart,
      end: bucketEnd,
      label: formatBucketLabel(bucketStart, bucket),
    })
  }

  return buckets
}

function incidentTimestamp(incident: Incident): number {
  const value = new Date(incident.timestamp).getTime()
  return Number.isNaN(value) ? 0 : value
}

function isInBucket(incident: Incident, bucket: SitrepTimeBucket): boolean {
  const ts = incidentTimestamp(incident)
  return ts >= bucket.start.getTime() && ts < bucket.end.getTime()
}

export function buildAnalyticsSnapshot(incidents: Incident[]): SitrepAnalyticsSnapshot {
  const openIncidents = incidents.filter(i => i.isOpen)
  const byPriority = emptyPriorityCounts()
  const byDepartment = emptyDepartmentCounts()
  const byStatus: Record<string, number> = {}
  const typeCounts = new Map<string, number>()

  for (const incident of openIncidents) {
    byPriority[incident.priority] = (byPriority[incident.priority] ?? 0) + 1
    byDepartment[incident.department] = (byDepartment[incident.department] ?? 0) + 1

    const status = incident.status || 'Open'
    byStatus[status] = (byStatus[status] ?? 0) + 1

    const typeName = incident.incidentTypeName || 'Onbekend'
    typeCounts.set(typeName, (typeCounts.get(typeName) ?? 0) + 1)
  }

  const byType = [...typeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    totalOpen: openIncidents.length,
    criticalOpen: openIncidents.filter(i => i.priority === 'Critical' || i.priority === 'Hoog').length,
    inProgress: openIncidents.filter(i => i.status === 'In behandeling').length,
    newInPeriod: 0,
    byPriority,
    byDepartment,
    byStatus,
    byType,
  }
}

export function buildTimelineSeries(
  incidents: Incident[],
  bucket: SitrepAnalyticsBucket,
  now = new Date(),
): SitrepTimelineSeries {
  const buckets = buildTimeBuckets(bucket, now)
  const labels = buckets.map(b => b.label)
  const totals = buckets.map(() => 0)
  const byPriority = {
    Critical: buckets.map(() => 0),
    Hoog: buckets.map(() => 0),
    Middel: buckets.map(() => 0),
    Laag: buckets.map(() => 0),
  } satisfies Record<Priority, number[]>
  const byDepartment = {
    Parkeer: buckets.map(() => 0),
    Dienstverlening: buckets.map(() => 0),
    EHBO: buckets.map(() => 0),
  } satisfies Record<Department, number[]>

  const periodStart = buckets[0]?.start.getTime() ?? 0
  const periodEnd = buckets[buckets.length - 1]?.end.getTime() ?? now.getTime()
  let newInPeriod = 0

  for (const incident of incidents) {
    const ts = incidentTimestamp(incident)
    if (ts >= periodStart && ts < periodEnd) {
      newInPeriod += 1
    }

    buckets.forEach((timeBucket, index) => {
      if (!isInBucket(incident, timeBucket)) {
        return
      }

      totals[index] += 1
      byPriority[incident.priority][index] += 1
      byDepartment[incident.department][index] += 1
    })
  }

  return {
    labels,
    totals,
    byPriority,
    byDepartment,
  }
}

export function enrichSnapshotWithPeriod(
  snapshot: SitrepAnalyticsSnapshot,
  timeline: SitrepTimelineSeries,
): SitrepAnalyticsSnapshot {
  return {
    ...snapshot,
    newInPeriod: timeline.totals.reduce((sum, value) => sum + value, 0),
  }
}

export const ANALYTICS_PRIORITY_LABELS = [...PRIORITIES]
export const ANALYTICS_DEPARTMENT_LABELS = [...DEPARTMENTS]

export function countOpenActive(incidents: Incident[]): number {
  return incidents.filter(i => i.isOpen).length
}
