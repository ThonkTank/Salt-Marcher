import type { Light } from "../../model";

/** Coordinates in exported grid fields, not PNG pixels. */
export interface UniversalVttPoint {
  readonly x: number;
  readonly y: number;
}

export interface UniversalVttPortal {
  readonly position: UniversalVttPoint;
  readonly bounds: readonly [UniversalVttPoint, UniversalVttPoint];
  readonly rotation: number;
  readonly closed: boolean;
  readonly freestanding: boolean;
}

export interface UniversalVttLight {
  readonly position: UniversalVttPoint;
  readonly range: number;
  readonly intensity: number;
  /** Eight native ARGB hexadecimal digits. */
  readonly color: string;
  readonly shadows: boolean;
}

/**
 * The 1.2.0.1 fixture proves LOS paths, wall-bound portals and light records.
 * Object LOS remains empty in both measured exports and is rejected if nonempty.
 * The measured wall path is split around one portal; the rule for converting
 * arbitrary editor walls and doors into these paths/bounds remains unmeasured.
 * Callers must therefore supply already computed grid-coordinate paths and
 * portal records. Freestanding portals and other baked-lighting values are
 * also outside the measured cases.
 */
export interface UniversalVtt03Input {
  readonly renderedPngDataUrl: string;
  readonly mapWidthFields: number;
  readonly mapHeightFields: number;
  readonly pixelsPerGrid: number;
  readonly lineOfSightSegments: readonly (readonly UniversalVttPoint[])[];
  readonly objectLineOfSightSegments: readonly unknown[];
  readonly portals: readonly UniversalVttPortal[];
  readonly lights: readonly UniversalVttLight[];
  /** Eight hexadecimal digits, preserved as a value without assuming channel order. */
  readonly ambientLightHex: string;
}

const PNG_PREFIX = "data:image/png;base64,";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new RangeError(`${name} muss eine positive ganze Zahl sein.`);
}

function emptyNativeArray(value: readonly unknown[], name: string): void {
  if (!Array.isArray(value)) throw new TypeError(`${name} muss ein Array sein.`);
  if (value.length !== 0)
    throw new Error(`${name}: Die native Datenform ist noch nicht belegt.`);
}

