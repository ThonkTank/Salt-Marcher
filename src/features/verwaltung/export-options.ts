export type ExportFormat = "png" | "jpeg" | "webp" | "universal-vtt";

export interface ExportRequest {
  format: ExportFormat;
  pixelsPerCell: number;
  includeGrid: boolean;
  includeLighting: boolean;
  /** Present only for options the export callback declares it can apply. */
  advanced?: Partial<ExportAdvancedOptions>;
}

/** Crop coordinates are measured in map fields, independent of export PPI. */
export interface ExportCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportAdvancedOptions {
  sourceLevelId: string;
  sourceLighting: boolean;
  brightnessPercent: number;
  focusPercent: number;
  overlayLevelId: string | null;
  overlayLighting: boolean;
  overlayOpacityPercent: number;
  cameraFilterId: string;
  gridPresetId: string;
  crop: ExportCrop | null;
}

export type ExportAdvancedKey = keyof ExportAdvancedOptions;

export interface ExportChoice {
  id: string;
  label: string;
}

export const exportFormatLabels: Readonly<Record<ExportFormat, string>> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WEBP",
  "universal-vtt": "Universal VTT",
};

export function positivePixelsPerCell(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function nonNegativePercent(raw: string, max?: number): number | null {
  const value = raw.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number >= 0 &&
    (max === undefined || number <= max) ? number : null;
}

export function validExportCrop(crop: ExportCrop, mapSize?: {
  width: number;
  height: number;
}): boolean {
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
    crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0)
    return false;
  return !mapSize || (crop.x + crop.width <= mapSize.width &&
    crop.y + crop.height <= mapSize.height);
}

export function exportPixelDimensions(
  mapSize: { width: number; height: number },
  pixelsPerCell: number,
  crop: ExportCrop | null = null,
): { width: number; height: number } | null {
  if (!Number.isSafeInteger(pixelsPerCell) || pixelsPerCell <= 0 ||
    !Number.isSafeInteger(mapSize.width) || !Number.isSafeInteger(mapSize.height) ||
    mapSize.width <= 0 || mapSize.height <= 0 ||
    (crop && !validExportCrop(crop, mapSize))) return null;
  const width = (crop?.width ?? mapSize.width) * pixelsPerCell,
    height = (crop?.height ?? mapSize.height) * pixelsPerCell;
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    ? { width, height } : null;
}
