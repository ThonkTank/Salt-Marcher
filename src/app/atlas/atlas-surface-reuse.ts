import { CHANNEL_NAMES } from './terrain-material';
import type { AtlasSurfaceTile } from './atlas-surface-tile-stream';
function same(a: Uint8Array | Float32Array | undefined, b: typeof a) {
  if (a === b) return true;
  if (!a || !b || a.byteLength !== b.byteLength) return false;
  const aa = new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
    bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}
/** Adopt the new validated identity while retaining byte-identical display
 * buffers. A canonical receipt must not rebuild every unchanged world tile. */
export function reuseAtlasSurfaceTile(
  previous: AtlasSurfaceTile | undefined,
  next: AtlasSurfaceTile,
): AtlasSurfaceTile {
  if (
    !previous ||
    ['lod', 'x', 'y'].some(
      (k) =>
        previous.tile[k as keyof typeof previous.tile] !== next.tile[k as keyof typeof next.tile],
    )
  )
    return next;
  const a = previous.terrain.projection.grid,
    b = next.terrain.projection.grid;
  const grid =
    a.seaLevelM === b.seaLevelM &&
    JSON.stringify(a.view) === JSON.stringify(b.view) &&
    same(a.heights, b.heights) &&
    same(a.editing?.ground, b.editing?.ground) &&
    same(a.editing?.water, b.editing?.water)
      ? a
      : b;
  const channels = { ...next.material.channels };
  for (const c of CHANNEL_NAMES)
    if (channels[c] && same(previous.material.channels[c], channels[c]))
      channels[c] = previous.material.channels[c]!;
  return {
    ...next,
    terrain: { ...next.terrain, projection: { ...next.terrain.projection, grid } },
    material: { ...next.material, channels },
  };
}
