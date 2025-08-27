// HexMath.ts
// Utility-Funktionen für Hexagon-Koordinaten (axial <-> pixel)

export interface Point { x: number; y: number }
export interface Axial { q: number; r: number }
export interface HexLayout { size: number } // size = Radius (Center -> Corner)

const SQRT3 = Math.sqrt(3);

// Axial -> Pixel
export function axialToPixel(hex: Axial, layout: HexLayout): Point {
  const x = layout.size * (SQRT3 * hex.q + (SQRT3 / 2) * hex.r);
  const y = layout.size * (3 / 2) * hex.r;
  return { x, y };
}

// Pixel -> Axial (präzise Invertierung, nach Red Blob Games)
export function pixelToAxial(p: Point, layout: HexLayout): Axial {
  const q = (SQRT3 / 3 * p.x - 1 / 3 * p.y) / layout.size;
  const r = (2 / 3 * p.y) / layout.size;
  return cubeRound(q, r);
}

// Rundung von Float-Koordinaten auf nächstliegendes Axial-Hex
function cubeRound(qf: number, rf: number): Axial {
  let x = qf;
  let z = rf;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

// Erzeugt die Eckpunkte eines Hexagons (im Weltkoordinatensystem)
export function polygonCorners(hex: Axial, layout: HexLayout): Point[] {
  const center = axialToPixel(hex, layout);
  const corners: Point[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = center.x + layout.size * Math.cos(angle);
    const y = center.y + layout.size * Math.sin(angle);
    corners.push({ x, y });
  }

  return corners;
}
