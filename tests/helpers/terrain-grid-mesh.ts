import * as THREE from 'three';
import { terrainGridLayout } from '../../src/app/terrain-grid-layout';
import type { TerrainGrid } from '../../src/app/terrain-spatial-model';
/** Independent triangle oracle for persisted brush snapshots and nonuniform lattices. */
export function gridMesh(grid: TerrainGrid) {
  const { view: v } = grid,
    l = terrainGridLayout(v),
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let y = 0; y < v.rows; y++)
    for (let x = 0; x < v.columns; x++) {
      positions.push(l.x.values[x]!, -l.y.values[y]!, grid.heights[y * v.columns + x]! - v.focusM);
      uv.push((l.x.values[x]! - v.box.x) / v.box.width, (l.y.values[y]! - v.box.y) / v.box.height);
      if (x < v.columns - 1 && y < v.rows - 1) {
        const i = y * v.columns + x;
        indices.push(i, i + 1, i + v.columns, i + 1, i + v.columns + 1, i + v.columns);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  return mesh;
}
