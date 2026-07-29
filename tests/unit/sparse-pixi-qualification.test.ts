import { describe, expect, it } from 'vitest'
import {
  createSparseQualificationCells,
  cullCells
} from '../../src/renderer/spatial-2d/sparse-pixi-qualification.js'

describe('sparse Pixi qualification fixture', () => {
  it('contains the agreed data volume and visible facts', () => {
    const cells = createSparseQualificationCells()
    expect(cells).toHaveLength(100_000)
    expect(cells.filter((cell) => cell.fact)).toHaveLength(8_192)
    expect(
      cullCells(cells, { x: 0, y: 0, width: 640, height: 360 }).length
    ).toBeGreaterThan(0)
  })
})
