import { describe, expect, it } from 'vitest'
import {
  createSparseQualificationCells,
  createSparseCellIndex,
  cullCells,
  cullIndexedCells,
  countFacts,
  qualificationViewport,
  sparseCellCount,
  visibleFactCount
} from '../../src/renderer/spatial-2d/sparse-pixi-qualification.js'

describe('sparse Pixi qualification fixture', () => {
  it('contains the agreed data volume and visible facts', () => {
    const cells = createSparseQualificationCells()
    expect(cells).toHaveLength(sparseCellCount)
    expect(countFacts(cells)).toBe(visibleFactCount)
    expect(countFacts(cullCells(cells, qualificationViewport()))).toBe(
      visibleFactCount
    )
  })

  it('returns the same viewport result through its spatial index', () => {
    const cells = createSparseQualificationCells()
    const viewport = { x: 384, y: 120, width: 640, height: 360 }
    expect(cullIndexedCells(createSparseCellIndex(cells), viewport)).toEqual(
      cullCells(cells, viewport)
    )
  })
})
