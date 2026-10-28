import { type NpcView, type NpcQuery, type NpcPage } from './npc-data-contracts';
import type { NpcPlacesAPI as importNpcPlacesAPI } from './npc-places-contracts';
import type { Result } from '../shared/contracts';

export interface NpcDraft {
  id: string;
  writeId: string;
  basis: NpcView | null;
  fields: Record<string, string>;
  concentrating: boolean;
  pendingCommand?: NpcCommand;
  rejectedCommand?: NpcCommand;
}
export type NpcResolution =
  | { outcome: 'applied'; value: NpcView }
  | { outcome: 'not-applied'; draft: NpcDraft };
export interface NpcCommand {
  draftWriteId?: string;
  commandId: string;
  campaignId: string;
  token: string;
  expectedNoteRevision: number | null;
  expectedRecordRevision: number;
  expectedActorRevision: number | null;
  expectedPositionRevision: number | null;
  npc: Omit<
    NpcView,
    'disposition' | 'role' | 'noteRevision' | 'actorRevision' | 'positionRevision'
  >;
}
export interface NpcAPI extends importNpcPlacesAPI {
  npcPlanCalendar(
    token: string,
  ): Promise<Result<import('../runtime/calendar-contracts').FantasyCalendar>>;
  npcCast(
    token: string,
    q: import('./npc-cast-contracts').NpcCastQuery,
  ): Promise<Result<import('./npc-cast-contracts').NpcCastPage>>;
  npcDossier(
    token: string,
    sceneId: string,
    id: string,
  ): Promise<Result<import('./npc-cast-contracts').NpcDossier>>;
  npcDrafts(token: string): Promise<Result<{ id: string; name: string }[]>>;
  npcDraft(token: string, id: string): Promise<Result<NpcDraft | null>>;
  keepNpcDraft(token: string, draft: NpcDraft, expected: string | null): Promise<Result<void>>;
  discardNpcDraft(token: string, id: string, writeId: string): Promise<Result<void>>;
  npcs(token: string, query: NpcQuery): Promise<Result<NpcPage>>;
  npc(token: string, id: string): Promise<Result<NpcView>>;
  reconcileNpc(command: NpcCommand, token: string): Promise<Result<NpcResolution>>;
  executeNpc(command: NpcCommand): Promise<Result<NpcView>>;
}
