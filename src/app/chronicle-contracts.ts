import type { Result } from './contracts';

export type ChronicleCategory = 'combat' | 'narrative' | 'reward' | 'travel' | 'party' | 'world';
export interface ChronicleEntry {
  sourceOrder?: number;
  id: string;
  recordedAt: string;
  category: ChronicleCategory;
  title: string;
  summary: string;
  people: string[];
  scene: string | null;
  location: string | null;
  followUp?: { kind: 'quest' | 'rumor'; id: string };
  sessionMarker?: 'start' | 'end';
  handoff?: string;
}
export interface ChronicleView {
  campaignName: string;
  entries: ChronicleEntry[];
  truncated: boolean;
  latestSessionMarker?: ChronicleEntry;
}
export interface ChronicleAfter {
  recordedAt: string;
  sourceOrder: number;
  id: string;
}
export interface ChronicleCursor {
  snapshotId: string;
  after: ChronicleAfter | null;
}
export interface ChroniclePage extends ChronicleView {
  snapshotId: string;
  next: ChronicleCursor | null;
}
export interface ChronicleExportProgress {
  requestId: string;
  written: number;
  busy: boolean;
}
export interface ChronicleAPI {
  chroniclePage(
    token: string,
    category: ChronicleCategory | 'all',
    search: string,
    cursor: ChronicleCursor | null,
  ): Promise<Result<ChroniclePage>>;
  closeChroniclePage(token: string, snapshotId: string): Promise<Result<void>>;
  cancelChronicleExport(requestId: string): Promise<Result<void>>;
  onChronicleExport(callback: (progress: ChronicleExportProgress) => void): void;
  chronicle(
    token: string,
    category?: ChronicleCategory | 'all',
    search?: string,
  ): Promise<Result<ChronicleView>>;
  exportChronicle(
    token: string,
    category: ChronicleCategory | 'all',
    search: string,
    requestId?: string,
  ): Promise<Result<{ cancelled: boolean; written?: number }>>;
}
