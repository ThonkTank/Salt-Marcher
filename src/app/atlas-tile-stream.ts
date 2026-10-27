import {AtlasRasterTileStream, type AtlasRasterStreamOptions, type AtlasRasterStreamInput, type AtlasRasterStreamFrame} from './atlas-raster-tile-stream.js';
import {validateAtlasTerrainTileReply,type AtlasTerrainTile, type AtlasTerrainTileRequest} from './atlas-terrain-tile.js';
import type {AtlasWorldTile} from './atlas-world-tiles.js';

export type AtlasTileStreamOptions = AtlasRasterStreamOptions;
export type AtlasTileStreamInput = AtlasRasterStreamInput;
export type AtlasTileStreamFrame = AtlasRasterStreamFrame<AtlasTerrainTile>;
export type AtlasTerrainTileFetcher = (request: AtlasTerrainTileRequest, signal:AbortSignal) => Promise<AtlasTerrainTile>;
export type AtlasTileStreamPublisher = (frame: AtlasTileStreamFrame) => void;

/** Terrain specialization of the shared bounded raster pyramid. */
export class AtlasTileStream extends AtlasRasterTileStream<AtlasTerrainTile,AtlasTerrainTileRequest> {
  constructor(options: AtlasTileStreamOptions = {}) {
    super({request: makeRequest, validate: validateReply}, options);
  }
}

function validateReply(reply: AtlasTerrainTile, request: AtlasTerrainTileRequest, source: string): void {
  validateAtlasTerrainTileReply(reply,request,source);
}

function makeRequest(tile: AtlasWorldTile, revision: number, contours?: number): AtlasTerrainTileRequest {
  return contours === undefined ? {tile, revision} : {tile, revision, contours};
}
