import { atlasTerrainTileQuery } from './atlas-terrain-tile';
import type { AtlasWorldTile } from './atlas-world-tiles';
import type { AtlasDeckSceneModel } from './atlas-deck-scene-model';

export interface AtlasGeometryTileRequest {
  tile: AtlasWorldTile;
  revision: number;
}
export interface AtlasGeometryTile {
  tile: AtlasWorldTile;
  revision: number;
  fence: string;
  cache: 'hit' | 'built' | 'disabled';
  model: Omit<AtlasDeckSceneModel, 'targets'>;
}
/** Preload carries plain DTOs and typed buffers, never a Map or live renderer. */
export interface AtlasGeometryPresentation {
  scopeId: string | null;
  roofs: boolean;
  floorId?: string;
}
/** A coarse world envelope cannot describe selected floors or opened roofs.
 * Callers composing those views must request fine tiles; never reuse the proxy
 * as an editable floor or as a semantic selection surface. */
export function atlasGeometryTileModel(
  tile: AtlasGeometryTile,
  presentation?: AtlasGeometryPresentation,
): AtlasDeckSceneModel {
  const requiresDetail =
    !!tile.model.overviews?.length &&
    !!presentation &&
    (presentation.scopeId !== null || !presentation.roofs || presentation.floorId !== undefined);
  return {
    ...tile.model,
    ...(requiresDetail
      ? {
          overviews: [],
          coverage: {
            ...tile.model.coverage,
            complete: false,
            unsupported: [
              ...tile.model.coverage.unsupported,
              {
                code: 'geometry-detail-required',
                detail: 'Geschoss- und Dachauswahl benötigen exakte Detailkacheln.',
              },
            ],
          },
        }
      : {}),
    targets: new Map(tile.model.objects.map((o) => [o.id, o.target])),
  };
}
export function atlasGeometryTileBox(request: AtlasGeometryTileRequest) {
  if (!request || Object.keys(request).some((k) => !['tile', 'revision'].includes(k)))
    throw Error('Geometriekachel prüfen.');
  return atlasTerrainTileQuery(request).view.box;
}
