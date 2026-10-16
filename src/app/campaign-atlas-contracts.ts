import type {
  AtlasEntrance,
  AtlasLocalJourney,
} from "./atlas-travel-contracts";
import type { Result, Workspace, Edit, Polygon } from "./contracts";
import type { CityCommand, CityView } from "./city-contracts";
import type { DrawingCommand } from "./drawing-contracts";
import type { WorldCommand, AtlasMap, SceneWorld } from "./world-contracts";
import type { DungeonView } from "./dungeon-contracts";
export interface AtlasBinding {
  id: string;
  kind: "city" | "dungeon" | "location";
  ownerId: string;
  parent: "world" | "building";
  parentId: string | null;
  x: number;
  y: number;
  angle: number;
  revision: number;
}
export interface CampaignAtlas {
  scopes: { id: string; name: string }[];
  perception: import("./dungeon-contracts").DungeonDisplay | null;
  entrances: AtlasEntrance[];
  localJourney: AtlasLocalJourney | null;
  campaignId: string;
  revision: number;
  terrain: AtlasMap;
  bindings: AtlasBinding[];
  cities: CityView[];
  places: (import("./world-contracts").AtlasPlace & {point:import("./contracts").Point})[];
  geometry: DungeonView;
  workspace: Workspace;
  scene: SceneWorld | null;
  publicFrame?: import("./player-contracts").PlayerFrame;
  canUndo: boolean;
  canRedo: boolean;
}
export type AtlasAction =
  | {kind:"location-create";mapId:string;expectedMapRevision:number;document:import("../features/location/location-schema").LocationDocument;point:import("./contracts").Point}
  | import("./atlas-landscape").LandscapeAction
  | {
      kind: "drawing-import";
      name: string;
      rooms: import("./contracts").Room[];
      source: string;
      x: number;
      y: number;
    }
  | { kind: "room-default" }
  | { kind: "graph-accept"; command: import("./graph-contracts").GraphCommand }
  | { kind: "world"; command: WorldCommand }
  | { kind: "city"; command: CityCommand }
  | { kind: "drawing"; command: DrawingCommand }
  | { kind: "room-edit"; edit: Edit }
  | { kind: "bind"; binding: AtlasBinding; expectedRevision: number | null }
  | {
      kind: "city-create";
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: "dungeon-create";
      name: string;
      x: number;
      y: number;
      buildingId?: string;
    }
  | { kind: "entrance"; entrance: AtlasEntrance }
  | {
      kind: "room-create";
      scopeId: string;
      floorId: string;
      name: string;
      polygons: Polygon[];
    }
  | { kind: "undo" | "redo" };
export interface AtlasCommand {
  commandId: string;
  token: string;
  campaignId: string;
  action: AtlasAction;
}
export interface AtlasAPI {
  landscapeFind(
    token: string,
    text: string,
  ): Promise<Result<import("./atlas-landscape").LandscapeRecord[]>>;
  landscapeRegion(
    token: string,
    box: import("./atlas-landscape").LandscapeBox,
    metersPerPixel?:number,
  ): Promise<Result<import("./atlas-landscape").LandscapeRegion>>;
  referenceImage(
    token: string,
  ): Promise<
    Result<{ id: string; data: string; width: number; height: number } | null>
  >;
  referenceAsset(token: string, id: string): Promise<Result<string>>;
  exportAtlasPNG(
    token: string,
    bytes: number[],
    audience: "gm" | "public",
    format?: "png" | "jpeg",
  ): Promise<Result<{ cancelled: boolean }>>;
  importAtlas(command: {
    commandId: string;
    token: string;
    campaignId: string;
    ticket: string;
    x: number;
    y: number;
  }): Promise<Result<{ atlas: CampaignAtlas; roomId: string | null }>>;
  campaignAtlas(token: string, groupView?: boolean): Promise<Result<CampaignAtlas>>;
  executeAtlas(
    command: AtlasCommand,
  ): Promise<Result<{ atlas: CampaignAtlas; result: unknown }>>;
}
