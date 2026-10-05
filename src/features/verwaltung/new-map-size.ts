/** Directly observed New Map defaults in Dungeondraft 1.2.0.1. */
export const NEW_MAP_DEFAULT_SIZE = { width: 35, height: 20 } as const;

/**
 * The native 0 and 7.5 width probes both created an 8-field map. Preserve
 * larger and invalid inputs until their native rules are measured; document
 * validation still rejects invalid dimensions after this dialog-only step.
 */
export function newMapDialogSize(width: number, height: number): {
  width: number;
  height: number;
} {
  return {
    width: Number.isFinite(width) && width >= 0 && width < 8 ? 8 : width,
    height,
  };
}
