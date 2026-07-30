export interface SparseCell {
  readonly x: number
  readonly y: number
  readonly fact: boolean
}

const gridWidth = 128
const cellStride = 12

export const sparseCellCount = 100_000
export const visibleFactCount = 8_192

/** Deterministic, thinly distributed data for the M1 rendering qualification. */
export function createSparseQualificationCells(): readonly SparseCell[] {
  return Array.from({ length: sparseCellCount }, (_, index) => ({
    x: (index % gridWidth) * cellStride,
    y: Math.floor(index / gridWidth) * cellStride,
    fact: index < visibleFactCount
  }))
}

export function qualificationViewport(): Readonly<{
  x: number
  y: number
  width: number
  height: number
}> {
  return {
    x: 0,
    y: 0,
    width: gridWidth * cellStride,
    height: Math.ceil(visibleFactCount / gridWidth) * cellStride
  }
}

export function countFacts(cells: readonly SparseCell[]): number {
  return cells.filter((cell) => cell.fact).length
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
