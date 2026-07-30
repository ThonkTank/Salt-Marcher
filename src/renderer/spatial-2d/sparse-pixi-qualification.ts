export interface SparseCell {
  readonly x: number
  readonly y: number
  readonly fact: boolean
}

export interface SparseCellIndex {
  readonly bucketSize: number
  readonly buckets: ReadonlyMap<string, readonly SparseCell[]>
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

/**
 * Indexes sparse cells into fixed world-space buckets so camera movement only
 * visits the chunks intersecting the viewport, never all 100,000 cells.
 */
export function createSparseCellIndex(
  cells: readonly SparseCell[],
  bucketSize = 192
): SparseCellIndex {
  const mutableBuckets = new Map<string, SparseCell[]>()
  for (const cell of cells) {
    const key = bucketKey(cell.x, cell.y, bucketSize)
    const bucket = mutableBuckets.get(key)
    if (bucket === undefined) mutableBuckets.set(key, [cell])
    else bucket.push(cell)
  }
  return { bucketSize, buckets: mutableBuckets }
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

export function cullIndexedCells(
  index: SparseCellIndex,
  viewport: Readonly<{ x: number; y: number; width: number; height: number }>
): readonly SparseCell[] {
  const visible: SparseCell[] = []
  const startX = Math.floor(viewport.x / index.bucketSize)
  const endX = Math.floor((viewport.x + viewport.width - 1) / index.bucketSize)
  const startY = Math.floor(viewport.y / index.bucketSize)
  const endY = Math.floor((viewport.y + viewport.height - 1) / index.bucketSize)
  for (let bucketY = startY; bucketY <= endY; bucketY += 1) {
    for (let bucketX = startX; bucketX <= endX; bucketX += 1) {
      const bucket = index.buckets.get(`${bucketX}:${bucketY}`)
      if (bucket === undefined) continue
      for (const cell of bucket) {
        if (
          cell.x >= viewport.x &&
          cell.y >= viewport.y &&
          cell.x < viewport.x + viewport.width &&
          cell.y < viewport.y + viewport.height
        )
          visible.push(cell)
      }
    }
  }
  return visible.sort((left, right) => left.y - right.y || left.x - right.x)
}

function bucketKey(x: number, y: number, bucketSize: number): string {
  return `${Math.floor(x / bucketSize)}:${Math.floor(y / bucketSize)}`
}
