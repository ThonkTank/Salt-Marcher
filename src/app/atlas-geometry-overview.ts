import {atlasWorldTileBounds, type AtlasWorldTile} from './atlas-world-tiles';
import type {AtlasCanonicalSceneObject} from './atlas-scene-geometry';

const FINE_CELLS = 256;
const FINE_CELL_COUNT = FINE_CELLS * FINE_CELLS;
const MAX_OUTPUT_CELLS = 16_384;
const ROOM = 1;
const BUILDING = 2;

export interface AtlasGeometryOverviewMesh {
  readonly id: string;
  readonly kind: 'room' | 'building';
  readonly origin: {readonly x: number; readonly y: number; readonly heightM: number};
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}

export interface AtlasGeometryOverview {
  readonly tile: AtlasWorldTile;
  /** Finest spatial sampling interval; adaptive output cells can be larger. */
  readonly resolution: number;
  readonly maxCellSizeM: number;
  readonly modeledObjects: number;
  readonly meshes: readonly AtlasGeometryOverviewMesh[];
}

type Vertex = [number, number, number];
type KindCode = typeof ROOM | typeof BUILDING;

interface OverviewCell {
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly kind: KindCode;
}

interface MergeCandidate {
  readonly x: number;
  readonly y: number;
  readonly parentIndex: number;
  readonly children: readonly OverviewCell[];
  readonly addedAreaPerRemovedCell: number;
}

function clip(vertices: Vertex[], axis: 0 | 1, bound: number, keepGreater: boolean): Vertex[] {
  if (!vertices.length) return [];
  const result: Vertex[] = [];
  const inside = (vertex: Vertex) => keepGreater ? vertex[axis] >= bound : vertex[axis] <= bound;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!, aInside = inside(a), bInside = inside(b);
    if (aInside) result.push(a);
    if (aInside !== bInside) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      const point: Vertex = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      point[axis] = bound;
      if (!point.every(Number.isFinite)) throw new Error('Atlas geometry overview clipping produced a non-finite point');
      result.push(point);
    }
  }
  return result;
}

function cellIndex(value: number, resolution: number): number {
  return Math.max(0, Math.min(FINE_CELLS - 1, Math.floor(value / resolution)));
}

function cellArea(cell: OverviewCell): number {
  return (cell.maxX - cell.minX) * (cell.maxY - cell.minY);
}

function compareCandidates(a: MergeCandidate, b: MergeCandidate): number {
  return a.addedAreaPerRemovedCell - b.addedAreaPerRemovedCell
    || a.parentIndex - b.parentIndex;
}

function mergeChildren(children: readonly OverviewCell[], x: number, y: number): OverviewCell {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity, kind: KindCode = ROOM;
  for (const child of children) {
    minX = Math.min(minX, child.minX); minY = Math.min(minY, child.minY);
    maxX = Math.max(maxX, child.maxX); maxY = Math.max(maxY, child.maxY);
    minZ = Math.min(minZ, child.minZ);
    if (child.maxZ > maxZ || (child.maxZ === maxZ && child.kind === BUILDING)) {
      maxZ = child.maxZ;
      kind = child.kind;
    }
  }
  return {level: 1, x, y, minX, minY, maxX, maxY, minZ, maxZ, kind};
}

/**
 * A bounded, streaming reduction of canonical meshes into coarse tile geometry.
 * Fine bins retain clipped XY bounds and a physical-height envelope. If needed,
 * neighboring bins are greedily coalesced by the least added bounding-box area.
 */
