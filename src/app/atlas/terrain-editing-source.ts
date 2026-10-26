/** Bounded display samples, not author records. Each band retains its editing scale. */
export interface TerrainEditingSource {
  base: Float32Array;
  bands: { pixel: number; heights: Float32Array }[];
}
export function copyEditingSource(source: TerrainEditingSource): TerrainEditingSource {
  return {
    base: source.base.slice(),
    bands: source.bands.map((b) => ({ pixel: b.pixel, heights: b.heights.slice() })),
  };
}
/** Copy a rectangular projection block, including zeros for bands absent from that block. */
export function copyEditingBlock(
  target: TerrainEditingSource,
  source: TerrainEditingSource,
  columns: number,
  x: number,
  y: number,
  width: number,
  rows: number,
) {
  for (const band of source.bands)
    if (!target.bands.some((b) => b.pixel === band.pixel))
      target.bands.push({ pixel: band.pixel, heights: new Float32Array(target.base.length) });
  target.bands.sort((a, b) => b.pixel - a.pixel);
  for (let row = 0; row < rows; row++) {
    const offset = (y + row) * columns + x,
      start = row * width;
    target.base.set(source.base.subarray(start, start + width), offset);
    for (const band of target.bands) {
      const from = source.bands.find((b) => b.pixel === band.pixel);
      if (from) band.heights.set(from.heights.subarray(start, start + width), offset);
      else band.heights.fill(0, offset, offset + width);
    }
  }
}
export function editingSourceBytes(source: TerrainEditingSource | undefined) {
  return source
    ? source.base.byteLength + source.bands.reduce((n, b) => n + b.heights.byteLength + 16, 0)
    : 0;
}

/** A display tile has at most the 49 supported author scales, never author records. */
export function validEditingSource(
  source: TerrainEditingSource | undefined,
  length: number,
): boolean {
  return (
    !!source &&
    source.base instanceof Float32Array &&
    source.base.length === length &&
    Array.isArray(source.bands) &&
    source.bands.length <= 49 &&
    source.bands.every(
      (b, i) =>
        b &&
        Number.isInteger(Math.log2(b.pixel)) &&
        b.pixel >= 2 ** -24 &&
        b.pixel <= 2 ** 24 &&
        (i === 0 || source.bands[i - 1]!.pixel > b.pixel) &&
        b.heights instanceof Float32Array &&
        b.heights.length === length,
    )
  );
}
