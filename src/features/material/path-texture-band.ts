/** A renderer-independent textured strip in map coordinates. */
export interface PathBandPoint {
  readonly x: number;
  readonly y: number;
}

export interface PathTextureBandInput {
  readonly points: readonly PathBandPoint[];
  /** Full visible strip width, in the same map units as points. */
  readonly width: number;
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly closed?: boolean;
  /** Physical distance covered by one image repeat; default preserves image aspect ratio. */
  readonly repeatLength?: number;
}

export interface PathTextureBand {
  /** Interleaved x,y values; two edge vertices per point. */
  readonly positions: readonly number[];
  /** Interleaved u,v values. U is unwrapped distance/repeatLength; V is 0 or 1. */
  readonly uvs: readonly number[];
  /** Two triangles per segment, indexing the position/UV pairs. */
  readonly indices: readonly number[];
  readonly pathLength: number;
  readonly repeatLength: number;
  /** Fractional U mismatch at a closed seam; zero means the tile phase joins. */
  readonly closurePhase: number | null;
}

const MITER_LIMIT = 4;

function unit(
  a: PathBandPoint,
  b: PathBandPoint,
): { x: number; y: number; length: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0)
    throw new RangeError("Pfadsegment hat keine gültige Länge.");
  return { x: dx / length, y: dy / length, length };
}

function normal(tangent: PathBandPoint): PathBandPoint {
  return { x: -tangent.y, y: tangent.x };
}

function joinNormal(
  previous: PathBandPoint,
  next: PathBandPoint,
): PathBandPoint {
  const before = normal(previous);
  const after = normal(next);
  const sum = { x: before.x + after.x, y: before.y + after.y };
  const length = Math.hypot(sum.x, sum.y);
  if (length < 1e-9)
    throw new RangeError(
      "Eine direkte Pfadumkehr hat keine eindeutige Streifenseite.",
    );
  const bisector = { x: sum.x / length, y: sum.y / length };
  const divisor = bisector.x * after.x + bisector.y * after.y;
  if (divisor <= 0)
    throw new RangeError("Pfadknick kann nicht als Streifen verbunden werden.");
  const scale = Math.min(1 / divisor, MITER_LIMIT);
  return { x: bisector.x * scale, y: bisector.y * scale };
}

/**
 * Builds shared edge vertices at every bend. The U coordinate follows
 * cumulative centre-line length and remains unwrapped across tile boundaries.
 * Image-to-map scale, side orientation and join style are not claimed to be
 * Dungeondraft's native rules; repeatLength can be set after measurement.
 */
export function buildPathTextureBand(
  input: PathTextureBandInput,
): PathTextureBand {
  const { width, textureWidth, textureHeight, closed = false } = input;
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(textureWidth) ||
    textureWidth <= 0 ||
    !Number.isFinite(textureHeight) ||
    textureHeight <= 0
  )
    throw new RangeError(
      "Pfadbreite und Texturmaße müssen positiv und endlich sein.",
    );
  const points: PathBandPoint[] = [];
  for (const point of input.points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new RangeError("Pfadpunkt ist nicht endlich.");
    if (
      !points.length ||
      point.x !== points.at(-1)!.x ||
      point.y !== points.at(-1)!.y
    )
      points.push(point);
  }
  if (
    closed &&
    points.length > 1 &&
    points[0]!.x === points.at(-1)!.x &&
    points[0]!.y === points.at(-1)!.y
  )
    points.pop();
  if (points.length < (closed ? 3 : 2))
    throw new RangeError("Zu wenige verschiedene Pfadpunkte.");
  const repeatLength =
    input.repeatLength ?? (width * textureWidth) / textureHeight;
  if (!Number.isFinite(repeatLength) || repeatLength <= 0)
    throw new RangeError("Ungültige Textur-Wiederholungslänge.");

  const segmentCount = closed ? points.length : points.length - 1;
  const segments = Array.from({ length: segmentCount }, (_, index) =>
    unit(points[index]!, points[(index + 1) % points.length]!),
  );
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let distance = 0;
  for (let index = 0; index < points.length; index++) {
    const previous = segments[(index - 1 + segmentCount) % segmentCount]!;
    const next = segments[index % segmentCount]!;
    const side =
      !closed && index === 0
        ? normal(next)
        : !closed && index === points.length - 1
          ? normal(previous)
          : joinNormal(previous, next);
    const point = points[index]!;
    const offset = width / 2;
    positions.push(
      point.x + side.x * offset,
      point.y + side.y * offset,
      point.x - side.x * offset,
      point.y - side.y * offset,
    );
    const u = distance / repeatLength;
    uvs.push(u, 0, u, 1);
    if (index < segmentCount) distance += segments[index]!.length;
  }
  if (closed) {
    positions.push(...positions.slice(0, 4));
    const u = distance / repeatLength;
    uvs.push(u, 0, u, 1);
  }
  for (let segment = 0; segment < segmentCount; segment++) {
    const a = segment * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const phase = closed ? (distance / repeatLength) % 1 : null;
  return {
    positions,
    uvs,
    indices,
    pathLength: distance,
    repeatLength,
    closurePhase: phase !== null && Math.abs(phase - 1) < 1e-9 ? 0 : phase,
  };
}
