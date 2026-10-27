import type { LiveAction, LiveAck } from './live-contracts';
import type { ProgressAction, ProgressAck } from './progression';
export interface PartyCommands {
  runPartyLive(token: string, action: LiveAction, stillCurrent?: () => boolean): Promise<LiveAck>;
  runPartyProgress(
    token: string,
    action: ProgressAction,
    stillCurrent?: () => boolean,
  ): Promise<ProgressAck | undefined>;
  openPartyMove(
    ownerToken?: string,
    ownerSceneId?: string,
    stillCurrent?: () => boolean,
  ): Promise<boolean>;
}
