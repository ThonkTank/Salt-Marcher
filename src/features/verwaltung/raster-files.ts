export type RasterFileFormat = "png" | "jpeg" | "webp";

export interface RasterFileOptions {
  readonly format: RasterFileFormat;
  /** Browser encoder quality in the inclusive range 0–1; JPEG and WEBP only. */
  readonly quality?: number;
}

export interface EncodedRasterFile {
  readonly format: RasterFileFormat;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly blob: Blob;
  readonly widthPixels: number;
  readonly heightPixels: number;
}

const MIME_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const;

/**
 * Encode an already finished canvas without drawing, cropping or resizing it.
 * Chromium may silently fall back to PNG for an unavailable type, so the Blob
 * MIME is checked before the caller can save it as the requested file format.
 */
export async function encodeRasterFile(
  canvas: HTMLCanvasElement,
  options: RasterFileOptions,
): Promise<EncodedRasterFile> {
  const format = options?.format;
  if (!Object.prototype.hasOwnProperty.call(MIME_TYPES, format))
    throw new TypeError("Unbekanntes Rasterformat.");
  const mimeType = MIME_TYPES[format];
  const quality = options.quality;
  if (quality !== undefined) {
    if (format === "png")
      throw new RangeError("PNG unterstützt keine Qualitätsangabe.");
    if (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0 || quality > 1)
      throw new RangeError("Qualität muss zwischen 0 und 1 liegen.");
  }
  const widthPixels = canvas?.width;
  const heightPixels = canvas?.height;
  if (
    !Number.isSafeInteger(widthPixels) || widthPixels <= 0 ||
    !Number.isSafeInteger(heightPixels) || heightPixels <= 0
  ) throw new RangeError("Die Zeichenfläche muss positive Pixelabmessungen haben.");
  if (typeof canvas.toBlob !== "function")
    throw new TypeError("Die Zeichenfläche unterstützt keinen Blob-Export.");

  let blob: Blob | null;
  try {
    blob = await new Promise<Blob | null>((resolve, reject) => {
      try {
        canvas.toBlob(resolve, mimeType, quality);
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    throw new Error(`Die Zeichenfläche konnte nicht als ${format.toUpperCase()} exportiert werden.`,
      { cause: error });
  }
  if (canvas.width !== widthPixels || canvas.height !== heightPixels)
    throw new Error("Die Zeichenfläche wurde während des Exports verändert.");
  if (!blob || blob.size === 0)
    throw new Error(`Chromium hat keine ${format.toUpperCase()}-Bilddaten erzeugt.`);
  if (blob.type.toLowerCase() !== mimeType)
    throw new Error(`Chromium hat ${blob.type || "kein Bildformat"} statt ${mimeType} erzeugt.`);

  return { format, mimeType, blob, widthPixels, heightPixels };
}
