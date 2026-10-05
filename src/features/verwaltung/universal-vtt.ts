/**
 * The measured Dungeondraft 1.2.0.1 export contains only empty geometry arrays.
 * Keep these inputs explicit, but reject nonempty arrays until their native shape
 * and coordinate units have been observed. This avoids producing plausible JSON
 * that a VTT may interpret incorrectly.
 */
export interface UniversalVtt03Input {
  readonly renderedPngDataUrl: string;
  readonly mapWidthFields: number;
  readonly mapHeightFields: number;
  readonly pixelsPerGrid: number;
  readonly lineOfSightSegments: readonly unknown[];
  readonly objectLineOfSightSegments: readonly unknown[];
  readonly portals: readonly unknown[];
  readonly lights: readonly unknown[];
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

/** Serialize only the directly measured, empty-geometry Universal VTT 0.3 case. */
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
  emptyNativeArray(input.lineOfSightSegments, "line_of_sight");
  emptyNativeArray(input.objectLineOfSightSegments, "objects_line_of_sight");
  emptyNativeArray(input.portals, "portals");
  emptyNativeArray(input.lights, "lights");
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
    line_of_sight: [],
    objects_line_of_sight: [],
    portals: [],
    environment: {
      baked_lighting: true,
      ambient_light: input.ambientLightHex.toLowerCase(),
    },
    lights: [],
    image: png.base64,
  }, null, 2) + "\n";
}
