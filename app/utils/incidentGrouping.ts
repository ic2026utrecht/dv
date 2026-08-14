import type { Incident } from '~/types/models'
import { compareIncidents, type SitrepSortKey } from '~/utils/sitrepFilters'

export interface IncidentGroup {
  parent: Incident
  children: Incident[]
}

export type SitrepListEntry =
  | {
      kind: 'group'
      group: IncidentGroup
    }
  | {
      kind: 'standalone'
      incident: Incident
    }
  | {
      kind: 'orphan'
      incident: Incident
      parentId: string
      parentLabel?: string
    }

function isRoot(incident: Incident): boolean {
  return !incident.parentId
}

export function buildSitrepListEntries(
  filtered: Incident[],
  allIncidents: Incident[],
  sort: SitrepSortKey,
): SitrepListEntry[] {
  const byId = new Map(allIncidents.map(incident => [incident.incidentId, incident]))
  const filteredIds = new Set(filtered.map(incident => incident.incidentId))
  const childrenByParent = new Map<string, Incident[]>()
  const topLevel: Incident[] = []

  for (const incident of filtered) {
    const parentId = incident.parentId?.trim()
    if (!parentId) {
      topLevel.push(incident)
      continue
    }

    const parent = byId.get(parentId)
    if (parent && isRoot(parent) && filteredIds.has(parent.incidentId)) {
      const siblings = childrenByParent.get(parentId) ?? []
      siblings.push(incident)
      childrenByParent.set(parentId, siblings)
      continue
    }

    topLevel.push(incident)
  }

  topLevel.sort((a, b) => compareIncidents(a, b, sort))

  return topLevel.map((incident) => {
    const parentId = incident.parentId?.trim()
    if (parentId) {
      const parent = byId.get(parentId)
      return {
        kind: 'orphan' as const,
        incident,
        parentId,
        parentLabel: parent?.incidentId,
      }
    }

    const children = (childrenByParent.get(incident.incidentId) ?? [])
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    if (children.length > 0) {
      return {
        kind: 'group' as const,
        group: {
          parent: incident,
          children,
        },
      }
    }

    return {
      kind: 'standalone' as const,
      incident,
    }
  })
}