function finiteNumber(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${name} muss endlich sein.`);
}

function nativePoint(value: UniversalVttPoint, name: string): UniversalVttPoint {
  if (value === null || typeof value !== "object")
    throw new TypeError(`${name} muss ein Punkt sein.`);
  finiteNumber(value.x, `${name}.x`);
  finiteNumber(value.y, `${name}.y`);
  return { x: value.x, y: value.y };
}

function nativeLineOfSight(paths: UniversalVtt03Input["lineOfSightSegments"]): UniversalVttPoint[][] {
  if (!Array.isArray(paths)) throw new TypeError("line_of_sight muss ein Array sein.");
  return paths.map((path, pathIndex) => {
    if (!Array.isArray(path) || path.length < 2)
      throw new TypeError(`line_of_sight[${pathIndex}] braucht mindestens zwei Punkte.`);
    return path.map((point, pointIndex) =>
      nativePoint(point, `line_of_sight[${pathIndex}][${pointIndex}]`));
  });
}

function nativePortals(portals: UniversalVtt03Input["portals"]): UniversalVttPortal[] {
  if (!Array.isArray(portals)) throw new TypeError("portals muss ein Array sein.");
  return portals.map((portal, index) => {
    if (portal === null || typeof portal !== "object")
      throw new TypeError(`portals[${index}] muss ein Portal sein.`);
    if (!Array.isArray(portal.bounds) || portal.bounds.length !== 2)
      throw new TypeError(`portals[${index}].bounds braucht zwei Punkte.`);
    finiteNumber(portal.rotation, `portals[${index}].rotation`);
    if (typeof portal.closed !== "boolean" || typeof portal.freestanding !== "boolean")
      throw new TypeError(`portals[${index}] braucht zwei boolesche Zustände.`);
    return {
      position: nativePoint(portal.position, `portals[${index}].position`),
      bounds: [
        nativePoint(portal.bounds[0]!, `portals[${index}].bounds[0]`),
        nativePoint(portal.bounds[1]!, `portals[${index}].bounds[1]`),
      ],
      rotation: portal.rotation,
      closed: portal.closed,
      freestanding: portal.freestanding,
    };
  });
}

function nativeLights(lights: UniversalVtt03Input["lights"]): UniversalVttLight[] {
  if (!Array.isArray(lights)) throw new TypeError("lights muss ein Array sein.");
  return lights.map((light, index) => {
    if (light === null || typeof light !== "object")
      throw new TypeError(`lights[${index}] muss ein Licht sein.`);
    finiteNumber(light.range, `lights[${index}].range`);
    finiteNumber(light.intensity, `lights[${index}].intensity`);
    if (light.range <= 0 || light.intensity < 0)
      throw new RangeError(`lights[${index}] hat ungültige Reichweite oder Stärke.`);
    if (typeof light.color !== "string" || !/^[0-9a-f]{8}$/i.test(light.color))
      throw new TypeError(`lights[${index}].color muss acht Hexadezimalstellen haben.`);
    if (typeof light.shadows !== "boolean")
      throw new TypeError(`lights[${index}].shadows muss boolesch sein.`);
    return {
      position: nativePoint(light.position, `lights[${index}].position`),
      range: light.range,
      intensity: light.intensity,
      color: light.color.toLowerCase(),
      shadows: light.shadows,
    };
  });
}

/**
 * Direct mapping supported by the native light fixture: its source position
 * 1024,728 at 256 px/grid becomes VTT 4,2.84375; all other shown values are
 * copied unchanged, with an opaque prefix for the editor's RGB-only color.
 */
export function universalVttLightFromMapLight(
  light: Pick<Light, "x" | "y" | "radius" | "intensity" | "color" | "shadows">,
): UniversalVttLight {
  if (!Number.isInteger(light.color) || light.color < 0 || light.color > 0xffffff)
    throw new RangeError("Kartenlichtfarbe muss 24-Bit-RGB sein.");
  const mapped: UniversalVttLight = {
    position: { x: light.x, y: light.y },
    range: light.radius,
    intensity: light.intensity,
    color: `ff${light.color.toString(16).padStart(6, "0")}`,
    shadows: light.shadows,
  };
  return nativeLights([mapped])[0]!;
}

function pngDimensions(dataUrl: string): { width: number; height: number; base64: string } {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PNG_PREFIX))
    throw new TypeError("Ein gerendertes PNG als Data-URL ist erforderlich.");
  const base64 = dataUrl.slice(PNG_PREFIX.length);
  const firstPadding = base64.indexOf("=");
  const payloadEnd = firstPadding < 0 ? base64.length : firstPadding;
  const paddingLength = base64.length - payloadEnd;
  if (
    base64.length < 44 || base64.length % 4 !== 0 ||
    paddingLength > 2 ||
    (paddingLength !== 0 && payloadEnd % 4 !== 4 - paddingLength) ||
    /[^A-Za-z0-9+/]/.test(base64.slice(0, payloadEnd)) ||
    !/^=*$/.test(base64.slice(payloadEnd))
  ) throw new TypeError("Ungültige Base64-Daten des PNG.");

  // The PNG signature and IHDR dimensions suffice here; PNG decoding belongs to
  // the renderer that supplied the Data-URL. Avoid decoding a large export twice.
  const header = atob(base64.slice(0, 44));
  for (let index = 0; index < PNG_SIGNATURE.length; index++) {
    if (header.charCodeAt(index) !== PNG_SIGNATURE[index])
      throw new TypeError("Die Data-URL enthält kein PNG.");
  }
  if (
    header.charCodeAt(8) !== 0 || header.charCodeAt(9) !== 0 ||
    header.charCodeAt(10) !== 0 || header.charCodeAt(11) !== 13 ||
    header.slice(12, 16) !== "IHDR"
  ) throw new TypeError("Der PNG-IHDR fehlt.");
  const uint32 = (offset: number): number =>
    ((header.charCodeAt(offset) * 0x1000000) +
      (header.charCodeAt(offset + 1) << 16) +
      (header.charCodeAt(offset + 2) << 8) +
      header.charCodeAt(offset + 3)) >>> 0;
  return { width: uint32(16), height: uint32(20), base64 };
}

/** Serialize the directly measured Universal VTT 0.3 envelope and record shapes. */
export function serializeUniversalVtt03(input: UniversalVtt03Input): string {
  positiveInteger(input.mapWidthFields, "Kartenbreite");
  positiveInteger(input.mapHeightFields, "Kartenhöhe");
  positiveInteger(input.pixelsPerGrid, "Pixel je Feld");
  const widthPixels = input.mapWidthFields * input.pixelsPerGrid;
  const heightPixels = input.mapHeightFields * input.pixelsPerGrid;
  if (
    !Number.isSafeInteger(widthPixels) || !Number.isSafeInteger(heightPixels) ||
    widthPixels > 0xffffffff || heightPixels > 0xffffffff
  ) throw new RangeError("Die berechnete PNG-Größe ist ungültig.");
  const lineOfSight = nativeLineOfSight(input.lineOfSightSegments);
  emptyNativeArray(input.objectLineOfSightSegments, "objects_line_of_sight");
  const portals = nativePortals(input.portals);
  const lights = nativeLights(input.lights);
  if (typeof input.ambientLightHex !== "string" || !/^[0-9a-f]{8}$/i.test(input.ambientLightHex))
    throw new TypeError("Umgebungswert muss acht Hexadezimalstellen haben.");
  const png = pngDimensions(input.renderedPngDataUrl);
  if (png.width !== widthPixels || png.height !== heightPixels)
    throw new RangeError("PNG-Abmessungen passen nicht zu Karte und Feldpixelzahl.");

  return JSON.stringify({
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: input.mapWidthFields, y: input.mapHeightFields },
      pixels_per_grid: input.pixelsPerGrid,
    },
    line_of_sight: lineOfSight,
    objects_line_of_sight: [],
    portals,
    environment: {
      baked_lighting: true,
      ambient_light: input.ambientLightHex.toLowerCase(),
    },
    lights,
    image: png.base64,
  }, null, 2) + "\n";
}
