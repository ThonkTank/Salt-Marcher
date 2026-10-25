/** Shape-preserving Hermite interpolation between b and c. Tangents vanish at
 * extrema, so plateaus and coast shelves gain no invented peaks or depressions. */
const tangent = (a: number, b: number) => (a * b <= 0 ? 0 : (2 * a * b) / (a + b));
export function interpolateHeight(a: number, b: number, c: number, d: number, t: number) {
  if (b === c || t === 0) return b;
  if (t === 1) return c;
  const delta = c - b,
    m0 = tangent(b - a, delta),
    m1 = tangent(delta, d - c);
  return b + t * (m0 + t * (3 * delta - 2 * m0 - m1 + t * (m0 + m1 - 2 * delta)));
}
/** Four consecutive source nodes share the same inherited coarse value. */
export function heightRow(nodes: ArrayLike<number>, offset: number, x: number, fill: number) {
  const a = nodes[offset]!,
    b = nodes[offset + 1]!,
    c = nodes[offset + 2]!,
    d = nodes[offset + 3]!;
  return interpolateHeight(
    Number.isNaN(a) ? fill : a,
    Number.isNaN(b) ? fill : b,
    Number.isNaN(c) ? fill : c,
    Number.isNaN(d) ? fill : d,
    x,
  );
}
/** Missing absolute nodes inherit the coarser value at this point; missing
 * additive nodes use zero. The same x-then-y order serves queries and streams. */
export function heightPatch(
  nodes: ArrayLike<number>,
  x: number,
  y: number,
  fill: number,
  offset = 0,
  stride = 4,
) {
  const b = nodes[offset + stride + 1]!,
    c = nodes[offset + stride + 2]!,
    e = nodes[offset + 2 * stride + 1]!,
    f = nodes[offset + 2 * stride + 2]!;
  const center = Number.isNaN(b) ? fill : b;
  if (
    center === (Number.isNaN(c) ? fill : c) &&
    center === (Number.isNaN(e) ? fill : e) &&
    center === (Number.isNaN(f) ? fill : f)
  )
    return center;
  return interpolateHeight(
    heightRow(nodes, offset, x, fill),
    heightRow(nodes, offset + stride, x, fill),
    heightRow(nodes, offset + 2 * stride, x, fill),
    heightRow(nodes, offset + 3 * stride, x, fill),
    y,
  );
}
/** A source node influences two neighbouring cells in each direction. */
export function heightInfluenceBounds(t: { x: number; y: number; pixel: number }) {
  return { x: t.x - 2 * t.pixel, y: t.y - 2 * t.pixel, width: 67 * t.pixel, height: 67 * t.pixel };
}
