import { terrainChannelStride } from './terrain-material';
import {
  COVER_CHANNEL_NAMES,
  type TerrainCoverChannel,
  type TerrainMaterialRaster,
} from './terrain-material';
/** Reduce at most 16 display rows directly from the source lattice.
 * The caller yields between blocks. Alpha weighting precedes byte rounding;
 * water topology retains the individual samples needed by channel caching. */
export function reduceAtlasMaterialRows(
  input: {
    samples: Uint8Array;
    water: Uint8Array;
    forest?: Uint8Array;
    covers?: Partial<Record<TerrainCoverChannel, Uint8Array>>;
    stride: number;
    left: number;
    top: number;
    width: number;
    rows: number;
    scale: number;
  },
  channels: TerrainMaterialRaster,
  outputRow: number,
) {
  const { samples, water, forest, stride, left, top, width, rows, scale } = input;
  if (
    ![width, rows, scale, stride, left, top, outputRow].every(Number.isSafeInteger) ||
    width < 1 ||
    width > 1024 ||
    rows < 1 ||
    rows > 16 ||
    ![2, 4].includes(scale) ||
    left < 0 ||
    top < 0 ||
    outputRow < 0 ||
    left + width * scale > stride ||
    (top + rows * scale) * stride > water.length ||
    samples.length < water.length * 4 ||
    (forest && forest.length < water.length)
  )
    throw Error('Ungültiger begrenzter Materialblock.');
  const end = (outputRow + rows) * width;
  for (const [name, values] of Object.entries(channels)) {
    if (values && values.length < end * terrainChannelStride(name))
      throw Error('Materialausgabe zu klein.');
  }
  const count = scale * scale,
    covers = COVER_CHANNEL_NAMES.filter((c) => channels[c]);
  for (const c of covers)
    if (input.covers?.[c] && input.covers[c]!.length < water.length)
      throw Error('Ungültiger Bewuchskanal.');
  const coverSums = new Float64Array(covers.length);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < width; x++) {
      coverSums.fill(0);
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0,
        wet = 0,
        cover = 0,
        topology = 0;
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const i = (top + y * scale + sy) * stride + left + x * scale + sx,
            a = samples[i * 4 + 3]!;
          alpha += a;
          red += samples[i * 4]! * a;
          green += samples[i * 4 + 1]! * a;
          blue += samples[i * 4 + 2]! * a;
          if (water[i]) {
            wet += 255;
            topology |= 1 << (sy * scale + sx);
          } else {
            cover += forest?.[i] ?? 0;
            for (let c = 0; c < covers.length; c++)
              coverSums[c] = coverSums[c]! + (input.covers?.[covers[c]!]?.[i] ?? 0);
          }
        }
      const out = (outputRow + y) * width + x;
      if (channels.baseColor) {
        channels.baseColor[out * 4] = alpha ? Math.round(red / alpha) : 0;
        channels.baseColor[out * 4 + 1] = alpha ? Math.round(green / alpha) : 0;
        channels.baseColor[out * 4 + 2] = alpha ? Math.round(blue / alpha) : 0;
        channels.baseColor[out * 4 + 3] = Math.round(alpha / count);
      }
      for (let c = 0; c < covers.length; c++)
        channels[covers[c]!]![out] = Math.round(coverSums[c]! / count);
      if (channels.water) channels.water[out] = Math.round(wet / count);
      if (channels.forest) channels.forest[out] = Math.round(cover / count);
      if (channels.waterTopology) channels.waterTopology[out] = topology;
    }
}
