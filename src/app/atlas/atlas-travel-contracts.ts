import { type AtlasLocalPreview } from './atlas-journey-contracts';
import type { Point, Result } from '../shared/contracts';
import type { CampaignAtlas } from './campaign-atlas-view-contracts';
export type AtlasTravelAction =
  | { kind: 'start'; preview: AtlasLocalPreview }
  | {
      kind: 'step' | 'round' | 'pause' | 'resume' | 'end';
      id: string;
      expectedRevision: number;
    }
  | {
      kind: 'place';
      point: Point;
      expectedPositionRevision: number;
      expectedMembershipRevision: number;
    }
  | {
      kind: 'entrance';
      id: string;
      revision: number;
      direction: 'enter' | 'exit';
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
export interface AtlasTravelCommit {
  campaignId: string;
  commandId: string;
  sceneId: string;
}
export interface AtlasTravelAPI {
  executeAtlasTravelCommit(command: AtlasTravelCommand): Promise<Result<AtlasTravelCommit>>;
  previewAtlasTravel(token: string, destination: Point): Promise<Result<AtlasLocalPreview>>;
  executeAtlasTravel(command: AtlasTravelCommand): Promise<Result<CampaignAtlas>>;
}
