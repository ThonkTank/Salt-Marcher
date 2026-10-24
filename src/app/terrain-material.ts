/** Independently derived, unlit terrain products. Byte channels use 0..255 coverage. */
export const SURFACE_CHANNEL_NAMES = ['baseColor','water','forest'] as const;
export const CHANNEL_NAMES = ['baseColor', 'water', 'forest', 'rock', 'snow'] as const;

export type TerrainMaterialChannel = typeof CHANNEL_NAMES[number];

/** `baseColor` is RGBA; every other channel is one byte per output pixel. */
export interface TerrainMaterialChannels {
  readonly baseColor: Uint8Array;
  readonly water: Uint8Array;
  readonly forest: Uint8Array;
  readonly rock: Uint8Array;
  readonly snow: Uint8Array;
}

export type PartialTerrainMaterialChannels = {-readonly [K in keyof TerrainMaterialChannels]?:TerrainMaterialChannels[K]};

/** Internal raster result; topology fingerprints the water samples for dependent channels. */
export type TerrainMaterialRaster = PartialTerrainMaterialChannels & {
  waterTopology?: Uint16Array;
};
