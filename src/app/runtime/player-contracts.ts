import type { DungeonDisplay } from '../atlas/dungeon-travel-contracts';
import type { Result } from '../shared/contracts';
/** Stored 'scene' is read-only legacy compatibility and always projects blank. */
export interface PlayerSettings {
  revision: number;
  blank: boolean;
  windowOpen: boolean;
  mode: 'follow' | 'image' | 'scene';
  imageId: string | null;
  boundSceneId: string | null;
  title: string;
  labels: boolean;
  light: 'auto' | 'daylight' | 'dim' | 'darkness';
  displayId: number | null;
  fullscreen: boolean;
}
export interface PlayerObserver {
  characterId: string;
  enabled: boolean;
  rangeMeters: number;
  darkvisionMeters: number;
  eyeHeightMeters: number;
}
export interface PlayerAsset {
  id: string;
  kind: 'location' | 'npc' | 'custom';
  subjectId: string | null;
  title: string;
  sha256: string;
  extension: '.png';
  bytes: number;
}
export type PlayerDungeon = Pick<DungeonDisplay, 'position' | 'known' | 'visible' | 'labels'> & {
  markers: Pick<DungeonDisplay['markers'][number], 'point' | 'kind' | 'open'>[];
  tracks?: { from: DungeonDisplay['position']; to: DungeonDisplay['position'] }[];
};
export interface PlayerFrame {
  mode: 'blank' | 'map' | 'image' | 'dungeon';
  dungeon?: PlayerDungeon;
  title: string;
  imageId?: string;
  map?: {
    hexMeters: number;
    position: { q: number; r: number };
    cells: {
      q: number;
      r: number;
      terrain: string;
      elevationM?: number;
      road: boolean | null;
      river: boolean | null;
      visible: boolean;
      label: string;
    }[];
    markers: { q: number; r: number; label: string; visible: boolean }[];
  };
  reason?: string;
}

/** GM-only selection data; never part of PlayerFrame or the player bridge. */
export interface PlayerMapCell {
  q: number;
  r: number;
  terrain: string;
  name: string;
  publicLabel: string;
  hidden: boolean;
  blocksSight: boolean;
  known: boolean;
}
export interface PlayerMapQuery {
  mapId: string;
  q: number;
  r: number;
  search: string;
}
export interface PlayerView {
  settings: PlayerSettings;
  focusId: string | null;
  focusRevision: number | null;
  focusMembershipRevision: number | null;
  focusLocationId: string | null;
  focusTitle: string | null;
  observers: (PlayerObserver & { name: string })[];
  assets: PlayerAsset[];
  locations: { id: string; name: string }[];
  npcs: { id: string; name: string }[];
  maps: { id: string; name: string; cells?: PlayerMapCell[]; center?: { q: number; r: number } }[];
  frame: PlayerFrame;
}
export type PlayerAction =
  | { kind: 'blank' }
  | {
      kind: 'settings';
      settings: Pick<
        PlayerSettings,
        'blank' | 'imageId' | 'title' | 'labels' | 'light' | 'displayId' | 'fullscreen'
      > & { mode: 'follow' | 'image' };
    }
  | { kind: 'observer'; observer: PlayerObserver }
  | {
      kind: 'discover' | 'forget';
      characterIds: string[];
      mapId: string;
      q: number;
      r: number;
      locationId: string | null;
      publicLabel: string;
    }
  | {
      kind: 'mask';
      mapId: string;
      q: number;
      r: number;
      hidden: boolean;
      blocksSight: boolean;
      publicLabel: string;
    };
export interface PlayerCommand {
  commandId: string;
  token: string;
  campaignId: string;
  expectedRevision: number;
  expectedFocusId: string | null;
  expectedFocusRevision: number | null;
  expectedFocusMembershipRevision: number | null;
  expectedFocusLocationId: string | null;
  action: PlayerAction;
}
export interface PlayerAPI {
  playerView(token: string, query?: PlayerMapQuery): Promise<Result<PlayerView>>;
  executePlayer(command: PlayerCommand): Promise<Result<PlayerView>>;
  pickPlayerArt(
    token: string,
    kind: PlayerAsset['kind'],
    subjectId: string | null,
    title: string,
  ): Promise<Result<PlayerView | null>>;
  playerWindow(token: string, open: boolean): Promise<Result<void>>;
  playerScreens(): Promise<Result<{ id: number; name: string }[]>>;
}
