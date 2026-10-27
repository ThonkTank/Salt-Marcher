export interface GraphPreviewState {
  scopeId: string;
  phase: 'graph' | 'raster';
  protected: true;
}
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
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; errorKind?: 'store-outcome-unknown' };
