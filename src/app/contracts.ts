import type {UpdateAPI} from './update-contracts';
import type {NoteThreadAPI} from './note-thread-contracts';
import type {KeyNoteCaptureAPI} from './key-note-capture-contracts';
import type{AtlasTravelAPI as importAtlasTravelAPI}from'./atlas-travel-contracts';
import type {AtlasAPI as importAtlasAPI} from './campaign-atlas-contracts';
import type {ItemReferenceAPI} from './item-reference-contracts';
import type {LocationNotebookAPI} from './location-notebook-contracts';
import type {WorldLinksAPI} from './world-links-contracts';
import type {TimePlanAPI} from './time-plan-contracts';
import type {AgendaAPI as importAgendaAPI} from './agenda-contracts';
import type {NarrativeJournalAPI} from './narrative-journal-contracts';
import type {SessionPacketAPI} from './session-packet-contracts';
import type {MaskHistoryAPI} from './mask-history-contracts';
import type {NpcAPI} from './npc-contracts';
import type {ExtensionAPI} from './extension-contracts';
import type {GraphAPI,GraphPreviewState} from './graph-contracts';
import type {CommitReference,CommitOutcome} from './commit-receipt';
import type {DungeonAPI} from './dungeon-contracts';
import type {DrawingAPI} from './drawing-contracts';
import type {AutonomyAPI} from './autonomy-contracts';
import type {PlayerAPI} from './player-contracts';
import type {CityAPI} from './city-contracts';
import type {CampaignManagementAPI} from './campaign-contracts';
import type {MusicAPI} from './music-contracts';
import type {WorldAPI} from './world-contracts';
import type { PreparationAPI } from './preparation-contracts';
import type { LiveAPI } from './live-contracts';
import type { CombatAPI } from './combat-contracts';
import type { ProgressAPI } from './progression';
import type { EncounterAPI } from './encounter-contracts';
import type { GenerationAPI } from './generation-contracts';
import type { SessionAPI } from './session-contracts';
import type {ItemsAPI} from './items-contracts';
import type {ChronicleAPI} from './chronicle-contracts';
import type {ChaseAPI} from './chase-contracts';
import type {RuleReferenceAPI} from './rule-reference-contracts';
import type {SceneCheckAPI} from './scene-check-contracts';
export interface Point { x: number; y: number }
export interface Polygon { outer: Point[]; holes: Point[][] }
export interface Section { id: string; kind: 'markdown' | 'passage'; markdown?: string; doorId?: string }
export interface Room {
  id: string; scopeId: string; floorId: string; name: string; number: string; revision: number;
  polygons: Polygon[]; sections: Section[];
}
/** Display geometry is deliberately not an editable Room. */
export type RoomGeometry = Omit<Room, 'sections'>;
export type RoomSummary = Omit<RoomGeometry, 'polygons'>;
export interface Campaign { id: string; name: string; revision: number }
export interface CampaignRename { commandId: string; token: string; campaignId: string; expectedRevision: number; name: string }
export interface WorkspaceState<R extends RoomGeometry> {geometryCoverage?:'selected';graphPreview?:GraphPreviewState;
  campaign: Campaign; token: string; rooms: R[]; selectedId: string | null;
  canUndo: boolean; canRedo: boolean;
  problems: { id: string; number: string; message: string }[];
  floors: { id: string; scopeId: string; name: string; sourceElevation: number }[];
}
export interface Workspace extends WorkspaceState<Room> {}
export interface WorkspaceGeometry extends WorkspaceState<RoomGeometry> {}
export type WorkspaceShell = Omit<WorkspaceGeometry, 'rooms'|'floors'|'problems'>;
export interface RoomDirectoryQuery {
  text: string; limit?: number; scopeId?: string; floorId?: string;
  cursor?: {token:string; fence:string; text:string; scopeId?:string; floorId?:string; after:{number:string;id:string}};
}
export interface RoomDirectoryPage {
  campaignId:string; token:string; items:RoomSummary[]; total:number; unreadable:number;
  next:RoomDirectoryQuery['cursor']|null;
}
export interface Edit {
  commandId: string; token: string; campaignId: string; roomId: string;
  expectedRevision: number; name: string; polygons: Polygon[]; sections: Section[];
}
export interface RoomCommit { atlasRevision?:number; room: Room; token: string; canUndo: boolean; canRedo: boolean }
export interface WorkingRoomDraft { room: Room; points: string; pointsChanged: boolean; failedEdit: Edit | null }
export interface DungeonImportPreview { ticket: string; name: string; roomCount: number; sourceHash: string; warnings: string[] }
/** A missing transport marker does not prove that a write was unapplied. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string; errorKind?: 'store-outcome-unknown' };
export interface DesktopAPI extends UpdateAPI,importAtlasAPI,importAtlasTravelAPI,ItemReferenceAPI,NoteThreadAPI,KeyNoteCaptureAPI,LocationNotebookAPI, WorldLinksAPI,TimePlanAPI,importAgendaAPI, NarrativeJournalAPI,SessionPacketAPI,MaskHistoryAPI,NpcAPI,ExtensionAPI,GraphAPI, DungeonAPI,DrawingAPI, AutonomyAPI, PlayerAPI, CityAPI, PreparationAPI, LiveAPI, CombatAPI, ProgressAPI, EncounterAPI, GenerationAPI, SessionAPI, ItemsAPI, WorldAPI, MusicAPI, CampaignManagementAPI, ChronicleAPI, ChaseAPI, RuleReferenceAPI, SceneCheckAPI {
  commitStatus(ref:CommitReference,token:string):Promise<Result<CommitOutcome>>;
  list(): Promise<Result<{ campaigns: Campaign[]; activeId: string | null }>>;
  create(name: string): Promise<Result<Campaign>>;
  renameCampaign(command: CampaignRename): Promise<Result<Campaign>>;
  activateShell(id:string):Promise<Result<WorkspaceShell>>;
  campaignCatalogShell(commandId:string):Promise<Result<WorkspaceShell>>;
  workspaceInitial(token:string):Promise<Result<WorkspaceGeometry>>;workspaceGeometry(token:string):Promise<Result<WorkspaceGeometry>>;
  roomDirectory(token:string,query:RoomDirectoryQuery,consumer?:'atlas'|'directory'):Promise<Result<RoomDirectoryPage>>;
  cancelRoomDirectory(token:string,consumer?:'atlas'|'directory'):Promise<Result<void>>;
  activate(id: string): Promise<Result<Workspace>>;
  select(token: string, id: string): Promise<Result<void>>;
  addRoom(token: string): Promise<Result<Workspace>>;
  edit(edit: Edit): Promise<Result<RoomCommit>>;
  reconcile(edit: Edit, token?: string): Promise<Result<{ outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean; workspace: Workspace }>>;
  roomDraft(token: string, roomId: string): Promise<Result<WorkingRoomDraft | null>>;
  keepRoomDraft(token: string, roomId: string, draft: WorkingRoomDraft | null): Promise<Result<void>>;
  history(token: string, direction: 'undo' | 'redo'): Promise<Result<Workspace>>;
  previewDungeonImport(): Promise<Result<DungeonImportPreview | null>>;
  createCampaignFromDungeon(ticket: string): Promise<Result<Campaign>>;
  closeReady(): void;
  onClose(callback: () => void): void;
  backupStatus(): Promise<Result<string | null>>;
  tutorial(state?: 'shown' | 'finished' | 'skipped'): Promise<Result<import('./tutorial').TutorialRun>>;
}
declare global { interface Window { campaign: DesktopAPI } }

export function validateRoom(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, false);
}
/** Drafts must be safely readable, but incomplete author input is not a commit. */
export function validateRoomDraftContent(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, true);
}
function validateRoomContent(room: Pick<Room, 'name' | 'polygons' | 'sections'>, draft: boolean): void {
  if (!room || typeof room.name !== 'string' || !draft && room.name.length > 1000) throw new Error('Bitte einen Raumnamen eingeben.');
  if (!Array.isArray(room.polygons) || !room.polygons.length || !draft && room.polygons.length > 10000) throw new Error('Raumkontur fehlt oder ist zu groß.');
  for (const polygon of room.polygons) {
    if (!polygon || !Array.isArray(polygon.outer) || !Array.isArray(polygon.holes)) throw new Error('Ungültige Kontur.');
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (!Array.isArray(ring) || !draft && (ring.length < 3 || ring.length > 100000)) throw new Error('Eine Kontur benötigt mindestens drei Punkte.');
      for (const point of ring) if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !draft && (Math.abs(point.x) > 1e9 || Math.abs(point.y) > 1e9)) throw new Error('Ungültige lokale Koordinate.');
      if (!draft) {
        const area = ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]!; return sum + p.x * q.y - q.x * p.y; }, 0);
        if (Math.abs(area) < 1e-8) throw new Error('Die Kontur hat keine Fläche.');
      }
    }
  }
  if (!Array.isArray(room.sections) || !draft && room.sections.length > 10000) throw new Error('Ungültiger Raum-Key.');
  const ids = new Set<string>();
  for (const section of room.sections) {
    if (!section || typeof section.id !== 'string' || !section.id || ids.has(section.id)) throw new Error('Abschnittsidentitäten müssen eindeutig sein.');
    ids.add(section.id);
    if (section.kind === 'markdown' ? typeof section.markdown !== 'string' || !draft && section.markdown.length > 2_000_000 : section.kind !== 'passage' || typeof section.doorId !== 'string') throw new Error('Ungültiger Key-Abschnitt.');
  }
}
