import type {
  AtlasRegionSource,
  AtlasRegionQuery,
  AtlasObjectFocus,
  AtlasHitPage,
} from '../src/app/atlas/atlas-region-view-contracts';
import type { AtlasRegionGeometry } from '../src/app/atlas/atlas-region-geometry-contracts';
import type {
  TerrainProjection,
  TerrainProjectionRequest,
} from '../src/app/atlas/terrain-projection-contracts';
import type { TerrainColorRequest, TerrainColorTile } from '../src/app/atlas/terrain-color';
import type { TerrainFrame, TerrainFrameQuery } from '../src/app/atlas/terrain-presentation';
import type { TerrainFrameIdentity } from '../src/app/atlas/terrain-frame-identity';
import type { HeightStroke } from '../src/app/atlas/terrain-brush-contracts';
import type { PreparedTerrainStroke } from '../src/app/storage/terrain-scale';
import type {
  AtlasTerrainTile,
  AtlasTerrainTileRequest,
} from '../src/app/atlas/atlas-terrain-tile';
import type {
  AtlasMaterialTile,
  AtlasMaterialTileRequest,
} from '../src/app/atlas/atlas-material-tile';
import type {
  AtlasGeometryTile,
  AtlasGeometryTileRequest,
} from '../src/app/atlas/atlas-geometry-tile';
import type { Point } from '../src/app/shared/contracts';

export type AtlasProjectionJob =
  | { kind: 'terrain'; query: TerrainProjectionRequest }
  | { kind: 'terrain-color'; query: TerrainColorRequest }
  | { kind: 'terrain-refine'; query: TerrainFrameQuery; base?: TerrainFrameIdentity }
  | { kind: 'terrain-tile'; query: AtlasTerrainTileRequest }
  | { kind: 'material-tile'; query: AtlasMaterialTileRequest }
  | { kind: 'geometry-tile'; query: AtlasGeometryTileRequest };
export type AtlasJob = (
  | AtlasProjectionJob
  | { kind: 'terrain-live'; query: TerrainFrameQuery; base?: TerrainFrameIdentity }
  | {
      kind: 'terrain-stroke';
      stroke: HeightStroke | import('../src/app/atlas/landscape-action-contracts').LakeStroke;
    }
  | { kind: 'region'; query: AtlasRegionQuery }
  | { kind: 'focus'; objectKind: 'room' | 'city' | 'building' | 'element' | 'scope'; id: string }
  | { kind: 'hit'; query: AtlasRegionQuery; point: Point }
  | {
      kind: 'candidates';
      query: AtlasRegionQuery;
      point: Point;
      offset: number;
      layer: 'geometry' | 'landscape' | 'all';
      visualElementId?: string;
    }
) & { continuation?: boolean; cancellation?: Int32Array };
export type AtlasWorkerJob = AtlasJob & { source: AtlasRegionSource };
export interface AtlasJobResults {
  terrain: TerrainProjection;
  'terrain-color': TerrainColorTile;
  'terrain-refine': TerrainFrame;
  'terrain-live': TerrainFrame;
  'terrain-stroke': PreparedTerrainStroke;
  'terrain-tile': AtlasTerrainTile;
  'material-tile': AtlasMaterialTile;
  'geometry-tile': AtlasGeometryTile;
  region: AtlasRegionGeometry;
  focus: AtlasObjectFocus;
  hit: AtlasObjectFocus | null;
  candidates: AtlasHitPage;
}
export type AtlasJobResult = AtlasJobResults[keyof AtlasJobResults];
export type AtlasWorkerValue =
  | AtlasJobResult
  | { terrainContinuation: true }
  | { terrainProjectionContinuation: true }
  | { regionReadCancelled: true };
export const isProjectionJob = (job: AtlasJob): job is AtlasProjectionJob & AtlasJob => {
  switch (job.kind) {
    case 'terrain':
    case 'terrain-color':
    case 'terrain-refine':
    case 'terrain-tile':
    case 'material-tile':
    case 'geometry-tile':
      return true;
    default:
      return false;
  }
};
export const isCachedTileJob = (
  job: AtlasJob,
): job is Extract<AtlasJob, { kind: 'geometry-tile' | 'terrain-tile' | 'material-tile' }> =>
  job.kind === 'geometry-tile' || job.kind === 'terrain-tile' || job.kind === 'material-tile';
export function isWorkerControl<
  K extends 'terrainContinuation' | 'terrainProjectionContinuation' | 'regionReadCancelled',
>(value: AtlasWorkerValue, key: K): boolean {
  return !!value && key in value && value[key as keyof typeof value] === true;
}

export type AtlasWorkerReply = { value: AtlasWorkerValue } | { error: string };
