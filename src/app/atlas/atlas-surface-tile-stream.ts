import { terrainChannelStride } from './terrain-material';
import { AtlasRasterTileStream, type AtlasRasterStreamOptions } from './atlas-raster-tile-stream';
import type { AtlasTerrainTile, AtlasTerrainTileRequest } from './atlas-terrain-tile';
import type { AtlasMaterialTile } from './atlas-material-tile';
import type { AtlasRegionAPI } from './atlas-region-contracts';
import type { AtlasReadRequest } from './atlas-read-request';
import { SURFACE_CHANNEL_NAMES } from './terrain-material';
import { atlasTerrainTileQuery } from './atlas-terrain-tile';
import { landscapeRasterBounds } from './landscape-raster';
import type { TerrainSourceChange } from './terrain-change-history';

export interface AtlasSurfaceTile {
  tile: AtlasTerrainTile['tile'];
  revision: number;
  fence: string;
  terrain: AtlasTerrainTile;
  material: AtlasMaterialTile;
}

/** One budget, cancellation owner and atomic LOD transition for height/material.
 * A material reply can never refine a different revision's height surface. */
export class AtlasSurfaceTileStream extends AtlasRasterTileStream<
  AtlasSurfaceTile,
  AtlasTerrainTileRequest
> {
  constructor(options: AtlasRasterStreamOptions = {}) {
    super(
      {
        request: (tile, revision, _contours, editingRadius) => ({
          tile,
          revision,
          product: 'height',
          editingRadius,
        }),
        validate: validateSurfaceTile,
        reuse: reuseUnchangedSurface,
      },
      { maxTiles: 32, ...options },
    );
  }
}

/** Same dependency envelope as the canonical terrain fingerprint: material halo
 * plus one lattice cell. Canonical changed-height bounds already include the
 * interpolation support, and route/lake rows carry their full physical bounds. */
export function reuseUnchangedSurface(
  previous: AtlasSurfaceTile,
  request: AtlasTerrainTileRequest,
  source: string,
  change: TerrainSourceChange,
): AtlasSurfaceTile | undefined {
  // Author packets contain complete row payloads, not merely sampled nodes.
  // Their dependency cannot be certified by a narrowed height-node journal.
  if (request.editingRadius !== undefined || previous.terrain.projection.grid.editing?.author)
    return;
  const q = atlasTerrainTileQuery(request),
    b = landscapeRasterBounds(q.view.box, q.width, q.height),
    pad = q.view.box.width / (q.view.columns - 1);
  if (
    change.invalidation.bounds.some(
      (c) =>
        c.x <= b.x + b.width + pad &&
        c.x + c.width >= b.x - pad &&
        c.y <= b.y + b.height + pad &&
        c.y + c.height >= b.y - pad,
    )
  )
    return;
  const identity = { revision: request.revision, fence: source };
  return {
    ...previous,
    ...identity,
    terrain: {
      ...previous.terrain,
      ...identity,
      projection: { ...previous.terrain.projection, ...identity, source },
    },
    material: { ...previous.material, ...identity },
  };
}

function validateSurfaceTile(
  reply: AtlasSurfaceTile,
  request: AtlasTerrainTileRequest,
  source: string,
): void {
  const matches = (tile: AtlasSurfaceTile | AtlasTerrainTile | AtlasMaterialTile | undefined) =>
    tile &&
    tile.revision === request.revision &&
    tile.fence === source &&
    tile.tile.lod === request.tile.lod &&
    tile.tile.x === request.tile.x &&
    tile.tile.y === request.tile.y;
  const p = reply?.terrain?.projection,
    m = reply?.material;
  if (
    !matches(reply) ||
    !matches(reply.terrain) ||
    !matches(m) ||
    (request.editingRadius !== undefined &&
      (p?.grid.editing?.author?.radius !== request.editingRadius ||
        p.grid.editing.author.revision !== request.revision ||
        p.grid.editing.author.fence !== source)) ||
    !p?.heightOnly ||
    p.fence !== source ||
    p.revision !== request.revision ||
    p.grid?.view.columns !== 65 ||
    p.grid.view.rows !== 65 ||
    !(p.grid.heights instanceof Float32Array) ||
    p.grid.heights.length !== 65 * 65 ||
    m.width !== 256 ||
    m.height !== 256 ||
    SURFACE_CHANNEL_NAMES.some(
      (c) =>
        !(m.channels[c] instanceof Uint8Array) ||
        m.channels[c].length !== 256 * 256 * terrainChannelStride(c),
    )
  )
    throw Error('Höhe und Material müssen vollständige Kacheln derselben Quelle bilden.');
}

type ReadPort = Pick<AtlasRegionAPI, 'atlasTerrainTile' | 'atlasMaterialTile' | 'atlasCancelRead'>;
/** Restricted preload adapter. Cancellation only addresses a disposable read.
 * Await physical completion before another stream job; never retry a failed read. */
export function atlasSurfaceTileFetcher(api: ReadPort, token: string, owner: string) {
  return async (
    request: AtlasTerrainTileRequest,
    signal: AbortSignal,
  ): Promise<AtlasSurfaceTile> => {
    const control: AtlasReadRequest = { owner, id: crypto.randomUUID() };
    const check = () => {
      if (signal.aborted) throw new DOMException('Kartenleseauftrag abgebrochen.', 'AbortError');
    };
    const cancel = () => {
      void api.atlasCancelRead(token, control).catch(() => {});
    };
    check();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const height = await api.atlasTerrainTile(
        token,
        {
          tile: request.tile,
          revision: request.revision,
          product: 'height',
          editingRadius: request.editingRadius,
        },
        control,
      );
      check();
      if (!height.ok) throw Error(height.error);
      const material = await api.atlasMaterialTile(
        token,
        { tile: request.tile, revision: request.revision, product: 'surface' },
        control,
      );
      check();
      if (!material.ok) throw Error(material.error);
      return {
        tile: request.tile,
        revision: request.revision,
        fence: height.value.fence,
        terrain: height.value,
        material: material.value,
      };
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  };
}
