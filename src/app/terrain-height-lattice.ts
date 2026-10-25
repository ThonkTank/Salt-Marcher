import { heightRow, interpolateHeight } from './terrain-interpolation';
import { decodeHeights } from './terrain-height';
import type { LandscapeRecord } from './atlas-landscape';

/** Readonly numerical source. Decoding stays lazy until a sampled node touches it. */
export interface TerrainHeightSource {
  version: 1 | 2;
  x: number;
  y: number;
  pixel: number;
  read: () => Float32Array;
}
export function* terrainHeightSources(
  records: Iterable<LandscapeRecord>,
): Generator<TerrainHeightSource> {
  for (const record of records) {
    const tile = record.height;
    if (!tile) throw Error('Höhenkachel fehlt.');
    yield {
      version: tile.version,
      x: tile.x,
      y: tile.y,
      pixel: tile.pixel,
      read: () => decodeHeights(tile),
    };
  }
}
interface Axis {
  nodes: Float64Array;
  starts: Uint32Array;
  fractions: Float64Array;
}
/** Each source node appears once even when many output pixels share a cell.
 * Coordinates remain Float64: author cells can lie beyond signed 32-bit range. */
function sourceAxis(points: Float64Array, pixel: number): Axis {
  const nodes: number[] = [],
    starts = new Uint32Array(points.length),
    fractions = new Float64Array(points.length);
  let start = 0;
  for (let i = 0; i < points.length; i++) {
    const value = points[i]! / pixel,
      cell = Math.floor(value) - 1;
    fractions[i] = value - Math.floor(value);
    while (start < nodes.length && nodes[start]! < cell) start++;
    for (let offset = 0; offset < 4; offset++)
      if (start + offset === nodes.length) nodes.push(cell + offset);
    starts[i] = start;
  }
  return { nodes: Float64Array.from(nodes), starts, fractions };
}
function lowerBound(values: Float64Array, value: number) {
  let left = 0,
    right = values.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (values[mid]! < value) left = mid + 1;
    else right = mid;
  }
  return left;
}
/** A bounded Cartesian set of required source nodes, independent of author count.
 * At most sixteen nodes per output sample and per absolute/additive layer survive.
 * No complete decoded author tile is retained. */
class HeightLevel {
  private x: Axis;
  private y: Axis;
  private absolute?: Float32Array;
  private additive?: Float32Array;
  constructor(
    readonly pixel: number,
    x: Float64Array,
    y: Float64Array,
  ) {
    this.x = sourceAxis(x, pixel);
    this.y = sourceAxis(y, pixel);
  }
  read(tile: TerrainHeightSource) {
    const x = this.x.nodes,
      y = this.y.nodes,
      tx = tile.x / this.pixel,
      ty = tile.y / this.pixel;
    const left = lowerBound(x, tx),
      right = lowerBound(x, tx + 64),
      top = lowerBound(y, ty),
      bottom = lowerBound(y, ty + 64);
    if (left === right || top === bottom) return;
    const values = tile.read(),
      target =
        tile.version === 2
          ? (this.additive ??= new Float32Array(x.length * y.length).fill(NaN))
          : (this.absolute ??= new Float32Array(x.length * y.length).fill(NaN));
    for (let row = top; row < bottom; row++) {
      const source = (y[row]! - ty) * 64,
        targetRow = row * x.length;
      for (let col = left; col < right; col++) {
        const value = values[source + x[col]! - tx]!;
        if (Number.isNaN(value)) continue;
        const at = targetRow + col;
        if (!Number.isNaN(target[at]!)) throw Error('Doppelte Höhenkachel.');
        target[at] = value;
      }
    }
  }
  apply(ground: Float64Array, additions: Float64Array) {
    if (!this.absolute && !this.additive) return;
    const x = this.x,
      y = this.y,
      columns = x.starts.length;
    const horizontal = (values: Float32Array | undefined, inherit: boolean) => {
      if (!values) return;
      const out = new Float64Array(y.nodes.length * columns);
      for (let row = 0; row < y.nodes.length; row++)
        for (let col = 0; col < columns; col++) {
          const at = row * x.nodes.length + x.starts[col]!,
            a = values[at]!,
            b = values[at + 1]!,
            c = values[at + 2]!,
            d = values[at + 3]!;
          const hole = Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d);
          out[row * columns + col] =
            inherit && hole
              ? NaN
              : interpolateHeight(
                  Number.isNaN(a) ? 0 : a,
                  Number.isNaN(b) ? 0 : b,
                  Number.isNaN(c) ? 0 : c,
                  Number.isNaN(d) ? 0 : d,
                  x.fractions[col]!,
                );
        }
      return out;
    };
    const absolute = horizontal(this.absolute, true),
      additive = horizontal(this.additive, false);
    for (let row = 0; row < y.starts.length; row++)
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col,
          base = y.starts[row]! * x.nodes.length + x.starts[col]!,
          fx = x.fractions[col]!,
          fy = y.fractions[row]!;
        const at = y.starts[row]! * columns + col;
        if (absolute) {
          const a = absolute[at]!,
            b = absolute[at + columns]!,
            c = absolute[at + 2 * columns]!,
            d = absolute[at + 3 * columns]!;
          // Only rows containing holes depend on this point's coarse value. Reuse
          // every complete row even when another row in the neighbourhood is sparse.
          if (!Number.isNaN(a + b + c + d)) {
            ground[index] = interpolateHeight(a, b, c, d, fy);
          } else {
            const fill = ground[index]!,
              stride = x.nodes.length;
            ground[index] = interpolateHeight(
              Number.isNaN(a) ? heightRow(this.absolute!, base, fx, fill) : a,
              Number.isNaN(b) ? heightRow(this.absolute!, base + stride, fx, fill) : b,
              Number.isNaN(c) ? heightRow(this.absolute!, base + 2 * stride, fx, fill) : c,
              Number.isNaN(d) ? heightRow(this.absolute!, base + 3 * stride, fx, fill) : d,
              fy,
            );
          }
        }
        if (additive)
          additions[index] =
            additions[index]! +
            interpolateHeight(
              additive[at]!,
              additive[at + columns]!,
              additive[at + 2 * columns]!,
              additive[at + 3 * columns]!,
              fy,
            );
      }
  }
}
/** Input tiles are unique and coarse-to-fine, as required by the readonly reader. */
export function accumulateHeightSources(
  x: Float64Array,
  y: Float64Array,
  tiles: Iterable<TerrainHeightSource>,
  ground: Float64Array,
  additions: Float64Array,
) {
  let level: HeightLevel | undefined;
  for (const tile of tiles) {
    if (level && tile.pixel > level.pixel)
      throw Error('Höhenkacheln müssen von grob nach fein gelesen werden.');
    if (!level || tile.pixel !== level.pixel) {
      level?.apply(ground, additions);
      level = new HeightLevel(tile.pixel, x, y);
    }
    level.read(tile);
  }
  level?.apply(ground, additions);
}
