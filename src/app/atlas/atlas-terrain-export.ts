import { publicTerrainGrid } from '../runtime/player-terrain';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import { gridHeight, type TerrainView } from './terrain-spatial-model';
import type { AtlasPaint } from './atlas-paint';
import { atlasPaint } from './atlas-paint';
import { terrainObjectSources } from './terrain-objects';
import { AtlasObjectGeometry } from './atlas-object-geometry';
import { publicAtlasPaint } from './campaign-atlas-export';
import { atlasRegionPaint } from './atlas-region-export';
import {
  drawTerritories,
  MapLabelLayout,
  paintMapLabels,
  measureMapText,
} from './atlas-cartography';
import {
  AtlasSurfaceTileStream,
  atlasSurfaceTileFetcher,
  type AtlasSurfaceTile,
} from './atlas-surface-tile-stream';
import { atlasTerrainTileModel } from './atlas-terrain-tile-model';
import { DEFAULT_TERRAIN_STYLE } from './terrain-relief';

/** Freeze one source and render the editor's material/geometry pipeline into bounded output tiles. */
export async function atlasTerrainExport(
  token: string,
  snapshot: AtlasRenderView,
  view: TerrainView,
  options: {
    audience: 'gm' | 'public';
    width: number;
    height: number;
    format: 'png' | 'jpeg';
    references: boolean;
    grid: boolean;
    level: string;
    floorId: string;
    roofs: boolean;
    contours: number;
    overlay?: AtlasPaint;
  },
  current: () => boolean,
  progress: (done: number, total: number) => void,
) {
  const check = () => {
    if (!current()) throw Error('Atlas-Ausgabe abgebrochen.');
  };
  check();
  const { atlasDeckImage } = await import('./atlas-deck-runtime');
  check();
  const { width, height, format, overlay } = options,
    box = view.box;
  const camera = {
    focus: { x: view.frame.x + view.frame.width / 2, y: view.frame.y + view.frame.height / 2 },
    focusHeightM: view.focusM,
    metersPerPixel: view.frame.width / width,
    tilt: view.tilt,
    rotation: view.rotation,
    exaggeration: view.exaggeration,
  };
  const baseSurface = {
    displayMpp:
      Math.max(view.frame.width, view.frame.height) / Math.min(1024, Math.max(width, height)),
    textPixelsPerMeter: width / view.frame.width,
    origin: { x: box.x, y: box.y },
    focusM: 0,
    exaggeration: 1,
    height: () => 0,
    segment: Math.max(box.width, box.height) / 64,
    bounds: box,
  };
  if (options.audience === 'public') {
    const reply = await window.campaign.playerView(token);
    if (!reply.ok) throw Error(reply.error);
    check();
    const scene = publicAtlasPaint(snapshot, box, reply.value.frame),
      grid = publicTerrainGrid(reply.value.frame, view);
    const surface = {
      ...baseSurface,
      height: (p: { x: number; y: number }) => gridHeight(grid, p),
    };
    // No canonical terrain or GM assets enter the public renderer.
    return atlasDeckImage(
      {
        camera: { ...camera, focusHeightM: grid.view.focusM },
        scene,
        surface,
        terrain: [],
        style: DEFAULT_TERRAIN_STYLE,
        contours: 0,
        seaLevelM: 0,
      },
      width,
      height,
      format,
      current,
      progress,
      overlay,
    );
  }
  const layer = snapshot.region?.landscape;
  if (!layer || layer.state !== 'ready' || !layer.coverage.complete)
    throw Error(layer?.error ?? 'Landschaftsausgabe nicht vollständig. Erneut laden.');
  const stream = new AtlasSurfaceTileStream({
      maxTiles: 32,
      maxRetainedTiles: 64,
      maxBytes: 64 * 1024 * 1024,
    }),
    objects = new AtlasObjectGeometry();
  try {
    let tiles: readonly AtlasSurfaceTile[] = [];
    const fetch = atlasSurfaceTileFetcher(window.campaign, token, 'export:' + crypto.randomUUID());
    await stream.load(
      {
        box,
        focus: view.tilt ? view.frame : undefined,
        metersPerPixel: camera.metersPerPixel,
        revision: snapshot.revision,
        source: snapshot.region!.fence,
      },
      async (request, signal) => {
        check();
        const reply = await fetch(request, signal);
        check();
        return reply;
      },
      (frame) => {
        if (frame.complete) tiles = frame.tiles;
      },
    );
    check();
    if (!tiles.length) throw Error('Geländeausgabe nicht vollständig.');
    const source = terrainObjectSources(snapshot, {
      mpp: camera.metersPerPixel,
      roofs: options.roofs,
      scopeId: snapshot.region?.scopeId ?? null,
    });
    const projection = await window.campaign.atlasTerrainProjection(
      token,
      {
        product: 'height',
        revision: snapshot.revision,
        fence: snapshot.region!.fence,
        view,
        objects: source,
        width: 16,
        height: 16,
        displayMpp: camera.metersPerPixel,
        contours: 0,
      },
      'export',
    );
    if (!projection.ok) throw Error(projection.error);
    check();
    if (
      projection.value.revision !== snapshot.revision ||
      projection.value.fence !== snapshot.region!.fence
    )
      throw Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
    objects.update(projection.value.objects ?? [], { x: box.x, y: box.y, z: 0 }, 1);
    const assets = new Map<string, string>();
    if (options.references)
      for (const r of layer.records)
        if (r.assetId && !assets.has(r.assetId)) {
          const image = await window.campaign.referenceAssetPreview(token, r.assetId, 2048);
          if (!image.ok) throw Error(image.error);
          check();
          assets.set(r.assetId, image.value);
        }
    const scene = atlasRegionPaint(
      snapshot,
      layer.records.filter((r) => r.kind !== 'patch'),
      box,
      (width * Math.min(1, 1024 / Math.max(width, height)) * box.width) / view.frame.width,
      assets,
      {
        ...options,
        rasters: layer.tiles.filter((tile) => tile.content === 'objects'),
        automaticLabels: true,
      },
    );
    const raster = snapshot.region?.territoryRaster;
    if (raster)
      scene.append(
        atlasPaint('image', {
          source: raster.data,
          x: raster.box.x - box.x,
          y: raster.box.y - box.y,
          width: raster.box.width,
          height: raster.box.height,
          pointer: false,
        }),
      );
    if (snapshot.region?.territories)
      drawTerritories(scene, snapshot.region.territories, box, camera.metersPerPixel);
    const candidates = [...(snapshot.region?.labels ?? []), ...(layer.labels ?? [])],
      labelMpp =
        Math.max(view.frame.width, view.frame.height) / Math.min(Math.max(width, height), 1024);
    paintMapLabels(
      scene,
      new MapLabelLayout().layout(candidates, view.frame, labelMpp, measureMapText),
      box,
      labelMpp,
      { candidates },
    );
    const surface = {
      ...baseSurface,
      routes: new Map(layer.records.filter((r) => r.route).map((r) => [r.id, r])),
      objectHeights: objects.heights,
      scopeBases: objects.scopeBases,
      closedObjectIds: objects.closedIds,
      height: (p: { x: number; y: number }) => {
        const tile = tiles.find((t) => {
          const b = t.terrain.projection.grid.view.box;
          return p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height;
        });
        return tile ? gridHeight(tile.terrain.projection.grid, p) : 0;
      },
    };
    return await atlasDeckImage(
      {
        camera,
        scene,
        surface,
        terrain: tiles.map((t) => atlasTerrainTileModel(t.terrain, t.material)),
        objects: objects.meshes,
        vegetation: layer.records,
        style: layer.terrainStyle ?? DEFAULT_TERRAIN_STYLE,
        contours: options.contours,
        seaLevelM: layer.seaLevelM ?? 0,
      },
      width,
      height,
      format,
      current,
      progress,
      overlay,
    );
  } finally {
    stream.dispose();
    objects.dispose();
  }
}
