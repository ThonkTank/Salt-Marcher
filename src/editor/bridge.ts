import type { Bounds, HeightTile } from "./model";

/** The renderer can request document operations, never arbitrary paths or SQL. */
export interface ProjectInfo {
  sessionId: string;
  projectId: string;
  format: 23;
  title: string;
  sequence: number;
  savedSequence: number | null;
  path: string | null;
  activeLevels: number[];
  sourceTiles: number;
}

export interface SourceBoundary {
  sessionId: string;
  sequence: number;
}

export interface ReadTilesRequest {
  sessionId: string;
  keys: string[];
}

export interface ReadRegionRequest {
  sessionId: string;
  bounds: Bounds;
  /** Omit to request every level whose cubic support intersects the region. */
  level?: number;
}

export interface SourceRead extends SourceBoundary {
  tiles: HeightTile[];
}

export interface RegionRead extends SourceRead {
  bounds: Bounds;
  level?: number;
}

export interface CommitRequest extends SourceBoundary {
  transactionId: string;
  patches: { key: string; after: HeightTile | null }[];
}

export interface CommitReceipt extends SourceBoundary {
  transactionId: string;
}

export interface SaveRequest extends SourceBoundary {
  saveAs?: boolean;
}

export interface SaveResult extends SourceBoundary {
  savedSequence: number;
  path: string;
}

export interface StoreMetrics {
  reads: number;
  returnedTiles: number;
  returnedBytes: number;
  commits: number;
  committedTiles: number;
  snapshots: number;
}

export interface AtlasDesktop {
  status(): Promise<ProjectInfo>;
  readTiles(request: ReadTilesRequest): Promise<SourceRead>;
  readRegion(request: ReadRegionRequest): Promise<RegionRead>;
  commit(request: CommitRequest): Promise<CommitReceipt>;
  /** Null means the user cancelled the native file/unsaved-changes dialog. */
  newProject(): Promise<ProjectInfo | null>;
  openProject(): Promise<ProjectInfo | null>;
  saveProject(request: SaveRequest): Promise<SaveResult | null>;
  /** Observation only; it neither waits for nor changes document readiness. */
  metrics(): Promise<StoreMetrics>;
}

declare global {
  interface Window {
    atlasDesktop: AtlasDesktop;
  }
}
