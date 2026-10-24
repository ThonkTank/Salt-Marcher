import {AtlasRasterTileStream, type AtlasRasterStreamOptions, type AtlasRasterStreamInput, type AtlasRasterStreamFrame} from './atlas-raster-tile-stream.js';
import type {AtlasMaterialTile, AtlasMaterialTileRequest} from './atlas-material-tile.js';
import {ATLAS_TERRAIN_TILE_PIXELS} from './atlas-terrain-tile.js';
import {CHANNEL_NAMES,terrainChannelStride} from './terrain-material.js';

export type AtlasMaterialTileStreamOptions = AtlasRasterStreamOptions;
export type AtlasMaterialTileStreamInput = Omit<AtlasRasterStreamInput,'contours'>;
export type AtlasMaterialTileStreamFrame = AtlasRasterStreamFrame<AtlasMaterialTile>;
export type AtlasMaterialTileFetcher = (request: AtlasMaterialTileRequest, signal:AbortSignal) => Promise<AtlasMaterialTile>;
export type AtlasMaterialTilePublisher = (frame: AtlasMaterialTileStreamFrame) => void;

/** Complete raw material channels refine together under the same raster budget. */
export class AtlasMaterialTileStream extends AtlasRasterTileStream<AtlasMaterialTile,AtlasMaterialTileRequest> {
  constructor(options: AtlasMaterialTileStreamOptions = {}) {
    // Material bytes include every semantic and relief channel. Leave room in the
    // default 32 MiB budget for retained parents and children awaiting a swap.
    super({request: (tile, revision) => ({tile, revision}), validate: validateReply}, {...options, maxTiles:options.maxTiles ?? 32});
  }

  override async load(input: AtlasMaterialTileStreamInput, fetch: AtlasMaterialTileFetcher, publish: AtlasMaterialTilePublisher): Promise<void> {
    if (input && 'contours' in input) throw new Error('Material tiles do not accept display contours');
    return super.load(input, fetch, publish);
  }
}

function validateReply(reply: AtlasMaterialTile, request: AtlasMaterialTileRequest, source: string): void {
  const pixels = ATLAS_TERRAIN_TILE_PIXELS;
  if (!reply || !reply.tile || reply.tile.lod !== request.tile.lod || reply.tile.x !== request.tile.x || reply.tile.y !== request.tile.y
    || reply.revision !== request.revision || reply.fence !== source || reply.width !== pixels || reply.height !== pixels
    || !reply.channels || CHANNEL_NAMES.some(channel => !(reply.channels[channel] instanceof Uint8Array)
      || reply.channels[channel]?.length !== pixels * pixels * terrainChannelStride(channel))) {
    throw new Error('Atlas material tile reply must contain all channels and match its requested source, revision, and address');
  }
}
