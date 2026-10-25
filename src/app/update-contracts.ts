import type { Result } from './contracts';
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'
  | 'unsupported';
export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  automatic: boolean;
  lastChecked: string | null;
  available: { version: string; notes: string } | null;
  received: number;
  total: number;
  message: string;
}
export interface UpdateAPI {
  updateStatus(): Promise<Result<UpdateStatus>>;
  updateCheck(): Promise<Result<UpdateStatus>>;
  updateAutomatic(enabled: boolean): Promise<Result<UpdateStatus>>;
  updateDownload(): Promise<Result<UpdateStatus>>;
  updateCancel(): Promise<Result<UpdateStatus>>;
  updateInstall(): Promise<Result<void>>;
  updateRuntimeReady(): Promise<Result<void>>;
  onUpdate(callback: (status: UpdateStatus) => void): () => void;
}
