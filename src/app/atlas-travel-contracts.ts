import type { Point, Result } from "./contracts";
import type { CampaignAtlas } from "./campaign-atlas-contracts";
export interface AtlasEntrance {
  terrain?:import("./terrain-objects").TerrainAnchor;
  id: string;
  scopeId: string;
  roomId: string;
  floorId: string;
  inside: Point;
  outside: Point;
  revision: number;
}
export interface AtlasLocalPreview {
  sceneId: string;
  basis: string;
  positionRevision: number;
  clockRevision: number;
  membershipRevision: number;
  actorIds: string[];
  route: Point[];
  distanceMeters: number;
  seconds: number;
  speedMetersPerMinute: number;
  destination: Point;
}
export interface AtlasLocalJourney extends AtlasLocalPreview {
  id: string;
  revision: number;
  nextIndex: number;
  status: "active" | "paused" | "arrived" | "ended";
  elapsedSeconds: number;
  travelledMeters: number;
  reason: string;
}
export type AtlasTravelAction =
  | { kind: "start"; preview: AtlasLocalPreview }
  | {
      kind: "step" | "round" | "pause" | "resume" | "end";
      id: string;
      expectedRevision: number;
    }
  | {
      kind: "place";
      point: Point;
      expectedPositionRevision: number;
      expectedMembershipRevision: number;
    }
  | {
      kind: "entrance";
      id: string;
      revision: number;
      direction: "enter" | "exit";
      expectedPositionRevision: number;
      expectedMembershipRevision: number;
    };
export interface AtlasTravelCommand {
  commandId: string;
  campaignId: string;
  token: string;
  sceneId: string;
  action: AtlasTravelAction;
}
export interface AtlasTravelCommit {campaignId:string;commandId:string;sceneId:string}
export interface AtlasTravelAPI {
  executeAtlasTravelCommit(command:AtlasTravelCommand):Promise<Result<AtlasTravelCommit>>;
  previewAtlasTravel(
    token: string,
    destination: Point,
  ): Promise<Result<AtlasLocalPreview>>;
  executeAtlasTravel(
    command: AtlasTravelCommand,
  ): Promise<Result<CampaignAtlas>>;
}
