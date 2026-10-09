import {
  decodeTerrainMask, encodeTerrainMask, type TerrainMask,
} from "../../model";

/** Dungeondraft 1.2.0.1: crop discards samples; new samples are red-transparent. */
export function resizeTerrainMasks(
  masks: readonly TerrainMask[], oldWidth: number, oldHeight: number,
  newWidth: number, newHeight: number, left: number, top: number,
): readonly TerrainMask[] {
  const resize = (encoded: string): string => {
    const source = decodeTerrainMask(encoded, oldWidth, oldHeight);
    const target = new Uint8Array(newWidth * newHeight * 64);
    const sourceWidth = oldWidth * 4, sourceHeight = oldHeight * 4;
    const targetWidth = newWidth * 4, targetHeight = newHeight * 4;
    for (let y = 0; y < targetHeight; y++) {
      const fromY = y - top * 4;
      for (let x = 0; x < targetWidth; x++) {
        const fromX = x - left * 4;
        const to = (y * targetWidth + x) * 4;
        if (fromX >= 0 && fromX < sourceWidth && fromY >= 0 && fromY < sourceHeight) {
          const from = (fromY * sourceWidth + fromX) * 4;
          target.set(source.subarray(from, from + 4), to);
        } else target[to] = 255;
      }
    }
    return encodeTerrainMask(target);
  };
  return masks.map((mask) => ({
    floorId: mask.floorId,
    splat: resize(mask.splat),
    ...(mask.splat2 === undefined ? {} : { splat2: resize(mask.splat2) }),
  }));
}
