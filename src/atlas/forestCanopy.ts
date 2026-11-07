/** World-anchored foliage field: no tree candidates, camera seed or mutable state. */
const hash = (x: number, y: number) => {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
function noise(x: number, y: number, step: number) {
  x /= step;
  y /= step;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = smooth(x - ix),
    fy = smooth(y - iy);
  return (
    (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy) +
    (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy
  );
}
/** Premultiplication is left to canvas. Density changes coverage monotonically. */
export function forestCanopyAt(
  x: number,
  y: number,
  density: number,
): [number, number, number, number] {
  if (density <= 0) return [0, 0, 0, 0];
  const leaves = noise(x + 73, y - 51, 72);
  const gx = (x + (leaves - 0.5) * 100) / 240,
    gy = (y + (noise(x - 117, y + 31, 88) - 0.5) * 100) / 240;
  const ix = Math.floor(gx),
    iy = Math.floor(gy);
  let first = Infinity,
    second = Infinity,
    lightDirection = 0;
  for (let yy = -1; yy <= 1; yy++)
    for (let xx = -1; xx <= 1; xx++) {
      const cx = ix + xx,
        cy = iy + yy;
      const dx = gx - cx - 0.2 - hash(cx, cy) * 0.6;
      const dy = gy - cy - 0.2 - hash(cx + 173, cy - 59) * 0.6;
      const distance =
        (dx * dx + dy * dy) / (0.75 + hash(cx - 91, cy + 137) * 0.5);
      if (distance < first) {
        second = first;
        first = distance;
        lightDirection = Math.max(-0.5, Math.min(0.5, -(dx + dy) * 0.4));
      } else second = Math.min(second, distance);
    }
  const radius = Math.sqrt(first);
  const coverage =
    Math.max(
      smooth((density * 0.82 - radius - (leaves - 0.5) * 0.2) * 9),
      smooth((density - 0.85) / 0.15),
    ) * smooth(density * 10);
  if (!coverage) return [0, 0, 0, 0];
  // Joined crown masses: shallow creases and a shared upper-left light source.
  const crease = smooth((second - first) * 10);
  const tone = Math.max(
    0,
    Math.min(
      1,
      (1 - Math.min(radius, 1)) * 0.45 +
        leaves * 0.35 +
        crease * 0.08 +
        lightDirection * 0.25,
    ),
  );
  return [89 + tone * 62, 111 + tone * 51, 70 + tone * 49, 255 * coverage];
}
