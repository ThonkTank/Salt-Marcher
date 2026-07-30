export const qualificationChunkDimensions = {
  width: 32,
  height: 16,
  depth: 32
} as const

export interface VoxelMeshData {
  readonly positions: readonly number[]
  readonly indices: readonly number[]
  readonly normals: readonly number[]
}

export type VoxelChunk = Uint8Array

const faces = [
  {
    neighbor: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1]
    ]
  },
  {
    neighbor: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    neighbor: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0]
    ]
  },
  {
    neighbor: [0, -1, 0],
    corners: [
      [0, 0, 1],
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1]
    ]
  },
  {
    neighbor: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1]
    ]
  },
  {
    neighbor: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0]
    ]
  }
] as const

/** A deterministic 32 × 32 × 16 cave-like chunk for the M1 preview path. */
export function createQualificationVoxelChunk(): VoxelChunk {
  const { width, height, depth } = qualificationChunkDimensions
  const voxels = new Uint8Array(width * height * depth)
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const shell = x === 0 || z === 0 || x === width - 1 || z === depth - 1
        const floor = y === 0
        const pillar = x % 9 === 0 && z % 11 === 0 && y < 9
        if (shell || floor || pillar) voxels[voxelIndex(x, y, z)] = 1
      }
    }
  }
  return voxels
}

export function togglePreviewVoxel(voxels: VoxelChunk): VoxelChunk {
  const next = new Uint8Array(voxels)
  const { width, height, depth } = qualificationChunkDimensions
  const index = voxelIndex(
    Math.floor(width / 2),
    Math.floor(height / 2),
    Math.floor(depth / 2)
  )
  next[index] = next[index] === 0 ? 1 : 0
  return next
}

/** Builds only the exposed faces of a voxel chunk; hidden interior faces are omitted. */
export function meshVoxelChunk(voxels: VoxelChunk): VoxelMeshData {
  const positions: number[] = []
  const indices: number[] = []
  const normals: number[] = []
  const { width, height, depth } = qualificationChunkDimensions
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (voxels[voxelIndex(x, y, z)] === 0) continue
        for (const face of faces) {
          const [offsetX, offsetY, offsetZ] = face.neighbor
          if (solid(voxels, x + offsetX, y + offsetY, z + offsetZ)) continue
          const base = positions.length / 3
          for (const corner of face.corners) {
            positions.push(x + corner[0], y + corner[1], z + corner[2])
            normals.push(offsetX, offsetY, offsetZ)
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
        }
      }
    }
  }
  return { positions, indices, normals }
}

function solid(voxels: VoxelChunk, x: number, y: number, z: number): boolean {
  const { width, height, depth } = qualificationChunkDimensions
  return (
    x >= 0 &&
    x < width &&
    y >= 0 &&
    y < height &&
    z >= 0 &&
    z < depth &&
    voxels[voxelIndex(x, y, z)] === 1
  )
}

function voxelIndex(x: number, y: number, z: number): number {
  const { width, depth } = qualificationChunkDimensions
  return y * width * depth + z * width + x
}
