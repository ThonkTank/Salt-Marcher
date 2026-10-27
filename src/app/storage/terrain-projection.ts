import { brushPreviewRecords } from '../atlas/atlas-brush-preview';
import { type LandscapeBox, type LandscapeRecord } from '../atlas/atlas-landscape';
import type { AtlasRegionSource } from '../atlas/atlas-region-contracts';
import { bounds } from '../atlas/landscape-geometry';
import { heightBrushBounds } from '../atlas/terrain-brush';
import { terrainDetailDimensions } from '../atlas/terrain-detail';
import { TerrainSampler } from '../atlas/terrain-height';
import { resolveTerrainObjects, terrainObjectPoints } from '../atlas/terrain-objects';
import {
  validateTerrainProjection,
  type TerrainProjection,
  type TerrainProjectionRequest,
} from '../atlas/terrain-projection';
import type { TerrainProjectionCache } from '../atlas/terrain-projection-cache';
import { gridHeight } from '../atlas/terrain-spatial-model';
import { terrainTraceMeasure, terrainTraceStart } from '../atlas/terrain-timing';
import {
  readTerrainSettings,
  renderTerrainColor,
  terrainColorRoutes,
  type ProjectionStream,
} from './terrain-color-raster';
import { readTerrainGrid, readTerrainGridSteps } from './terrain-grid';
import { readRouteTerrain } from './terrain-route';

