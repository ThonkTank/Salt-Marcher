import type { LandscapeBox } from './landscape-bounds';

export interface TerrainIdentity {
  revision: number;
  fence: string;
}

export interface TerrainFrameIdentity extends TerrainIdentity {
  key: string;
}

export interface TerrainInvalidation {
  bounds: LandscapeBox[];
  reset: boolean;
}

export interface TerrainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerrainPatch<T extends Uint8Array | Float32Array> extends TerrainRect {
  data: T;
}
