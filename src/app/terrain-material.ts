/** Independently derived, unlit terrain products. Byte channels use 0..255 coverage. */
export const COVER_CHANNEL_NAMES = ['deciduous', 'conifer', 'grass', 'shrub', 'debris'] as const;
export type TerrainCoverChannel = (typeof COVER_CHANNEL_NAMES)[number];
export const SURFACE_CHANNEL_NAMES = [
  'baseColor',
  'water',
  'forest',
  'relief',
  ...COVER_CHANNEL_NAMES,
] as const;
export const CHANNEL_NAMES = [...SURFACE_CHANNEL_NAMES, 'rock', 'snow'] as const;

export type TerrainMaterialChannel = (typeof CHANNEL_NAMES)[number];

/** `baseColor` and `relief` are RGBA; coverage channels use one byte per pixel. */
export interface TerrainMaterialChannels extends Readonly<Record<TerrainCoverChannel, Uint8Array>> {
  /** XYZ physical macro normal (0..255), A convex ridge strength. */
  readonly relief: Uint8Array;
  readonly baseColor: Uint8Array;
  readonly water: Uint8Array;
  readonly forest: Uint8Array;
  readonly rock: Uint8Array;
  readonly snow: Uint8Array;
}

export type PartialTerrainMaterialChannels = {
  -readonly [K in keyof TerrainMaterialChannels]?: TerrainMaterialChannels[K];
};

/** Internal raster result; topology fingerprints the water samples for dependent channels. */
export type TerrainMaterialRaster = PartialTerrainMaterialChannels & {
  waterTopology?: Uint16Array;
};

export const terrainChannelStride = (channel: string) =>
  channel === 'baseColor' || channel === 'relief' ? 4 : 1;

/** Display-only relief support in material texels and curvature contrast. */
export const MACRO_RELIEF_RADIUS = 4;
export const MACRO_RIDGE_GAIN = 24;