export type { ProjectionStream } from './terrain-color-raster';
const overlap = (r: LandscapeRecord, b: LandscapeBox) => {
  const a = bounds(r);
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
};
/** Bounded display projection on the readonly worker. Draft edits read only local author records. */
export function readTerrainProjection(
  db: any,
  source: AtlasRegionSource,
  q: TerrainProjectionRequest,
  records: ProjectionStream,
  cache?: TerrainProjectionCache,
): TerrainProjection {
  const edge =
    !cache || q.heightStroke || q.color
      ? Math.max(q.width, q.height, q.detailResolution ?? 256)
      : 512;
  const steps = readTerrainProjectionSteps(db, source, q, records, cache, edge, 65536);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
/** Each yield occurs after complete SQL reads and cache writes. The worker may
 * release its WAL snapshot here and must revalidate the source before resuming. */
export function* readTerrainProjectionSteps(
  db: any,
  source: AtlasRegionSource,
  q: TerrainProjectionRequest,
  records: ProjectionStream,
  cache?: TerrainProjectionCache,
  batchEdge = 64,
  gridSamples = 4096,
): Generator<void, TerrainProjection> {
  let sliceStart = performance.now();
  function* checkpoint() {
    if (performance.now() - sliceStart >= 8) {
      yield;
      sliceStart = performance.now();
    }
  }
  validateTerrainProjection(q);
  if (q.revision !== source.revision || (q.fence !== undefined && q.fence !== source.fence))
    throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
  const settings = readTerrainSettings(db, source.campaignId);
  let stream = records,
    protectedLimit: number | undefined,
    heightM: number | undefined;
  const draft = !!(q.heightStroke || q.color);
  if (draft) cache = undefined;
  let local: LandscapeRecord[] | undefined;
  if (draft) {
    const area = q.heightStroke
      ? heightBrushBounds({ ...q.heightStroke, visibility: undefined })
      : bounds(q.color!);
    const original = readRouteTerrain(db, source.campaignId, area, true),
      visibility = q.heightStroke?.visibility ?? q.color?.paint?.visibility;
    const grid = visibility
      ? readTerrainGrid(db, source.campaignId, visibility, records)
      : undefined;
    local = brushPreviewRecords(
      {
        generation: 0,
        box: area,
        width: q.width,
        height: q.height,
        records: original,
        heightStroke: q.heightStroke,
        color: q.color,
      },
      (f) => {
        protectedLimit = f;
      },
      grid,
    );
    const before = new Map(original.map((r) => [r.id, JSON.stringify(r)])),
      changed = local.filter((r) => before.get(r.id) !== JSON.stringify(r)),
      ids = new Set(changed.map((r) => r.id));
    const kind = (r: LandscapeRecord) =>
      r.height
        ? 'height'
        : r.route
          ? 'route'
          : r.paint
            ? 'color'
            : r.vegetation
              ? 'cover'
              : r.surface === 'freshwater'
                ? 'lake'
                : 'base';
    stream = function* (k, b, samples) {
      const updates = changed
        .filter(
          (r) =>
            !r.terrainSettings &&
            (k === 'line' ? r.kind === 'road' || r.kind === 'river' : kind(r) === k) &&
            overlap(r, b),
        )
        .sort((a, b) => b.resolution - a.resolution || (a.order ?? 0) - (b.order ?? 0));
      let index = 0;
      for (const r of records(k, b, samples)) {
        if (ids.has(r.id)) continue;
        // Height levels must stay coarse-to-fine. Pigment updates are appended above the saved layers.
        if (k !== 'color')
          while (index < updates.length && updates[index]!.resolution >= r.resolution)
            yield updates[index++]!;
        yield r;
      }
      while (index < updates.length) yield updates[index++]!;
    };
    const p = q.heightStroke?.samples.at(-1);
    if (p) heightM = new TerrainSampler(local).sample(p).heightM;
  }
  const view = draft ? { ...q.view, columns: 97, rows: 97 } : q.view,
    endGrid = terrainTraceStart('projection.grid', source.revision);
  let grid: TerrainProjection['grid'];
  try {
    grid = yield* readTerrainGridSteps(
      db,
      source.campaignId,
      view,
      checkpoint,
      stream,
      cache,
      gridSamples,
    );
  } finally {
    endGrid();
  }
  if (!draft)
    grid.view = {
      ...view,
      focusM: gridHeight(grid, {
        x: view.frame.x + view.frame.width / 2,
        y: view.frame.y + view.frame.height / 2,
      }),
    };
  yield* checkpoint();
  const { routes, denseRoutes, retainedRoutes } = terrainColorRoutes(
    stream,
    view.box,
    view.refinement,
  );
  // Live textures repeatedly sample a wide halo after small edits.
  // Retain those small numerical fields; fine tiles must not crowd their pixels
  // out of the shared cache with disposable sampling arrays.
  function* render(area: LandscapeBox, width: number, height: number, displayMpp: number) {
    const forest = new Uint8Array(width * height);
    const pixels = yield* renderTerrainColor(area, width, height, displayMpp, {
      settings,
      stream,
      cache,
      forest,
      batchEdge,
      retainField: Math.max(width, height) <= 64,
      contours: q.contours,
      revision: source.revision,
      denseRoutes,
      retainedRoutes,
      checkpoint,
    });
    return { pixels, forest };
  }
  const { pixels, forest } = yield* render(view.box, q.width, q.height, q.displayMpp);
  const size = q.detail && terrainDetailDimensions(q.detail, q.detailResolution);
  const detail =
    q.detail && size
      ? {
          box: q.detail,
          ...size,
          ...(yield* render(
            q.detail,
            size.width,
            size.height,
            Math.min(
              q.displayMpp,
              Math.max(q.detail.width / size.width, q.detail.height / size.height),
            ),
          )),
        }
      : undefined;
  const objects: TerrainProjection['objects'] = [];
  for (const o of q.objects ?? []) {
    objects.push(
      ...terrainTraceMeasure(
        'projection.objects',
        () => {
          const p = terrainObjectPoints(o),
            x = Math.min(...p.map((p) => p.x)),
            y = Math.min(...p.map((p) => p.y)),
            right = Math.max(...p.map((p) => p.x)),
            bottom = Math.max(...p.map((p) => p.y));
          const terrain = readRouteTerrain(db, source.campaignId, {
            x: x - 1,
            y: y - 1,
            width: right - x + 2,
            height: bottom - y + 2,
          });
          if (local) {
            const ids = new Set(local.map((r) => r.id));
            return resolveTerrainObjects([o], [...terrain.filter((r) => !ids.has(r.id)), ...local]);
          }
          return resolveTerrainObjects([o], terrain);
        },
        source.revision,
      ),
    );
    yield* checkpoint();
  }
  return {
    revision: source.revision,
    fence: source.fence,
    generation: 0,
    source: source.fence,
    grid,
    pixels,
    forest,
    detail,
    width: q.width,
    height: q.height,
    draft,
    objects,
    routes,
    rasterRouteKey: JSON.stringify(denseRoutes ? [...retainedRoutes] : null),
    protectedLimit,
    heightM,
    landColor: settings.terrainSettings!.style?.land,
    contourInk: settings.terrainSettings!.style?.ink,
  };
}
