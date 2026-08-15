export function useSitrepMapHighlight() {
  const hoveredIncidentId = useState<string | null>('sitrep-map-hovered-incident', () => null)

  function setHoveredIncidentId(id: string | null) {
    hoveredIncidentId.value = id
  }

  return {
    hoveredIncidentId,
    setHoveredIncidentId,
  }
}
