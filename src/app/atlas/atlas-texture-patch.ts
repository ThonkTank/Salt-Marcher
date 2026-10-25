export interface AtlasTextureData {
  data: Uint8Array;
  width: number;
  height: number;
}
/** Smallest changed rectangle; compare bytes only when the source buffer changes.
 * An unchanged height pair must never trigger a colour texture upload. */
export function atlasTexturePatch(before: AtlasTextureData, after: AtlasTextureData) {
  if (before.width !== after.width || before.height !== after.height)
    return { x: 0, y: 0, width: after.width, height: after.height };
  if (before.data === after.data) return null;
  let left = after.width,
    right = -1,
    top = after.height,
    bottom = -1;
  for (let y = 0; y < after.height; y++)
    for (let x = 0; x < after.width; x++) {
      const i = (y * after.width + x) * 4;
      if (
        before.data[i] === after.data[i] &&
        before.data[i + 1] === after.data[i + 1] &&
        before.data[i + 2] === after.data[i + 2] &&
        before.data[i + 3] === after.data[i + 3]
      )
        continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return right < left
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
