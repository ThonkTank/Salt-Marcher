import type { AtlasPaintCommand } from './atlas-canvas-scene';

export interface AtlasDrawingMesh {
  positions: Float32Array;
  indices: Uint32Array;
  uv?: Float32Array;
  colors?: Float32Array;
  color: [number, number, number, number];
  texture?: CanvasImageSource;
  hitAlpha?: { pixels: Uint8ClampedArray; width: number; height: number };
  command?: AtlasPaintCommand;
  target?: Record<string, string>;
  solid?: boolean;
  publicForestScale?: number;
  billboard?: { anchor: [number, number, number]; offsets: Float32Array };
}
