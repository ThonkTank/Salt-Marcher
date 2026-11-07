import { type AtlasBinding } from './atlas-binding-contracts';
import { type CampaignAtlas, type AtlasRenderView } from './campaign-atlas-view-contracts';
import type { AtlasRegionAPI as importAtlasRegionAPI } from './atlas-region-contracts';
import type { AtlasEntrance } from './atlas-journey-contracts';
import type { Result, Edit, Polygon } from '../shared/contracts';
import type { CityCommand } from './city-contracts';

import type { WorldCommand } from '../runtime/world-contracts';

import type { DrawingCommand } from './drawing-contracts';

export type AtlasAction =
  | {
      kind: 'group-room-split';
      roomId: string;
      expectedRevision: number;
      axis: 'x' | 'y';
      ratio: number;
    }
  | { kind: 'group-scale'; scopeId: string; factor: number }
  | {
      kind: 'group-generate';
      name: string;
      x: number;
      y: number;
      recipe: import('./room-group-contracts').GroupRecipe;
    }
  | import('./atlas-territories').TerritoryAction
  | import('./landscape-action-contracts').LandscapeAction
  | {
      kind: 'drawing-import';
      name: string;
      rooms: import('../shared/contracts').Room[];
      source: string;
      x: number;
      y: number;
    }
  | { kind: 'room-default' }
  | { kind: 'graph-accept'; command: import('./graph-contracts').GraphCommand }
  | { kind: 'world'; command: WorldCommand }
  | { kind: 'city'; command: CityCommand }
  | { kind: 'drawing'; command: DrawingCommand }
  | { kind: 'room-edit'; edit: Edit }
  | { kind: 'bind'; binding: AtlasBinding; expectedRevision: number | null }
  | {
      kind: 'city-create';
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: 'dungeon-create';
      name: string;
      x: number;
      y: number;
    }
  | { kind: 'entrance'; entrance: AtlasEntrance }
  | {
      kind: 'room-create';
      scopeId: string;
      floorId: string;
      name: string;
      polygons: Polygon[];
    }
  | { kind: 'undo' | 'redo' };
export interface AtlasCommand {
  expectedCampaignRevision?: number;
  /** Consecutive committed terrain increments share one undo entry. Each increment has its own receipt. */
  terrainStroke?: { id: string; expectedRevision: number };
  sourceFence?: string;
  commandId: string;
  token: string;
  campaignId: string;
  action: AtlasAction;
}
/** Small GM-only reads. These DTOs never contain room prose or complete cities. */
export interface AtlasOverview {
  campaignId: string;
  token: string;
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  counts: { rooms: number; cities: number; landscape: number };
  landscapeBounds: import('./landscape-bounds').LandscapeBox | null;
}
export interface AtlasObjectQuery {
  kind: 'room' | 'city' | 'landscape' | 'scope';
  text: string;
  limit: number;
  cursor?: {
    token: string;
    fence: number;
    revision: number;
    after: string;
    kind: 'room' | 'city' | 'landscape' | 'scope';
    text: string;
  };
}
export interface AtlasObjectPage {
  campaignId: string;
  token: string;
  revision: number;
  items: {
    id: string;
    name: string;
    revision: number;
    scopeId?: string;
    floorId?: string;
    number?: string;
  }[];
  next: AtlasObjectQuery['cursor'] | null;
}
export interface AtlasCommitAck {
  campaignId: string;
  commandId: string;
  revision: number;
  result?: { id: string };
  sourceFence?: string;
  canUndo: boolean;
  canRedo: boolean;
}
export type AtlasCommitOutcome =
  | { outcome: 'applied'; ack: AtlasCommitAck }
  | { outcome: 'not-applied' }
  | { outcome: 'unknown' };
