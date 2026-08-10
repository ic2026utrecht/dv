import { RASTER_COLUMNS, RASTER_ROWS } from '~/utils/incidentOptions'

/** Grid area on raster-map.png as fractions of image width/height. */
export const RASTER_MAP_GRID_BOUNDS = {
  left: 0.058,
  top: 0.048,
  right: 0.968,
  bottom: 0.902,
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
