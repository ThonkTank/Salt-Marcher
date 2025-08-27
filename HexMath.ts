/**
 * HexMath – axial ↔ pixel conversion + helpers for pointy-top hexes.
 * Coordinate system: axial (q, r), with s = -q - r (not stored).
 * Layout: pointy-top, size = hex radius (distance from center to a corner).
 * Origin at (0,0) in world space. Pan/zoom handled externally.
 *
 * Debug logs intentionally verbose – can be gated by a logger.
 */
export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HexLayout {
  size: number; // radius in px
}

const SQRT3 = Math.sqrt(3);

/**
 * Convert axial -> pixel (world coords) for pointy-top hexes.
 * x = size * (sqrt(3) * q + sqrt(3)/2 * r)
 * y = size * (3/2 * r)
 */
export function axialToPixel(a: Axial, layout: HexLayout): Point {
  const { q, r } = a;
  const { size } = layout;
  return {
    x: size * (SQRT3 * q + (SQRT3 / 2) * r),
    y: size * ((3 / 2) * r),
  };
}

/**
 * Convert pixel (world coords) -> axial (q,r) [fractional], then round to nearest hex.
 * We use standard cube rounding after converting to cube coords.
 */
export function pixelToAxial(p: Point, layout: HexLayout): Axial {
  const { size } = layout;
  const qf = ((SQRT3 / 3) * p.x - (1 / 3) * p.y) / (size * 0.5); // derivation combines scale
  const rf = ((2 / 3) * p.y) / (size * 0.5) * (1/2);             // NOTE: easier to use cube invert below

  // The above quick derivation can cause small drift; prefer precise invert:
  // From Red Blob Games (https://www.redblobgames.com/grids/hex-grids/)
  // pointy-top:
  const q = (SQRT3/3 * p.x - 1/3 * p.y) / layout.size;
  const r = (2/3 * p.y) / layout.size;

  return cubeRound(q, r);
}

function cubeRound(qf: number, rf: number): Axial {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);

  const q_diff = Math.abs(q - qf);
  const r_diff = Math.abs(r - rf);
  const s_diff = Math.abs(s - sf);

  if (q_diff > r_diff && q_diff > s_diff) {
    q = -r - s;
  } else if (r_diff > s_diff) {
    r = -q - s;
  } else {
    s = -q - r;
  }
  return { q, r };
}

export function hexPolygon(a: Axial, layout: HexLayout): Point[] {
  const c = axialToPixel(a, layout);
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30); // pointy-top
    pts.push({
      x: c.x + layout.size * Math.cos(angle),
      y: c.y + layout.size * Math.sin(angle),
    });
  }
  return pts;
}

export function polygonPointsAttr(pts: Point[]): string {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}
