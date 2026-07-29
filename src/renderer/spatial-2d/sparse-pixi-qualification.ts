export interface SparseCell {
  readonly x: number
  readonly y: number
  readonly fact: boolean
}

const gridWidth = 400

/** Deterministic, thinly distributed data for the M1 rendering qualification. */
export function createSparseQualificationCells(): readonly SparseCell[] {
  return Array.from({ length: 100_000 }, (_, index) => ({
    x: (index % gridWidth) * 12,
    y: Math.floor(index / gridWidth) * 12,
    fact: index < 8_192
  }))
}

export function cullCells(
  cells: readonly SparseCell[],
  viewport: Readonly<{ x: number; y: number; width: number; height: number }>
): readonly SparseCell[] {
  return cells.filter(
    (cell) =>
      cell.x >= viewport.x &&
      cell.y >= viewport.y &&
      cell.x < viewport.x + viewport.width &&
      cell.y < viewport.y + viewport.height
  )
}
