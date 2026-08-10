import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

/** Grid area on raster-map.png (4096×3508) as fractions of image width/height. */
export const RASTER_MAP_GRID_BOUNDS = {
  // Calibrated from corners: A1 (180,313), A22 (3751,313), M1 (180,2873), M22 (3751,2873)
  left: 180 / 4096,
  top: 313 / 3508,
  right: 3751 / 4096,
  bottom: 2873 / 3508,
} as const

export interface RasterMapCell {
  code: string
  row: string
  column: number
  style: {
    left: string
    top: string
    width: string
    height: string
  }
}

export function buildRasterMapCells(
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
  bounds = RASTER_MAP_GRID_BOUNDS,
): RasterMapCell[] {
  const cells: RasterMapCell[] = []
  const gridWidth = bounds.right - bounds.left
  const gridHeight = bounds.bottom - bounds.top
  const cellWidth = gridWidth / columns.length
  const cellHeight = gridHeight / rows.length

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const row = rows[rowIndex]!
      const column = columns[colIndex]!
      cells.push({
        code: `${row}${column}`,
        row,
        column,
        style: {
          left: `${(bounds.left + colIndex * cellWidth) * 100}%`,
          top: `${(bounds.top + rowIndex * cellHeight) * 100}%`,
          width: `${cellWidth * 100}%`,
          height: `${cellHeight * 100}%`,
        },
      })
    }
  }

  return cells
}

/** Center point of a sector cell as percentage positions on the map image. */
export function getSectorMarkerPosition(
  sectorCode: string,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
  bounds = RASTER_MAP_GRID_BOUNDS,
): { left: string, top: string } | null {
  const parsed = sectorCode.match(/^([A-M])(\d{1,2})$/i)
  if (!parsed?.[1] || !parsed[2]) {
    return null
  }

  const row = parsed[1].toUpperCase()
  const column = Number(parsed[2])
  const rowIndex = rows.indexOf(row)
  const colIndex = columns.indexOf(column)

  if (rowIndex < 0 || colIndex < 0) {
    return null
  }

  const gridWidth = bounds.right - bounds.left
  const gridHeight = bounds.bottom - bounds.top
  const cellWidth = gridWidth / columns.length
  const cellHeight = gridHeight / rows.length

  const left = (bounds.left + colIndex * cellWidth + cellWidth / 2) * 100
  const top = (bounds.top + rowIndex * cellHeight + cellHeight / 2) * 100

  return {
    left: `${left}%`,
    top: `${top}%`,
  }
}

/** Map a screen tap to a sector code using the transformed stage element bounds. */
export function pickSectorAtClientPoint(
  clientX: number,
  clientY: number,
  stageElement: HTMLElement,
  rows: string[] = RASTER_ROWS,
  columns: number[] = RASTER_COLUMNS,
  bounds = RASTER_MAP_GRID_BOUNDS,
): string | null {
  const rect = stageElement.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  const fx = (clientX - rect.left) / rect.width
  const fy = (clientY - rect.top) / rect.height

  if (fx < bounds.left || fx > bounds.right || fy < bounds.top || fy > bounds.bottom) {
    return null
  }

  const gridWidth = bounds.right - bounds.left
  const gridHeight = bounds.bottom - bounds.top
  const colIndex = Math.floor(((fx - bounds.left) / gridWidth) * columns.length)
  const rowIndex = Math.floor(((fy - bounds.top) / gridHeight) * rows.length)

  if (
    colIndex < 0
    || colIndex >= columns.length
    || rowIndex < 0
    || rowIndex >= rows.length
  ) {
    return null
  }

  return `${rows[rowIndex]}${columns[colIndex]}`
}
