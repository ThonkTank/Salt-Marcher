import { describe, expect, it } from 'vitest'
import {
  createSparseQualificationCells,
  cullCells,
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
})
