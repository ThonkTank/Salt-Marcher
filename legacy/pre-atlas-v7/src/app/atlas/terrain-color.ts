import type { LandscapeBox } from './landscape-bounds';
import type { TerrainDetail } from './terrain-detail';
/** Derived colour only. No heights, object payloads or author writes cross this boundary. */
export interface TerrainColorRequest {
  box: LandscapeBox;
  routeContext: LandscapeBox;
  routeFocus?: LandscapeBox;
  width: number;
  height: number;
  displayMpp: number;
  contours: number;
  revision: number;
  fence?: string;
}
export interface TerrainColorTile extends TerrainDetail {
  revision: number;
  fence: string;
}
export function validateTerrainColor(q: TerrainColorRequest) {
  const box = (b: LandscapeBox) =>
    b &&
    [b.x, b.y, b.width, b.height, b.x + b.width, b.y + b.height].every(
      (n) => Number.isFinite(n) && Math.abs(n) <= 1e12,
    ) &&
    b.width > 0 &&
    b.height > 0 &&
    Object.keys(b).every((k) => ['x', 'y', 'width', 'height'].includes(k));
  if (
    !q ||
    !box(q.box) ||
    !box(q.routeContext) ||
    (q.routeFocus !== undefined && !box(q.routeFocus)) ||
    ![q.width, q.height].every((n) => Number.isInteger(n) && n >= 16 && n <= 256) ||
    !Number.isFinite(q.displayMpp) ||
    q.displayMpp <= 0 ||
    !Number.isFinite(q.contours) ||
    (q.contours < 0 && q.contours !== -1) ||
    q.contours > 100000 ||
    !Number.isSafeInteger(q.revision) ||
    q.revision < 0 ||
    (q.fence !== undefined && typeof q.fence !== 'string') ||
    Object.keys(q).some(
      (k) =>
        ![
          'box',
          'routeContext',
          'routeFocus',
          'width',
          'height',
          'displayMpp',
          'contours',
          'revision',
          'fence',
        ].includes(k),
    )
  )
    throw Error('Geländefarbe prüfen.');
}