export class AtlasGeometryOverviewBuilder {
  readonly #tile: AtlasWorldTile;
  readonly #bounds: ReturnType<typeof atlasWorldTileBounds>;
  readonly #resolution: number;
  readonly #minX = new Float64Array(FINE_CELL_COUNT).fill(Infinity);
  readonly #minY = new Float64Array(FINE_CELL_COUNT).fill(Infinity);
  readonly #maxX = new Float64Array(FINE_CELL_COUNT).fill(-Infinity);
  readonly #maxY = new Float64Array(FINE_CELL_COUNT).fill(-Infinity);
  readonly #minZ = new Float64Array(FINE_CELL_COUNT).fill(Infinity);
  readonly #maxZ = new Float64Array(FINE_CELL_COUNT).fill(-Infinity);
  readonly #kind = new Uint8Array(FINE_CELL_COUNT);
  #modeledObjects = 0;
  #finished: AtlasGeometryOverview | null = null;

  constructor(tile: AtlasWorldTile) {
    this.#bounds = atlasWorldTileBounds(tile);
    this.#tile = Object.freeze({...tile});
    this.#resolution = this.#bounds.sizeM / FINE_CELLS;
    if (!Number.isFinite(this.#resolution) || this.#resolution <= 0) throw new Error('Atlas geometry overview resolution is invalid');
  }

  append(object: AtlasCanonicalSceneObject): void {
    if (this.#finished) throw new Error('Atlas geometry overview is already finished');
    if (!object || !object.target || (object.target.kind !== 'room' && object.target.kind !== 'building')) {
      throw new Error('Atlas geometry overview accepts room and building meshes only');
    }
    if (!(object.positions instanceof Float64Array) || !(object.indices instanceof Uint32Array)
      || object.positions.length % 3 !== 0 || object.indices.length % 3 !== 0) {
      throw new Error('Atlas geometry overview buffers are invalid');
    }
    const vertexCount = object.positions.length / 3;
    for (const value of object.positions) if (!Number.isFinite(value)) throw new Error('Atlas geometry overview position is not finite');
    for (const index of object.indices) if (index >= vertexCount) throw new Error('Atlas geometry overview index is out of range');
    if (!Number.isSafeInteger(this.#modeledObjects + 1)) throw new Error('Atlas geometry overview modeled-object count exceeds safe integer precision');
    this.#modeledObjects++;

    const kind: KindCode = object.target.kind === 'building' ? BUILDING : ROOM;
    const {minX, minY} = this.#bounds;
    for (let i = 0; i < object.indices.length; i += 3) {
      const triangle: Vertex[] = [0, 1, 2].map(offset => {
        const index = object.indices[i + offset]! * 3;
        return [object.positions[index]! - minX, object.positions[index + 1]! - minY, object.positions[index + 2]!];
      });
      if (triangle.some(point => !point.every(Number.isFinite))) throw new Error('Atlas geometry overview local position is not finite');

      // A face entirely on either maximum edge belongs to the neighboring tile.
      if (triangle.every(point => point[0] === this.#bounds.sizeM)
        || triangle.every(point => point[1] === this.#bounds.sizeM)) continue;
      const triMinX = Math.min(...triangle.map(point => point[0])), triMaxX = Math.max(...triangle.map(point => point[0]));
      const triMinY = Math.min(...triangle.map(point => point[1])), triMaxY = Math.max(...triangle.map(point => point[1]));
      if (triMaxX < 0 || triMaxY < 0 || triMinX >= this.#bounds.sizeM || triMinY >= this.#bounds.sizeM) continue;
      const firstX = cellIndex(Math.max(0, triMinX), this.#resolution), lastX = cellIndex(Math.min(this.#bounds.sizeM, triMaxX), this.#resolution);
      const firstY = cellIndex(Math.max(0, triMinY), this.#resolution), lastY = cellIndex(Math.min(this.#bounds.sizeM, triMaxY), this.#resolution);
      const a = triangle[0]!, b = triangle[1]!, c = triangle[2]!;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const crossX = uy * vz - uz * vy, crossY = uz * vx - ux * vz, crossZ = ux * vy - uy * vx;
      if (crossX === 0 && crossY === 0 && crossZ === 0) continue;

      for (let y = firstY; y <= lastY; y++) for (let x = firstX; x <= lastX; x++) {
        const x0 = x * this.#resolution, x1 = (x + 1) * this.#resolution;
        const y0 = y * this.#resolution, y1 = (y + 1) * this.#resolution;
        let clipped = clip(triangle, 0, x0, true);
        clipped = clip(clipped, 0, x1, false);
        clipped = clip(clipped, 1, y0, true);
        clipped = clip(clipped, 1, y1, false);
        if (!clipped.length) continue;

        let cellMinX = Infinity, cellMinY = Infinity, cellMaxX = -Infinity, cellMaxY = -Infinity;
        let cellMinZ = Infinity, cellMaxZ = -Infinity;
        for (const point of clipped) {
          cellMinX = Math.min(cellMinX, point[0]); cellMaxX = Math.max(cellMaxX, point[0]);
          cellMinY = Math.min(cellMinY, point[1]); cellMaxY = Math.max(cellMaxY, point[1]);
          cellMinZ = Math.min(cellMinZ, point[2]); cellMaxZ = Math.max(cellMaxZ, point[2]);
        }
        if (![cellMinX, cellMinY, cellMaxX, cellMaxY, cellMinZ, cellMaxZ].every(Number.isFinite)) {
          throw new Error('Atlas geometry overview clipped bounds are not finite');
        }
        const cell = y * FINE_CELLS + x;
        this.#minX[cell] = Math.min(this.#minX[cell]!, cellMinX);
        this.#minY[cell] = Math.min(this.#minY[cell]!, cellMinY);
        this.#maxX[cell] = Math.max(this.#maxX[cell]!, cellMaxX);
        this.#maxY[cell] = Math.max(this.#maxY[cell]!, cellMaxY);
        this.#minZ[cell] = Math.min(this.#minZ[cell]!, cellMinZ);
        if (cellMaxZ > this.#maxZ[cell]! || (cellMaxZ === this.#maxZ[cell] && kind === BUILDING && this.#kind[cell] !== BUILDING)) {
          this.#maxZ[cell] = cellMaxZ;
          this.#kind[cell] = kind;
        }
      }
    }
  }

  #coalesce(): OverviewCell[] {
    const cells: OverviewCell[] = [];
    const parentGroups: OverviewCell[][] = Array.from({length: FINE_CELL_COUNT / 4}, () => []);
    for (let y = 0; y < FINE_CELLS; y++) for (let x = 0; x < FINE_CELLS; x++) {
      const index = y * FINE_CELLS + x, kind = this.#kind[index]!;
      if (kind !== ROOM && kind !== BUILDING) continue;
      const cell: OverviewCell = {
        level: 0, x, y, minX: this.#minX[index]!, minY: this.#minY[index]!,
        maxX: this.#maxX[index]!, maxY: this.#maxY[index]!, minZ: this.#minZ[index]!,
        maxZ: this.#maxZ[index]!, kind,
      };
      cells.push(cell);
      const parentIndex = Math.floor(y / 2) * (FINE_CELLS / 2) + Math.floor(x / 2);
      parentGroups[parentIndex]!.push(cell);
    }
    const candidates: MergeCandidate[] = [];
    for (let parentIndex = 0; parentIndex < parentGroups.length; parentIndex++) {
      const children = parentGroups[parentIndex]!;
      if (children.length < 2) continue;
      const x = parentIndex % (FINE_CELLS / 2), y = Math.floor(parentIndex / (FINE_CELLS / 2));
      const parent = mergeChildren(children, x, y);
      const addedArea = Math.max(0, (parent.maxX - parent.minX) * (parent.maxY - parent.minY)
        - children.reduce((sum, child) => sum + cellArea(child), 0));
      candidates.push({x, y, parentIndex, children, addedAreaPerRemovedCell: addedArea / (children.length - 1)});
    }
    candidates.sort(compareCandidates);

    let outputCount = cells.length;
    const removed = new Set<OverviewCell>(), parents: OverviewCell[] = [];
    for (const candidate of candidates) {
      if (outputCount <= MAX_OUTPUT_CELLS) break;
      for (const child of candidate.children) removed.add(child);
      parents.push(mergeChildren(candidate.children, candidate.x, candidate.y));
      outputCount -= candidate.children.length - 1;
    }
    if (outputCount > MAX_OUTPUT_CELLS) throw new Error('Atlas geometry overview could not meet its output-cell bound');
    return [...cells.filter(cell => !removed.has(cell)), ...parents];
  }

  finish(): AtlasGeometryOverview {
    if (this.#finished) return this.#finished;
    const cells = this.#coalesce();
    let heightOrigin = Infinity, maxCellSizeM = 0;
    const vertexCounts = new Uint32Array(3), indexCounts = new Uint32Array(3);
    for (const cell of cells) {
      heightOrigin = Math.min(heightOrigin, cell.minZ);
      maxCellSizeM = Math.max(maxCellSizeM, this.#resolution * (cell.level === 1 ? 2 : 1));
      const flat = cell.minZ === cell.maxZ;
      vertexCounts[cell.kind] = (vertexCounts[cell.kind] ?? 0) + (flat ? 4 : 20);
      indexCounts[cell.kind] = (indexCounts[cell.kind] ?? 0) + (flat ? 6 : 30);
    }
    if (!Number.isFinite(heightOrigin)) heightOrigin = 0;

    const meshes: AtlasGeometryOverviewMesh[] = [];
    for (const kind of [ROOM, BUILDING] as const) {
      const vertexCount = vertexCounts[kind]!, indexCount = indexCounts[kind]!;
      if (!vertexCount) continue;
      const positions = new Float32Array(vertexCount * 3), indices = new Uint32Array(indexCount);
      let vertexAt = 0, indexAt = 0;
      const putVertex = (x: number, y: number, z: number) => {
        const fx = Math.fround(x), fy = Math.fround(y), fz = Math.fround(z - heightOrigin);
        if (![fx, fy, fz].every(Number.isFinite)) throw new Error('Atlas geometry overview output exceeds Float32 range');
        positions[vertexAt++] = fx; positions[vertexAt++] = fy; positions[vertexAt++] = fz;
      };
      const putTriangle = (a: number, b: number, c: number) => {
        indices[indexAt++] = a; indices[indexAt++] = b; indices[indexAt++] = c;
      };
      for (const cell of cells) {
        if (cell.kind !== kind) continue;
        const {minX, minY, maxX, maxY} = cell;
        const top = cell.maxZ, bottom = cell.minZ, base = vertexAt / 3;
        putVertex(minX, minY, top); putVertex(maxX, minY, top); putVertex(maxX, maxY, top); putVertex(minX, maxY, top);
        putTriangle(base, base + 1, base + 2); putTriangle(base, base + 2, base + 3);
        if (bottom === top) continue;
        const edges: [number, number, number, number][] = [
          [minX, minY, maxX, minY], [maxX, minY, maxX, maxY],
          [maxX, maxY, minX, maxY], [minX, maxY, minX, minY],
        ];
        for (const [ax, ay, bx, by] of edges) {
          const side = vertexAt / 3;
          putVertex(ax, ay, bottom); putVertex(bx, by, bottom); putVertex(ax, ay, top); putVertex(bx, by, top);
          putTriangle(side, side + 1, side + 2); putTriangle(side + 2, side + 1, side + 3);
        }
      }
      meshes.push(Object.freeze({
        id: kind === BUILDING ? 'overview:building' : 'overview:room',
        kind: kind === BUILDING ? 'building' : 'room',
        origin: Object.freeze({x: this.#bounds.minX, y: this.#bounds.minY, heightM: heightOrigin}),
        positions, indices,
      }));
    }
    this.#finished = Object.freeze({
      tile: this.#tile, resolution: this.#resolution, maxCellSizeM,
      modeledObjects: this.#modeledObjects, meshes: Object.freeze(meshes),
    });
    return this.#finished;
  }
}
