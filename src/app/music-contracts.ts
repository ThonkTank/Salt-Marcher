import type { Result } from './contracts';
export const audioMimeTypes: Readonly<Record<string, string>> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};
export interface MoodAxis {
  id: string;
  name: string;
  lowLabel: string;
  highLabel: string;
}
export interface AudioRegistry {
  revision: number;
  catalogRevision: number;
  axes: MoodAxis[];
}
export interface AudioAsset {
  id: string;
  revision: number;
  name: string;
  kind: 'song' | 'ambience';
  media: { sha256: string; extension: string; bytes: number; mime: string; originalName: string };
  moods: Record<string, number>;
  moodTags: string[];
  intensity: number;
  vibes: string[];
  genres: string[];
  notes: string;
  trashed: boolean;
  problem: string | null;
  available: boolean;
}
export interface AudioQuery {
  search: string;
  kind: '' | 'song' | 'ambience';
  includeTrashed: boolean;
  after: string | null;
}
export interface AudioPage {
  items: AudioAsset[];
  next: string | null;
  problems: string[];
}
export interface MusicSceneSettings {
  sceneId: string;
  revision: number;
  moods: Record<string, number>;
  intensity: number;
  vibes: string[];
  genres: string[];
}
export interface MusicSubject {
  id: string;
  kind: 'location' | 'note' | 'creature';
  revision: number;
  name: string;
  vibes: string[];
  genres: string[];
  vibeMode: 'add' | 'replace';
  genreMode: 'add' | 'replace';
}
export interface MusicContext {
  sceneId: string | null;
  name: string;
  moods: Record<string, number>;
  intensity: number;
  vibes: string[];
  genres: string[];
  environment: string[];
  signature: string;
  problems: string[];
}
export interface QueueEntry {
  id: string;
  assetId: string;
  mode: 'manual' | 'auto';
}
export interface MusicState {
  favoriteAssets?: string[];
  revision: number;
  autoplay: boolean;
  autoAmbience: boolean;
  current: {
    assetId: string;
    playbackId: string;
    mode: 'manual' | 'auto';
    positionSeconds: number;
  } | null;
  queue: QueueEntry[];
  history: string[];
  status: 'playing' | 'paused' | 'stopped';
  loop: 'none' | 'track' | 'queue';
  manualHold: 'none' | 'stop' | 'track' | 'queue';
  volume: number;
  ambienceVolume: number;
  fadeSeconds: number;
  forcedAmbience: string[];
  mutedAmbience: string[];
  automaticAmbience?: string[];
  contextSignature: string;
  lastError: string | null;
}
export interface MusicView {
  registry: AudioRegistry;
  state: MusicState;
  context: MusicContext;
  sceneSettings: MusicSceneSettings | null;
  assets: AudioAsset[];
  layers: { assetId: string; gain: number; manual: boolean }[];
  problems: string[];
}
export type MusicAction =
  | { kind: 'favorite'; expectedRevision: number; assetId: string; favorite: boolean }
  | { kind: 'asset'; asset: AudioAsset; expectedRevision: number }
  | { kind: 'clone'; id: string; expectedRevision: number; copyId?: string }
  | { kind: 'retry-asset'; id: string }
  | { kind: 'registry'; axes: MoodAxis[]; expectedRevision: number }
  | { kind: 'scene-settings'; settings: MusicSceneSettings; expectedRevision: number }
  | { kind: 'subject'; subject: MusicSubject; expectedRevision: number | null }
  | {
      kind: 'settings';
      expectedRevision: number;
      autoplay: boolean;
      autoAmbience: boolean;
      volume: number;
      ambienceVolume: number;
      fadeSeconds: number;
      loop: MusicState['loop'];
    }
  | { kind: 'select'; expectedRevision: number; assetId: string }
  | {
      kind: 'transport';
      expectedRevision: number;
      operation: 'play' | 'pause' | 'stop' | 'skip' | 'back' | 'ended' | 'release';
      playbackId?: string;
    }
  | { kind: 'queue-add'; expectedRevision: number; assetIds: string[] }
  | { kind: 'queue-remove'; expectedRevision: number; id: string }
  | { kind: 'queue-move'; expectedRevision: number; id: string; direction: -1 | 1 }
  | {
      kind: 'ambience';
      expectedRevision: number;
      assetId: string;
      operation: 'add' | 'remove' | 'mute' | 'unmute' | 'release-all';
    }
  | { kind: 'seek'; expectedRevision: number; playbackId: string; seconds: number }
  | { kind: 'failure'; playbackId: string; assetId: string; message: string };
export interface MusicCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action: MusicAction;
}
export interface AudioTransferProgress {
  phase: string;
  bytes: number;
  files: number;
  busy: boolean;
}
export interface MusicAPI {
  musicFavorites(token: string, after: string | null): Promise<Result<AudioPage>>;
  audioAssets(query: AudioQuery): Promise<Result<AudioPage>>;
  audioAsset(id: string): Promise<Result<AudioAsset>>;
  pickAudio(token: string): Promise<Result<{ ids: string[]; cancelled: boolean }>>;
  music(token: string): Promise<Result<MusicView>>;
  musicSubject(
    token: string,
    kind: MusicSubject['kind'],
    id: string,
  ): Promise<Result<MusicSubject>>;
  executeMusic(command: MusicCommand): Promise<Result<MusicView>>;
  musicPosition(token: string, playbackId: string, seconds: number): Promise<Result<void>>;
  exportAudioLibrary(token: string): Promise<Result<{ cancelled: boolean }>>;
  importAudioLibrary(token: string): Promise<Result<{ cancelled: boolean; ids: string[] }>>;
  cancelAudioTransfer(): Promise<Result<void>>;
  onAudioTransfer(callback: (progress: AudioTransferProgress) => void): void;
}
