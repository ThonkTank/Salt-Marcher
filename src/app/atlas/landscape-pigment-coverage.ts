import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
/** Raster coverage of a version-2 stroke. The caller owns the RGBA footprint
 * mask; the Float32 accumulation and stamp order are part of the paint format.
 * Axis coordinates retain Float64 precision, including far-world positions. */
export function* pigmentStrokeCoverage(
  box: LandscapeBox,
  width: number,
  height: number,
  record: LandscapeRecord,
  mask: Uint8Array,
  checkpoint: () => Generator<void>,
): Generator<void, Float32Array> {
  const p = record.paint!,
    coverage = new Float32Array(width * height),
    xs = new Float64Array(width),
    ys = new Float64Array(height),
    dx2 = new Float64Array(width);
  const textureX = p.tip === 'textured' ? new Int32Array(width) : null,
    textureY = p.tip === 'textured' ? new Int32Array(height) : null,
    radius2 = p.radius ** 2;
  for (let x = 0; x < width; x++) {
    const v = box.x + ((x + 0.5) / width) * box.width;
    xs[x] = v;
    if (textureX) textureX[x] = Math.imul(Math.floor((v / p.radius) * 24), 374761393);
  }
  for (let y = 0; y < height; y++) {
    const v = box.y + ((y + 0.5) / height) * box.height;
    ys[y] = v;
    if (textureY) textureY[y] = Math.imul(Math.floor((v / p.radius) * 24), 668265263);
  }
  const stamps: { x: number; y: number }[] = [];
  for (const stroke of p.strokes ?? [record.points]) {
    if (!stroke.length) continue;
    stamps.push(stroke[0]!);
    for (let n = 1; n < stroke.length; n++) {
      const a = stroke[n - 1]!,
        b = stroke[n]!,
        steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (p.radius * 0.5)));
      for (let j = 1; j <= steps; j++) {
        stamps.push({ x: a.x + ((b.x - a.x) * j) / steps, y: a.y + ((b.y - a.y) * j) / steps });
        if (j % 1024 === 0) yield* checkpoint();
      }
    }
  }
  for (const c of stamps) {
    const x0 = Math.max(0, Math.floor(((c.x - p.radius - box.x) / box.width) * width)),
      x1 = Math.min(width - 1, Math.ceil(((c.x + p.radius - box.x) / box.width) * width));
    const y0 = Math.max(0, Math.floor(((c.y - p.radius - box.y) / box.height) * height)),
      y1 = Math.min(height - 1, Math.ceil(((c.y + p.radius - box.y) / box.height) * height));
    if (x1 < x0 || y1 < y0) {
      yield* checkpoint();
      continue;
    }
    // Each squared axis distance is shared by all samples in its row/column.
    for (let x = x0; x <= x1; x++) dx2[x] = (xs[x]! - c.x) ** 2;
    for (let y = y0; y <= y1; y++) {
      if ((y - y0) % 16 === 0) yield* checkpoint();
      const row = y * width,
        dy2 = (ys[y]! - c.y) ** 2,
        textureRow = textureY ? textureY[y]! ^ p.seed : 0;
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        if (!mask[i * 4 + 3]) continue;
        const r2 = (dx2[x]! + dy2) / radius2;
        if (r2 > 1) continue;
        let strength = p.tip === 'round' ? 1 : (1 - r2) ** 2;
        if (textureX) {
          let n = textureX[x]! ^ textureRow;
          n = Math.imul(n ^ (n >>> 13), 1274126177);
          strength *= 0.15 + (0.85 * ((n ^ (n >>> 16)) >>> 0)) / 4294967295;
        }
        coverage[i] = 1 - (1 - coverage[i]!) * (1 - p.flow * strength);
      }
    }
  }
  return coverage;
}
