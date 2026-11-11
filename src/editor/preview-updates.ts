export interface PreviewBuild {
  version: string;
  revision: string | null;
  commit: string;
}

export interface PreviewRelease extends PreviewBuild {
  revision: string;
  publishedAt: string;
}

export type PreviewUpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "installed"
  | "restart-required"
  | "error"
  | "unsupported";

export interface PreviewUpdateState {
  status: PreviewUpdateStatus;
  current: PreviewBuild;
  available: PreviewRelease | null;
  downloadedBytes: number;
  totalBytes: number;
  message: string;
  canInstall: boolean;
  downloaded: boolean;
}

export interface AtlasUpdates {
  status(): Promise<PreviewUpdateState>;
  check(): Promise<PreviewUpdateState>;
  download(): Promise<PreviewUpdateState>;
  install(): Promise<PreviewUpdateState>;
  restart(): Promise<void>;
  openRelease(): Promise<void>;
  onStatus(listener: (state: PreviewUpdateState) => void): () => void;
}

declare global {
  interface Window {
    atlasUpdates: AtlasUpdates;
  }
}
