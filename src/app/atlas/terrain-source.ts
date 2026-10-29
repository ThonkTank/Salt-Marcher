/** Source contracts shared by the worker and restricted preload API. */
export interface TerrainIdentity {
  revision: number;
  fence: string;
}
export interface TerrainInvalidation {
  // Keep this structural box independent of landscape render/model imports.
  bounds: { x: number; y: number; width: number; height: number }[];
  reset: boolean;
}
export interface TerrainColorChange {
  base: TerrainIdentity;
  invalidation: TerrainInvalidation;
}
/** Worker-validated interval; both endpoints must match the retained product. */
export interface TerrainSourceChange extends TerrainColorChange {
  target: TerrainIdentity;
}
