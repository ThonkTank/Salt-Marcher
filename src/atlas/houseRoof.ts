import type { House, LocalPoint } from "./model";

/** Only a single rectangular contour admits this simple roof construction. */
export function rectangularRoof(contours: LocalPoint[][]) {
  if (contours.length !== 1) return null;
  const ring = contours[0];
  const points =
    ring.length === 5 && ring[0][0] === ring[4][0] && ring[0][1] === ring[4][1]
      ? ring.slice(0, 4)
      : ring;
  if (points.length !== 4) return null;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    X = Math.max(...xs),
    Y = Math.max(...ys);
  if (![x, y, X, Y].every(Number.isFinite) || X <= x || Y <= y) return null;
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4];
    if (
      (a[0] !== x && a[0] !== X) ||
      (a[1] !== y && a[1] !== Y) ||
      (a[0] === b[0]) === (a[1] === b[1])
    )
      return null;
  }
  if (new Set(points.map((p) => `${p[0]},${p[1]}`)).size !== 4) return null;
  return { x, y, X, Y };
}

/** Constant-size pen-and-wash detail, using the existing exterior clip. */
export function paintHouseRoof(
  c: CanvasRenderingContext2D,
  house: House,
  path: Path2D,
  scale: number,
) {
  if (scale < 0.32) return;
  const bounds = rectangularRoof(house.contours);
  if (!bounds) return;
  const { x, y, X, Y } = bounds;
  // Fade by actual footprint, so tiny roofs do not become dark symbols.
  const alpha =
    Math.min(1, (scale - 0.32) / 0.32) *
    Math.min(1, Math.max(0, (Math.min(X - x, Y - y) * 5 * scale - 12) / 24));
  if (!alpha) return;
  const horizontal = X - x >= Y - y;
  const inset = Math.min(X - x, Y - y) / 2;
  const a: LocalPoint = horizontal
    ? [x + inset, (y + Y) / 2]
    : [(x + X) / 2, y + inset];
  const b: LocalPoint = horizontal
    ? [X - inset, (y + Y) / 2]
    : [(x + X) / 2, Y - inset];
  const corners: LocalPoint[] = [
    [x, y],
    [X, y],
    [X, Y],
    [x, Y],
  ];
  const peaks = horizontal ? [a, b, b, a] : [a, a, b, b];
  c.save();
  c.clip(path, "evenodd");
  c.translate(house.transform.x, house.transform.y);
  c.rotate(house.transform.angle);
  c.scale(5, 5);
  c.globalAlpha *= alpha;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // Light comes from map northwest, independent of a building's rotation.
    const normal = house.transform.angle + ((i - 1) * Math.PI) / 2;
    const light = Math.cos(normal + (Math.PI * 3) / 4);
    c.fillStyle =
      light > 0
        ? `rgba(255,240,204,${light * 0.15})`
        : `rgba(49,39,31,${-light * 0.18})`;
    c.beginPath();
    c.moveTo(corners[i][0], corners[i][1]);
    c.lineTo(corners[j][0], corners[j][1]);
    c.lineTo(peaks[j][0], peaks[j][1]);
    c.lineTo(peaks[i][0], peaks[i][1]);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    c.moveTo(corners[i][0], corners[i][1]);
    c.lineTo(peaks[i][0], peaks[i][1]);
  }
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.strokeStyle = "#51463999";
  c.lineWidth = 0.8 / (5 * scale);
  c.lineJoin = "round";
  c.stroke();
  c.restore();
}
