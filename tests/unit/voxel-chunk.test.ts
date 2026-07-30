import { describe, expect, it } from 'vitest'
import {
  createQualificationVoxelChunk,
  meshVoxelChunk,
  qualificationChunkDimensions,
  togglePreviewVoxel
} from '../../src/renderer/spatial-3d/voxel-chunk.js'

describe('qualification voxel chunk', () => {
  it('uses the representative 32 × 32 × 16 chunk dimensions', () => {
    expect(qualificationChunkDimensions).toEqual({
      width: 32,
      height: 16,
      depth: 32
    })
  })

  it('remeshes meaningful voxel geometry when a local preview changes', () => {
    const initial = meshVoxelChunk(createQualificationVoxelChunk())
    const rebuilt = meshVoxelChunk(
      togglePreviewVoxel(createQualificationVoxelChunk())
    )
    expect(initial.positions.length).toBeGreaterThan(0)
    expect(initial.indices.length).toBeGreaterThan(0)
    expect(rebuilt.indices.length).not.toBe(initial.indices.length)
  })
})
