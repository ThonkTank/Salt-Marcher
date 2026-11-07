import type { AtlasTravelAPI as importAtlasTravelAPI } from '../atlas/atlas-travel-contracts';
import type { AtlasAPI as importAtlasAPI } from '../atlas/campaign-atlas-contracts';
import type { CityAPI } from '../atlas/city-contracts';
import type { DrawingAPI } from '../atlas/drawing-contracts';
import type { DungeonAPI } from '../atlas/dungeon-contracts';
import type { GraphAPI } from '../atlas/graph-contracts';
import type { CampaignManagementAPI } from '../campaign/campaign-contracts';
import type { GenerationAPI } from '../campaign/generation-contracts';
import type { KeyNoteCaptureAPI } from '../campaign/key-note-capture-contracts';
import type { LocationNotebookAPI } from '../campaign/location-notebook-contracts';
import type { NoteThreadAPI } from '../campaign/note-thread-contracts';
import type { NpcAPI } from '../campaign/npc-contracts';
import type { PreparationAPI } from '../campaign/preparation-contracts';
import type { SessionAPI } from '../campaign/session-contracts';
import type { SessionPacketAPI } from '../campaign/session-packet-contracts';
import type { WorldLinksAPI } from '../campaign/world-links-contracts';
import type { EncounterAPI } from '../catalog/encounter-contracts';
import type { ItemReferenceAPI } from '../catalog/item-reference-contracts';
import type { ItemsAPI } from '../catalog/items-contracts';
import type { RuleReferenceAPI } from '../catalog/rule-reference-contracts';
import type { AgendaAPI as importAgendaAPI } from '../runtime/agenda-contracts';
import type { AutonomyAPI } from '../runtime/autonomy-contracts';
import type { ChaseAPI } from '../runtime/chase-contracts';
import type { ChronicleAPI } from '../runtime/chronicle-contracts';
import type { CombatAPI } from '../runtime/combat-contracts';
import type { LiveAPI } from '../runtime/live-contracts';
import type { MaskHistoryAPI } from '../runtime/mask-history-contracts';
import type { MusicAPI } from '../runtime/music-contracts';
import type { NarrativeJournalAPI } from '../runtime/narrative-journal-contracts';
import type { PlayerAPI } from '../runtime/player-contracts';
import type { ProgressAPI } from '../runtime/progression';
import type { SceneCheckAPI } from '../runtime/scene-check-contracts';
import type { TimePlanAPI } from '../runtime/time-plan-contracts';
import type { WorldAPI } from '../runtime/world-contracts';
import type { ExtensionAPI } from '../workspace/extension-contracts';
import type { UpdateAPI } from '../workspace/update-contracts';
import type { CommitOutcome, CommitReference } from './commit-receipt';
import type {
  Campaign,
  CampaignRename,
  DungeonImportPreview,
  Edit,
  Result,
  RoomCommit,
  RoomDirectoryPage,
  RoomDirectoryQuery,
  WorkingRoomDraft,
  Workspace,
  WorkspaceGeometry,
  WorkspaceShell,
} from './contracts';
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
  ): Promise<Result<import('../workspace/tutorial-contracts').TutorialRun>>;
}
