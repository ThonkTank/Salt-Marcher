/** Dungeondraft 1.2.0.1 ExportWindow grid presets, in native dropdown order. */
export const GRID_PRESETS = [
  { id: "custom", label: "Custom", ppi: null },
  { id: "best-quality", label: "Best Quality", ppi: 256 },
  { id: "optimal-halved", label: "Optimal Halved", ppi: 128 },
  { id: "commercial-print", label: "Commercial Print", ppi: 300 },
  { id: "roll-20", label: "Roll 20", ppi: 70 },
  { id: "40-inch-tv", label: '40" TV', ppi: 54 },
  { id: "55-inch-tv", label: '55" TV', ppi: 80 },
] as const;

export type GridPresetId = (typeof GRID_PRESETS)[number]["id"];

export interface GridPresetState {
  presetId: GridPresetId;
  pixelsPerCell: number;
}

export interface FieldSize {
  width: number;
  height: number;
}

/** PCK ExportWindow.tscn: GridPPISpinBox has min 16, max 300, rounded true. */
export const GRID_PPI_RANGE = { min: 16, max: 300 } as const;

function validControlPpi(ppi: number): boolean {
  return Number.isFinite(ppi) && ppi >= GRID_PPI_RANGE.min &&
    ppi <= GRID_PPI_RANGE.max;
}

/** Native preset index 0 (Custom) preserves the current PPI field value. */
export function selectGridPreset(
  presetId: string,
  currentPpi: number,
): GridPresetState | null {
  const preset = GRID_PRESETS.find(({ id }) => id === presetId);
  if (!preset || !validControlPpi(currentPpi)) return null;
  return { presetId: preset.id, pixelsPerCell: preset.ppi ?? currentPpi };
}

/** Native OnPPIChange switches the dropdown to Custom after a manual edit. */
export function setManualGridPpi(ppi: number): GridPresetState | null {
  return validControlPpi(ppi)
    ? { presetId: "custom", pixelsPerCell: ppi } : null;
}

/**
 * Native GetOutputResolution rounds PPI, and rounds crop dimensions in fields
 * before multiplying. The caller must separately validate crop position/bounds.
 * Godot's exact half-way tie rule is not established here, so such inputs are
 * left open rather than claiming an unverified pixel dimension.
 */
export function gridOutputDimensions(
  mapFields: FieldSize,
  ppi: number,
  cropFields: FieldSize | null = null,
): FieldSize | null {
  if (!validControlPpi(ppi) || !Number.isSafeInteger(mapFields.width) ||
    !Number.isSafeInteger(mapFields.height) ||
    mapFields.width <= 0 || mapFields.height <= 0) return null;
  const fields = cropFields ?? mapFields;
  if (!Number.isFinite(fields.width) || !Number.isFinite(fields.height) ||
    fields.width <= 0 || fields.height <= 0 ||
    (cropFields && (fields.width > mapFields.width ||
      fields.height > mapFields.height))) return null;
  const values = [ppi, ...(cropFields ? [fields.width, fields.height] : [])];
  if (values.some((value) => value % 1 === 0.5)) return null;
  const roundedPpi = Math.round(ppi);
  const width = Math.round(fields.width) * roundedPpi;
  const height = Math.round(fields.height) * roundedPpi;
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) &&
    width > 0 && height > 0 ? { width, height } : null;
}
