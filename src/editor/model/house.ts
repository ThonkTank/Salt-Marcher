import { WORLD_LIMIT, type Bounds, type Point } from "./types";

/** Header authors only. Interior cells and derived foundations are separate data. */
export interface HouseHeader {
  id: string;
  revision: number;
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Clockwise degrees in the editor's downward-positive world Y axis. */
  rotation: number;
  foundationHeight: number;
  foundationTransition: number;
}

export interface HousePatch {
  key: string;
  before: HouseHeader | null;
  after: HouseHeader | null;
}

/** Conservative logical payload charge, including the bounded UTF-16 identity. */
export const HOUSE_HEADER_BYTES = 512;
export const HOUSE_MAX_REGION_HEADERS = 4096;

export function houseKey(id: string): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id))
    throw new RangeError("Ungültige Hausidentität.");
  return `house:${id}`;
}

export function parseHouseKey(key: string): string {
  if (typeof key !== "string" || !key.startsWith("house:"))
    throw new RangeError("Ungültiger Hausschlüssel.");
  const id = key.slice(6);
  if (houseKey(id) !== key)
    throw new RangeError("Nichtkanonischer Hausschlüssel.");
  return id;
}

function orientation(rotation: number): [number, number] {
  const angle = (rotation * Math.PI) / 180;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  // Cardinal rotations retain exact axis-aligned world-edge ownership.
  return [
    Math.abs(cosine) < 1e-15 ? 0 : cosine,
    Math.abs(sine) < 1e-15 ? 0 : sine,
  ];
}

/** Four geometric footprint corners; foundation transition is not ownership. */
export function houseCorners(header: HouseHeader): Point[] {
  const [cosine, sine] = orientation(header.rotation);
  return [
    [-header.width / 2, -header.depth / 2],
    [header.width / 2, -header.depth / 2],
    [header.width / 2, header.depth / 2],
    [-header.width / 2, header.depth / 2],
  ].map(([x, y]) => [
    header.x + x * cosine - y * sine,
    header.y + x * sine + y * cosine,
  ]);
}

export function houseBounds(header: HouseHeader): Bounds {
  const corners = houseCorners(header);
  return [
    Math.min(...corners.map(([x]) => x)),
    Math.min(...corners.map(([, y]) => y)),
    Math.max(...corners.map(([x]) => x)),
    Math.max(...corners.map(([, y]) => y)),
  ];
}

/** Exact oriented rectangle selection rather than its larger spatial-index box. */
export function houseContainsPoint(header: HouseHeader, point: Point): boolean {
  const [cosine, sine] = orientation(header.rotation);
  const dx = point[0] - header.x,
    dy = point[1] - header.y;
  const tolerance =
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(header.x),
      Math.abs(header.y),
      header.width,
      header.depth,
    ) *
    8;
  return (
    Math.abs(dx * cosine + dy * sine) <= header.width / 2 + tolerance &&
    Math.abs(-dx * sine + dy * cosine) <= header.depth / 2 + tolerance
  );
}

export function validateHouseHeader(header: HouseHeader): void {
  if (!header || typeof header !== "object")
    throw new RangeError("Ungültiger Hausheader.");
  houseKey(header.id);
  if (
    !Number.isSafeInteger(header.revision) ||
    header.revision < 0 ||
    ![
      header.x,
      header.y,
      header.width,
      header.depth,
      header.rotation,
      header.foundationHeight,
      header.foundationTransition,
    ].every(Number.isFinite) ||
    header.width <= 0 ||
    header.width > 10_000 ||
    header.depth <= 0 ||
    header.depth > 10_000 ||
    header.rotation < 0 ||
    header.rotation >= 360 ||
    header.foundationHeight < 0 ||
    header.foundationHeight > 100 ||
    header.foundationTransition < 0 ||
    header.foundationTransition > 500
  )
    throw new RangeError("Ungültige Hauspose oder Fundamenteinstellung.");
  const bounds = houseBounds(header);
  if (
    bounds.some(
      (value) => !Number.isFinite(value) || Math.abs(value) > WORLD_LIMIT,
    ) ||
    bounds[0] >= bounds[2] ||
    bounds[1] >= bounds[3]
  )
    throw new RangeError("Die Hausgrundfläche liegt außerhalb der Atlaswelt.");
}

/** Copy only the closed validated author payload, never unknown attached data. */
export function cloneHouseHeader(header: HouseHeader): HouseHeader {
  return {
    id: header.id,
    revision: header.revision,
    x: header.x,
    y: header.y,
    width: header.width,
    depth: header.depth,
    rotation: header.rotation,
    foundationHeight: header.foundationHeight,
    foundationTransition: header.foundationTransition,
  };
}

/** Runtime revision is not a semantic edit; Undo can restore identical authors. */
export function sameHouseAuthors(
  a: HouseHeader | null,
  b: HouseHeader | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.id === b.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.depth === b.depth &&
    a.rotation === b.rotation &&
    a.foundationHeight === b.foundationHeight &&
    a.foundationTransition === b.foundationTransition
  );
}
