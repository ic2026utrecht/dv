export interface HeatmapPoint {
  x: number
  y: number
  weight: number
}

export const HEATMAP_DEFAULT_TOP_THRESHOLD = 10
export const HEATMAP_TOP_THRESHOLD_MIN = 5
export const HEATMAP_TOP_THRESHOLD_MAX = 50

/** Boost drawn alpha so the overlay reads clearly on the map. */
const HEATMAP_RENDER_OPACITY_MULTIPLIER = 1.45

const HEATMAP_TIER_DEFINITIONS = [
  { ratio: 1, color: [139, 0, 0] as const, opacity: 1 },
  { ratio: 0.8, color: [255, 0, 0] as const, opacity: 0.8 },
  { ratio: 0.6, color: [234, 88, 12] as const, opacity: 0.6 },
  { ratio: 0.4, color: [255, 140, 0] as const, opacity: 0.4 },
  { ratio: 0.1, color: [255, 240, 0] as const, opacity: 0.1 },
] as const

const HEATMAP_ZERO_TIER = {
  minCount: 0,
  color: [34, 197, 94] as const,
  opacity: 0.18,
}

export interface HeatmapTier {
  minCount: number
  color: readonly [number, number, number]
  opacity: number
}

export function getHeatmapTiers(topThreshold: number): HeatmapTier[] {
  const scaledTiers = HEATMAP_TIER_DEFINITIONS.map(definition => ({
    minCount: Math.max(1, Math.ceil(topThreshold * definition.ratio)),
    color: definition.color,
    opacity: definition.opacity,
  }))

  return [
    ...scaledTiers,
    {
      minCount: HEATMAP_ZERO_TIER.minCount,
      color: HEATMAP_ZERO_TIER.color,
      opacity: HEATMAP_ZERO_TIER.opacity,
    },
  ]
}

export function getHeatmapTierForCount(count: number, topThreshold: number): HeatmapTier | null {
  for (const tier of getHeatmapTiers(topThreshold)) {
    if (count >= tier.minCount) {
      return tier
    }
  }
  return null
}

export function heatmapTierLabel(tier: HeatmapTier): string {
  return tier.minCount === 0 ? '0' : `${tier.minCount}+`
}

export function heatmapTierColor(tier: HeatmapTier): string {
  const [red, green, blue] = tier.color
  return `rgba(${red}, ${green}, ${blue}, ${tier.opacity})`
}

export function heatmapTierLegendColor(tier: HeatmapTier): string {
  const [red, green, blue] = tier.color
  return `rgb(${red}, ${green}, ${blue})`
}

function renderAlpha(opacity: number): number {
  return Math.min(1, opacity * HEATMAP_RENDER_OPACITY_MULTIPLIER)
}

export function drawIncidentHeatmap(
  canvas: HTMLCanvasElement,
  points: HeatmapPoint[],
  topThreshold: number,
) {
  const width = canvas.width
  const height = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  ctx.clearRect(0, 0, width, height)
  if (!width || !height || !points.length) {
    return
  }

  const tiers = getHeatmapTiers(topThreshold)
  const baseRadius = Math.min(width, height) * 0.075
  const sortedPoints = [...points].sort((left, right) => left.weight - right.weight)

  for (const point of sortedPoints) {
    const tierIndex = tiers.findIndex(tier => point.weight >= tier.minCount)
    if (tierIndex < 0) {
      continue
    }

    const tier = tiers[tierIndex]!
    const x = point.x * width
    const y = point.y * height
    const radius = baseRadius * (1.05 - tierIndex * 0.04)
    const [red, green, blue] = tier.color
    const alpha = renderAlpha(tier.opacity)

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`)
    gradient.addColorStop(0.45, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.92})`)
    gradient.addColorStop(0.75, `rgba(${red}, ${green}, ${blue}, ${alpha * 0.55})`)
    gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`)

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}

export function parseMapPercent(value: string): number {
  return Number.parseFloat(value) / 100
}
