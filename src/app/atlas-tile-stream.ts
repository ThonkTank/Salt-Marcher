import {AtlasRasterTileStream, type AtlasRasterStreamOptions, type AtlasRasterStreamInput, type AtlasRasterStreamFrame} from './atlas-raster-tile-stream.js';
import type {AtlasTerrainTile, AtlasTerrainTileRequest} from './atlas-terrain-tile.js';
import type {AtlasWorldTile} from './atlas-world-tiles.js';

export type AtlasTileStreamOptions = AtlasRasterStreamOptions;
export type AtlasTileStreamInput = AtlasRasterStreamInput;
export type AtlasTileStreamFrame = AtlasRasterStreamFrame<AtlasTerrainTile>;
export type AtlasTerrainTileFetcher = (request: AtlasTerrainTileRequest) => Promise<AtlasTerrainTile>;
export type AtlasTileStreamPublisher = (frame: AtlasTileStreamFrame) => void;

/** Terrain specialization of the shared bounded raster pyramid. */
export class AtlasTileStream extends AtlasRasterTileStream<AtlasTerrainTile,AtlasTerrainTileRequest> {
  constructor(options: AtlasTileStreamOptions = {}) {
    super({request: makeRequest, validate: validateReply}, options);
  }
}

function validateReply(reply: AtlasTerrainTile, request: AtlasTerrainTileRequest, source: string): void {
  if (!reply || !reply.tile || reply.tile.lod !== request.tile.lod || reply.tile.x !== request.tile.x || reply.tile.y !== request.tile.y
    || reply.revision !== request.revision || reply.fence !== source
    || !reply.projection || reply.projection.revision !== request.revision
    || reply.projection.source !== source || reply.projection.fence !== source) {
    throw new Error('Atlas terrain tile reply does not match its requested source, revision, fence, or address');
  }
}

function makeRequest(tile: AtlasWorldTile, revision: number, contours?: number): AtlasTerrainTileRequest {
  return contours === undefined ? {tile, revision} : {tile, revision, contours};
}
