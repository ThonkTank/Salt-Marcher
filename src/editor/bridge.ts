import type {
  Bounds,
  HeightTile,
  LandscapeTile,
  HouseHeader,
  SourcePatch,
} from "./model";
import type {
  LandscapePresentationRead,
  LandscapePresentationRequest,
} from "./model/landscape";
export type {
  LandscapePresentationRead,
  LandscapePresentationRequest,
} from "./model/landscape";
import type {
  HeightPresentationRead,
  HeightPresentationRequest,
} from "./model/overview";

/** The renderer can request document operations, never arbitrary paths or SQL. */
export interface ProjectInfo {
  sessionId: string;
  projectId: string;
  format: 26;
  title: string;
  sequence: number;
  savedSequence: number | null;
  path: string | null;
  activeLevels: number[];
  sourceTiles: number;
  landscapeTiles: number;
  houses: number;
  activeLandscapeLevels: number[];
}

export interface SourceBoundary {
  sessionId: string;
  sequence: number;
}

/** Every accepted local edit is finished before this replacement boundary. */
export interface PreparedDocument extends SourceBoundary {
  persistenceError: string | null;
}

export interface FileActionRequest {
  kind: "prepare" | "resume" | "recover";
  error?: string;
}

export interface ReadRegionRequest {
  sessionId: string;
  bounds: Bounds;
  /** Omit to request every level whose cubic support intersects the region. */
  level?: number;
  /** Explicit lowest author level needed by this editing operation. */
  minLevel?: number;
}

export type ReadPresentationRequest = HeightPresentationRequest;
export type PresentationRead = HeightPresentationRead;

export interface SourceRead extends SourceBoundary {
  tiles: HeightTile[];
}

export interface RegionRead extends SourceRead {
  bounds: Bounds;
  level?: number;
}

export interface ReadLandscapeRegionRequest {
  sessionId: string;
  bounds: Bounds;
  minLevel: number;
}

export interface LandscapeRegionRead extends SourceBoundary {
  bounds: Bounds;
  minLevel: number;
  tiles: LandscapeTile[];
}

export interface ReadHouseRegionRequest {
  sessionId: string;
  bounds: Bounds;
}

export interface HouseRegionRead extends SourceBoundary {
  bounds: Bounds;
  headers: HouseHeader[];
}

export type CommitPatch =
  | Omit<Extract<SourcePatch, { kind: "height" }>, "before">
  | Omit<Extract<SourcePatch, { kind: "landscape" }>, "before">
  | Omit<Extract<SourcePatch, { kind: "house" }>, "before">;

export interface CommitRequest extends SourceBoundary {
  transactionId: string;
  patches: CommitPatch[];
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
  readonly diagnostics: boolean;
  onFileAction(
    handler: (request: FileActionRequest) => Promise<PreparedDocument | null>,
  ): () => void;
  status(): Promise<ProjectInfo>;
  readRegion(request: ReadRegionRequest): Promise<RegionRead>;
  readPresentation(request: ReadPresentationRequest): Promise<PresentationRead>;
  readLandscapeRegion(
    request: ReadLandscapeRegionRequest,
  ): Promise<LandscapeRegionRead>;
  readLandscapePresentation(
    request: LandscapePresentationRequest,
  ): Promise<LandscapePresentationRead>;
  readHouseRegion(request: ReadHouseRegionRequest): Promise<HouseRegionRead>;
  commit(request: CommitRequest): Promise<CommitReceipt>;
  /** Null means the user cancelled the native file/unsaved-changes dialog. */
  newProject(prepared: PreparedDocument): Promise<ProjectInfo | null>;
  openProject(prepared: PreparedDocument): Promise<ProjectInfo | null>;
  saveProject(request: SaveRequest): Promise<SaveResult | null>;
  /** Observation only; it neither waits for nor changes document readiness. */
  metrics(): Promise<StoreMetrics>;
}

declare global {
  interface Window {
    atlasDesktop: AtlasDesktop;
  }
}