export interface AtlasAPI extends importAtlasRegionAPI {
  atlasTerritories(
    token: string,
    box?: import('./landscape-bounds').LandscapeBox,
  ): Promise<Result<import('./atlas-territories').TerritoryState>>;
  atlasDrawingCommit(command: DrawingCommand): Promise<
    Result<{
      workspace: import('../shared/contracts').Workspace;
      view: import('./drawing-view-contracts').DrawingView;
      atlasRevision: number;
    }>
  >;
  atlasRoomCommit(edit: Edit): Promise<Result<import('../shared/contracts').RoomCommit>>;
  atlasRenderView(token: string): Promise<Result<AtlasRenderView>>;
  atlasOverview(token: string): Promise<Result<AtlasOverview>>;
  atlasObjects(token: string, query: AtlasObjectQuery): Promise<Result<AtlasObjectPage>>;
  atlasVegetationScene(
    token: string,
    box: import('./landscape-bounds').LandscapeBox,
    mpp: number,
  ): Promise<Result<import('./vegetation').VegetationScene>>;
  atlasSpatialScene(
    token: string,
    box: import('./landscape-bounds').LandscapeBox,
    mpp: number,
    draft?: import('./spatial-terrain').SpatialTerrainDraft,
    fence?: string,
  ): Promise<Result<import('./vegetation').VegetationScene>>;
  atlasTerrainProfile(
    token: string,
    points: import('../shared/contracts').Point[],
  ): Promise<Result<import('./terrain-profile').TerrainProfile & { revision: number }>>;
  atlasHeight(
    token: string,
    point: import('../shared/contracts').Point,
  ): Promise<Result<ReturnType<import('./terrain-height').TerrainSampler['query']>>>;
  atlasTerrainFrame(
    token: string,
    q: import('./terrain-presentation').TerrainFrameRequest,
  ): Promise<Result<import('./terrain-presentation').TerrainFrame>>;
  atlasTerrainColor(
    token: string,
    q: import('./terrain-color').TerrainColorRequest,
  ): Promise<Result<import('./terrain-color').TerrainColorTile>>;
  atlasTerrainProjection(
    token: string,
    q: import('./terrain-projection-contracts').TerrainProjectionRequest,
    consumer?: 'view' | 'export',
    control?: import('./atlas-read-request').AtlasReadRequest,
  ): Promise<Result<import('./terrain-projection-contracts').TerrainProjection>>;
  atlasMaskRegion(
    token: string,
    box: import('./landscape-bounds').LandscapeBox,
  ): Promise<
    Result<{ revision: number; records: import('./landscape-contracts').LandscapeRecord[] }>
  >;
  atlasLandscapeObject(
    token: string,
    id: string,
  ): Promise<Result<import('./landscape-contracts').LandscapeRecord>>;
  atlasRoom(token: string, id: string): Promise<Result<import('../shared/contracts').Room>>;
  executeAtlasCommit(command: AtlasCommand): Promise<Result<AtlasCommitAck>>;
  reconcileAtlasCommit(command: AtlasCommand): Promise<Result<AtlasCommitOutcome>>;

  landscapeFind(
    token: string,
    text: string,
  ): Promise<Result<import('./landscape-contracts').LandscapeRecord[]>>;
  referenceImage(
    token: string,
  ): Promise<Result<{ id: string; width: number; height: number } | null>>;
  referenceAssetPreview(token: string, id: string, size: number): Promise<Result<string>>;
  exportAtlasPNG(
    token: string,
    bytes: Uint8Array,
    audience: 'gm' | 'public',
    format?: 'png' | 'jpeg',
    sourceFence?: string,
  ): Promise<Result<{ cancelled: boolean }>>;
  importAtlas(command: {
    commandId: string;
    token: string;
    campaignId: string;
    ticket: string;
    x: number;
    y: number;
  }): Promise<Result<{ atlas: CampaignAtlas; roomId: string | null }>>;
  campaignAtlas(token: string): Promise<Result<CampaignAtlas>>;
  executeAtlas(command: AtlasCommand): Promise<Result<{ atlas: CampaignAtlas; result: unknown }>>;
}
