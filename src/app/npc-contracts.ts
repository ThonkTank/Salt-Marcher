import type { NpcPlacesAPI as importNpcPlacesAPI } from './npc-places-contracts';
import type { Result } from './contracts';
import type { CharacterHealth } from './progression';
export interface NpcDemographics {
  ancestry: string;
  gender: string;
  ageYears: number | null;
}
export interface NpcDailySlot {
  id: string;
  startMinute: number;
  endMinute: number;
  activity: string;
  place: 'home' | 'work' | 'other' | 'location';
  locationId?: string;
  notes: string;
  weekdays?: number[];
}
export interface NpcPlanLocation {
  locationId: string;
  title: string;
  available: boolean;
}
export interface NpcDailyOverride {
  day: string;
  label: string;
  slots: NpcDailySlot[];
}
export interface NpcRecord {
  id: string;
  revision: number;
  factionId: string | null;
  modifier: number;
  lifecycle: 'active' | 'defeated';
  appearance: string;
  behavior: string;
  history: string;
  demographics?: NpcDemographics;
  dailyPlan?: NpcDailySlot[];
  dailyOverrides?: NpcDailyOverride[];
}
export type NpcRole = 'friendly' | 'neutral' | 'hostile';
export interface NpcView {
  id: string;
  name: string;
  noteRevision: number;
  creatureId: string | null;
  readAloud: string;
  gmNotes: string;
  record: NpcRecord;
  locationId: string | null;
  positionRevision: number | null;
  actorRevision: number | null;
  health: CharacterHealth | null;
  disposition: number;
  role: NpcRole;
}
export interface NpcQuery {
  text: string;
  lifecycle: 'all' | 'active' | 'defeated';
  factionId: string | null;
  locationId: string | null;
  offset: number;
  onlyUnplaced?: boolean;
}
export interface NpcPage {
  rows: {
    id: string;
    name: string;
    creatureId: string | null;
    lifecycle: NpcRecord['lifecycle'];
    factionId: string | null;
    locationId: string | null;
    disposition: number;
    role: NpcRole;
  }[];
  total: number;
  offset: number;
  onlyUnplaced?: boolean;
}
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
  npcPlanCalendar(token: string): Promise<Result<import('./world-contracts').FantasyCalendar>>;
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
