import { decodeHeights } from '../atlas/terrain-height';
import type { LandscapeBox } from '../atlas/landscape-bounds';
import type { LandscapeRecord } from '../atlas/landscape-contracts';

export function unionTerrainBounds(a: LandscapeBox, b: LandscapeBox): LandscapeBox {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
/** A changed node affects two adjacent cells in each direction, including inherited
 * fine/coarse samples. Unknown metadata changes retain full-row invalidation.
 * This is derived from canonical transaction rows, never from a brush request. */
export function changedHeightBounds(
  before?: LandscapeRecord,
  after?: LandscapeRecord,
): LandscapeBox | undefined {
  const pure = (r: LandscapeRecord) =>
    r.height &&
    r.kind === 'patch' &&
    !r.paint &&
    !r.route &&
    !r.mask &&
    !r.vegetation &&
    !r.terrainSettings &&
    !r.surface &&
    !r.propertyOnly &&
    r.values &&
    Object.keys(r.values).length === 0;
  if ((!before && !after) || (before && !pure(before)) || (after && !pure(after))) return;
  if (before && after) {
    // Pure height tiles have unique aligned addresses and resolution priority;
    // their generic paint order does not alter interpolation.
    const metadata = (r: LandscapeRecord) =>
      JSON.stringify({ ...r, revision: 0, height: { ...r.height, data: '' }, order: 0 });
    if (metadata(before) !== metadata(after)) return;
  }
  try {
    const tile = (after ?? before)!.height!,
      a = before ? decodeHeights(before.height!) : undefined,
      b = after ? decodeHeights(after.height!) : undefined;
    let left = 64,
      top = 64,
      right = -1,
      bottom = -1;
    for (let i = 0; i < 4096; i++) {
      const av = a?.[i] ?? NaN,
        bv = b?.[i] ?? NaN;
      if (av === bv || (Number.isNaN(av) && Number.isNaN(bv))) continue;
      left = Math.min(left, i % 64);
      right = Math.max(right, i % 64);
      top = Math.min(top, Math.floor(i / 64));
      bottom = Math.max(bottom, Math.floor(i / 64));
    }
    if (right < 0) return;
    return {
      x: tile.x + (left - 2) * tile.pixel,
      y: tile.y + (top - 2) * tile.pixel,
      width: (right - left + 4) * tile.pixel,
      height: (bottom - top + 4) * tile.pixel,
    };
  } catch {
    return;
  }
}
