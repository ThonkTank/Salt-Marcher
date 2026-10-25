import type { UpdateAPI } from '../workspace/update-contracts';
import type { NoteThreadAPI } from '../campaign/note-thread-contracts';
import type { KeyNoteCaptureAPI } from '../campaign/key-note-capture-contracts';
import type { AtlasTravelAPI as importAtlasTravelAPI } from '../atlas/atlas-travel-contracts';
import type { AtlasAPI as importAtlasAPI } from '../atlas/campaign-atlas-contracts';
import type { ItemReferenceAPI } from '../catalog/item-reference-contracts';
import type { LocationNotebookAPI } from '../campaign/location-notebook-contracts';
import type { WorldLinksAPI } from '../campaign/world-links-contracts';
import type { TimePlanAPI } from '../runtime/time-plan-contracts';
import type { AgendaAPI as importAgendaAPI } from '../runtime/agenda-contracts';
import type { NarrativeJournalAPI } from '../runtime/narrative-journal-contracts';
import type { SessionPacketAPI } from '../campaign/session-packet-contracts';
import type { MaskHistoryAPI } from '../runtime/mask-history-contracts';
import type { NpcAPI } from '../campaign/npc-contracts';
import type { ExtensionAPI } from '../workspace/extension-contracts';
import type { GraphAPI, GraphPreviewState } from '../atlas/graph-contracts';
import type { CommitReference, CommitOutcome } from './commit-receipt';
import type { DungeonAPI } from '../atlas/dungeon-contracts';
import type { DrawingAPI } from '../atlas/drawing-contracts';
import type { AutonomyAPI } from '../runtime/autonomy-contracts';
import type { PlayerAPI } from '../runtime/player-contracts';
import type { CityAPI } from '../atlas/city-contracts';
import type { CampaignManagementAPI } from '../campaign/campaign-contracts';
import type { MusicAPI } from '../runtime/music-contracts';
import type { WorldAPI } from '../runtime/world-contracts';
import type { PreparationAPI } from '../campaign/preparation-contracts';
import type { LiveAPI } from '../runtime/live-contracts';
import type { CombatAPI } from '../runtime/combat-contracts';
import type { ProgressAPI } from '../runtime/progression';
import type { EncounterAPI } from '../catalog/encounter-contracts';
import type { GenerationAPI } from '../campaign/generation-contracts';
import type { SessionAPI } from '../campaign/session-contracts';
import type { ItemsAPI } from '../catalog/items-contracts';
import type { ChronicleAPI } from '../runtime/chronicle-contracts';
import type { ChaseAPI } from '../runtime/chase-contracts';
import type { RuleReferenceAPI } from '../catalog/rule-reference-contracts';
import type { SceneCheckAPI } from '../runtime/scene-check-contracts';
export interface Point {
  x: number;
  y: number;
}
export interface Polygon {
  outer: Point[];
  holes: Point[][];
}
export interface Section {
  id: string;
  kind: 'markdown' | 'passage';
  markdown?: string;
  doorId?: string;
}
export interface Room {
  id: string;
  scopeId: string;
  floorId: string;
  name: string;
  number: string;
  revision: number;
  polygons: Polygon[];
  sections: Section[];
}
/** Display geometry is deliberately not an editable Room. */
export type RoomGeometry = Omit<Room, 'sections'>;
export type RoomSummary = Omit<RoomGeometry, 'polygons'>;
export interface Campaign {
  id: string;
  name: string;
  revision: number;
}
export interface CampaignRename {
  commandId: string;
  token: string;
  campaignId: string;
  expectedRevision: number;
  name: string;
}
export interface WorkspaceState<R extends RoomGeometry> {
  geometryCoverage?: 'selected';
  graphPreview?: GraphPreviewState;
  campaign: Campaign;
  token: string;
  rooms: R[];
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  problems: { id: string; number: string; message: string }[];
  floors: { id: string; scopeId: string; name: string; sourceElevation: number }[];
}
export interface Workspace extends WorkspaceState<Room> {}
export interface WorkspaceGeometry extends WorkspaceState<RoomGeometry> {}
export type WorkspaceShell = Omit<WorkspaceGeometry, 'rooms' | 'floors' | 'problems'>;
export interface RoomDirectoryQuery {
  text: string;
  limit?: number;
  scopeId?: string;
  floorId?: string;
  cursor?: {
    token: string;
    fence: string;
    text: string;
    scopeId?: string;
    floorId?: string;
    after: { number: string; id: string };
  };
}
export interface RoomDirectoryPage {
  campaignId: string;
  token: string;
  items: RoomSummary[];
  total: number;
  unreadable: number;
  next: RoomDirectoryQuery['cursor'] | null;
}
export interface Edit {
  commandId: string;
  token: string;
  campaignId: string;
  roomId: string;
  expectedRevision: number;
  name: string;
  polygons: Polygon[];
  sections: Section[];
}
export interface RoomCommit {
  atlasRevision?: number;
  room: Room;
  token: string;
  canUndo: boolean;
  canRedo: boolean;
}
export interface WorkingRoomDraft {
  room: Room;
  points: string;
  pointsChanged: boolean;
  failedEdit: Edit | null;
}
export interface DungeonImportPreview {
  ticket: string;
  name: string;
  roomCount: number;
  sourceHash: string;
  warnings: string[];
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DesktopAPI
  extends UpdateAPI,
    importAtlasAPI,
    importAtlasTravelAPI,
    ItemReferenceAPI,
    NoteThreadAPI,
    KeyNoteCaptureAPI,
    LocationNotebookAPI,
    WorldLinksAPI,
    TimePlanAPI,
    importAgendaAPI,
    NarrativeJournalAPI,
    SessionPacketAPI,
    MaskHistoryAPI,
    NpcAPI,
    ExtensionAPI,
    GraphAPI,
    DungeonAPI,
    DrawingAPI,
    AutonomyAPI,
    PlayerAPI,
    CityAPI,
    PreparationAPI,
    LiveAPI,
    CombatAPI,
    ProgressAPI,
    EncounterAPI,
    GenerationAPI,
    SessionAPI,
    ItemsAPI,
    WorldAPI,
    MusicAPI,
    CampaignManagementAPI,
    ChronicleAPI,
    ChaseAPI,
    RuleReferenceAPI,
    SceneCheckAPI {
  commitStatus(ref: CommitReference, token: string): Promise<Result<CommitOutcome>>;
  list(): Promise<Result<{ campaigns: Campaign[]; activeId: string | null }>>;
  create(name: string): Promise<Result<Campaign>>;
  renameCampaign(command: CampaignRename): Promise<Result<Campaign>>;
  activateShell(id: string): Promise<Result<WorkspaceShell>>;
  campaignCatalogShell(commandId: string): Promise<Result<WorkspaceShell>>;
  workspaceInitial(token: string): Promise<Result<WorkspaceGeometry>>;
  workspaceGeometry(token: string): Promise<Result<WorkspaceGeometry>>;
  roomDirectory(
    token: string,
    query: RoomDirectoryQuery,
    consumer?: 'atlas' | 'directory',
  ): Promise<Result<RoomDirectoryPage>>;
  cancelRoomDirectory(token: string, consumer?: 'atlas' | 'directory'): Promise<Result<void>>;
  activate(id: string): Promise<Result<Workspace>>;
  select(token: string, id: string): Promise<Result<void>>;
  addRoom(token: string): Promise<Result<Workspace>>;
  edit(edit: Edit): Promise<Result<RoomCommit>>;
  reconcile(
    edit: Edit,
    token?: string,
  ): Promise<
    Result<{
      outcome: 'applied' | 'not-applied' | 'conflict';
      targetChanged: boolean;
      workspace: Workspace;
    }>
  >;
  roomDraft(token: string, roomId: string): Promise<Result<WorkingRoomDraft | null>>;
  keepRoomDraft(
    token: string,
    roomId: string,
    draft: WorkingRoomDraft | null,
  ): Promise<Result<void>>;
  history(token: string, direction: 'undo' | 'redo'): Promise<Result<Workspace>>;
  previewDungeonImport(): Promise<Result<DungeonImportPreview | null>>;
  createCampaignFromDungeon(ticket: string): Promise<Result<Campaign>>;
  closeReady(): void;
  onClose(callback: () => void): void;
  backupStatus(): Promise<Result<string | null>>;
  tutorial(
    state?: 'shown' | 'finished' | 'skipped',
  ): Promise<Result<import('../workspace/tutorial').TutorialRun>>;
}
declare global {
  interface Window {
    campaign: DesktopAPI;
  }
}

export function validateRoom(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, false);
}
/** Drafts must be safely readable, but incomplete author input is not a commit. */
export function validateRoomDraftContent(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, true);
}
function validateRoomContent(
  room: Pick<Room, 'name' | 'polygons' | 'sections'>,
  draft: boolean,
): void {
  if (!room || typeof room.name !== 'string' || (!draft && room.name.length > 1000))
    throw new Error('Bitte einen Raumnamen eingeben.');
  if (
    !Array.isArray(room.polygons) ||
    !room.polygons.length ||
    (!draft && room.polygons.length > 10000)
  )
    throw new Error('Raumkontur fehlt oder ist zu groß.');
  for (const polygon of room.polygons) {
    if (!polygon || !Array.isArray(polygon.outer) || !Array.isArray(polygon.holes))
      throw new Error('Ungültige Kontur.');
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (!Array.isArray(ring) || (!draft && (ring.length < 3 || ring.length > 100000)))
        throw new Error('Eine Kontur benötigt mindestens drei Punkte.');
      for (const point of ring)
        if (
          !point ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          (!draft && (Math.abs(point.x) > 1e9 || Math.abs(point.y) > 1e9))
        )
          throw new Error('Ungültige lokale Koordinate.');
      if (!draft) {
        const area = ring.reduce((sum, p, i) => {
          const q = ring[(i + 1) % ring.length]!;
          return sum + p.x * q.y - q.x * p.y;
        }, 0);
        if (Math.abs(area) < 1e-8) throw new Error('Die Kontur hat keine Fläche.');
      }
    }
  }
  if (!Array.isArray(room.sections) || (!draft && room.sections.length > 10000))
    throw new Error('Ungültiger Raum-Key.');
  const ids = new Set<string>();
  for (const section of room.sections) {
    if (!section || typeof section.id !== 'string' || !section.id || ids.has(section.id))
      throw new Error('Abschnittsidentitäten müssen eindeutig sein.');
    ids.add(section.id);
    if (
      section.kind === 'markdown'
        ? typeof section.markdown !== 'string' || (!draft && section.markdown.length > 2_000_000)
        : section.kind !== 'passage' || typeof section.doorId !== 'string'
    )
      throw new Error('Ungültiger Key-Abschnitt.');
  }
}
