import type { TriggerField, TriggerAction } from '../runtime/trigger-contracts';
import { validateDungeonContentValue } from './dungeon-budget-contracts';
import type { DungeonContent } from './dungeon-budget-contracts';
import type { GraphEdit, GraphCommit, GraphPreviewState } from './graph-contracts';
import type { KeyAction, KeyContent } from '../campaign/key-contracts';
import type { DungeonPath, DungeonPassage, PathAPI, PathAction } from './path-contracts';
import type { DungeonVolume, VolumeAction } from './volume-contracts';
import type { Point, Polygon, Room, RoomGeometry, Result, Workspace } from '../shared/contracts';
export type DrawingKind =
  | 'wall'
  | 'door'
  | 'stairs'
  | 'light'
  | 'object'
  | 'path'
  | 'terrain'
  | 'water'
  | 'roof'
  | 'text'
  | 'feature';
export interface DrawingElement {
  content?: DungeonContent;
  id: string;
  revision: number;
  scopeId: string;
  floorId: string;
  roomId: string | null;
  kind: DrawingKind;
  points: Point[];
  name: string;
  notes: string;
  secret: boolean;
  color: string;
  width: number;
  height: number;
  angle: number;
  variant: string;
  blocksSight: boolean;
  blocksSound: boolean;
  passable: boolean;
  state: 'open' | 'closed' | 'locked';
  targetRoomId: string | null;
  targetFloorId: string | null;
  anchor: { roomId: string; polygon: number; edge: number; t: number } | null;
  feature: 'trap' | 'puzzle' | 'curiosity' | 'encounter' | 'loot';
  maxCharges: number;
  resetSeconds: number;
  resetMode: 'empty' | 'used';
  triggerRadius: number;
  triggerHeight: number;
  assetId: string | null;
  zOffsetMeters?: number;
  verticalMeters?: number;
  sound?: { enabled: boolean; rangeMeters: number; dc: number; publicText: string };
  archived: boolean;
}
export interface RoomStyle {
  id: string;
  revision: number;
  scopeId: string;
  ceilingMeters: number;
  fill: string;
  wall: string;
  publicLabel: string;
  secret: boolean;
  trackSurface?: 'stone' | 'mud' | 'sand' | 'snow' | 'water' | 'vegetation';
}
export type DrawingElementGeometry = Omit<DrawingElement, 'notes' | 'content'>;
export interface DrawingView<
  R extends RoomGeometry = Room,
  E extends DrawingElementGeometry = DrawingElement,
> {
  coverage?: 'selected';
  triggerFields?: TriggerField[];
  graphPreview?: GraphPreviewState;
  keyContent?: KeyContent[];
  passageStatuses?: { id: string; outbound: string; inbound: string }[];
  paths?: (DungeonPath & { status: string })[];
  passages?: DungeonPassage[];
  volumes?: DungeonVolume[];
  elements: E[];
  styles: RoomStyle[];
  hiddenRooms: R[];
  hiddenFloors: { id: string; scopeId: string; name: string; sourceElevation: number }[];
  features: {
    id: string;
    revision: number;
    charges: number;
    resetStartedMs: string | null;
    epochId: string | null;
  }[];
}
export type DrawingMapView = Omit<DrawingView<RoomGeometry, DrawingElementGeometry>, 'styles'> & {
  styles: (RoomStyle & { authorRevision?: number | null })[];
};
export type DrawingAction =
  | TriggerAction
  | GraphEdit
  | GraphCommit
  | KeyAction
  | PathAction
  | VolumeAction
  | { kind: 'create-room'; scopeId: string; floorId: string; name: string; polygons: Polygon[] }
  | {
      kind: 'shape';
      roomId: string;
      expectedRevision: number;
      polygons: Polygon[];
      preserveBoundaryAnchors?: boolean;
      transform?: { dx: number; dy: number; scale: number; angle: number; origin: Point };
    }
  | { kind: 'merge'; roomIds: string[]; expectedRevisions: number[] }
  | { kind: 'room-hide'; roomId: string; hidden: boolean }
  | { kind: 'style'; style: RoomStyle; expectedRevision: number | null }
  | {
      kind: 'floor';
      scopeId: string;
      id: string;
      name: string;
      elevation: number;
      cloneId: string | null;
      copyKeys?: boolean;
      hidden: boolean;
    }
  | {
      kind: 'element';
      element: DrawingElement;
      expectedRevision: number | null;
      expectedRoom?: { id: string; revision: number };
    }
  | { kind: 'elements'; elements: DrawingElement[] }
  | { kind: 'element-hide'; id: string; expectedRevision: number; archived: boolean };
export interface DrawingCommand {
  commandId: string;
  token: string;
  campaignId: string;
  action: DrawingAction;
}
export interface DrawingAPI extends PathAPI {
  drawingMap(token: string, roomId?: string, elementId?: string): Promise<Result<DrawingMapView>>;
  drawingElement(token: string, id: string): Promise<Result<DrawingElement>>;
  drawing(token: string): Promise<Result<DrawingView>>;
  executeDrawing(c: DrawingCommand): Promise<Result<{ workspace: Workspace; view: DrawingView }>>;
  activateFeature(
    token: string,
    id: string,
    sceneId: string,
    expectedRevision: number,
    action: 'activate' | 'reset' | 'correct',
    charges: number | null,
    commandId: string,
  ): Promise<Result<DrawingView>>;
  exportDrawing(
    token: string,
    scopeId: string,
    floorId: string,
    format: 'svg' | 'json' | 'keys' | 'document',
    publicOnly: boolean,
  ): Promise<Result<{ cancelled: boolean }>>;
}

export function validateDrawingElement(e: unknown): asserts e is DrawingElement {
  const object = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000;
  const optionalId = (v: unknown) => v === null || id(v);
  const text = (v: unknown, limit = 2000000) => typeof v === 'string' && v.length <= limit;
  if (!object(e)) throw new Error('Zeichnungselement prüfen.');
  if (
    !id(e.id) ||
    !id(e.scopeId) ||
    !id(e.floorId) ||
    !optionalId(e.roomId) ||
    !Number.isSafeInteger(e.revision) ||
    e.revision < 0 ||
    ![
      'wall',
      'door',
      'stairs',
      'light',
      'object',
      'path',
      'terrain',
      'water',
      'roof',
      'text',
      'feature',
    ].includes(e.kind) ||
    ![e.secret, e.archived, e.blocksSight, e.blocksSound, e.passable].every(
      (v) => typeof v === 'boolean',
    ) ||
    !['open', 'closed', 'locked'].includes(e.state) ||
    !['trap', 'puzzle', 'curiosity', 'encounter', 'loot'].includes(e.feature) ||
    !['empty', 'used'].includes(e.resetMode) ||
    !optionalId(e.targetRoomId) ||
    !optionalId(e.targetFloorId) ||
    !optionalId(e.assetId)
  )
    throw new Error('Zeichnungsidentität, Typ oder Zustand prüfen.');
  if (
    !Array.isArray(e.points) ||
    !e.points.length ||
    e.points.length > 5000 ||
    e.points.some(
      (p) =>
        !object(p) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 1e8 ||
        Math.abs(p.y) > 1e8,
    ) ||
    !Number.isFinite(e.width) ||
    !Number.isFinite(e.height) ||
    !Number.isFinite(e.angle) ||
    e.width <= 0 ||
    e.height <= 0 ||
    e.width > 10000 ||
    e.height > 10000 ||
    typeof e.color !== 'string' ||
    !/^#[a-f0-9]{6}$/i.test(e.color) ||
    !text(e.name) ||
    !text(e.notes) ||
    !text(e.variant, 1000) ||
    !Number.isSafeInteger(e.maxCharges) ||
    e.maxCharges < 0 ||
    e.maxCharges > 100000 ||
    !Number.isSafeInteger(e.resetSeconds) ||
    e.resetSeconds < 0 ||
    !Number.isFinite(e.triggerRadius) ||
    e.triggerRadius < 0 ||
    e.triggerRadius > 10000 ||
    !Number.isFinite(e.triggerHeight) ||
    e.triggerHeight < 0 ||
    e.triggerHeight > 10000
  )
    throw new Error('Elementmaße, Text, Farbe oder Featurewerte prüfen.');
  if (
    e.anchor !== null &&
    (!object(e.anchor) ||
      !id(e.anchor.roomId) ||
      !Number.isSafeInteger(e.anchor.polygon) ||
      e.anchor.polygon < 0 ||
      !Number.isSafeInteger(e.anchor.edge) ||
      e.anchor.edge < 0 ||
      !Number.isFinite(e.anchor.t) ||
      e.anchor.t < 0 ||
      e.anchor.t > 1)
  )
    throw new Error('Elementanker prüfen.');
  if (
    (e.zOffsetMeters !== undefined &&
      (!Number.isFinite(e.zOffsetMeters) || Math.abs(e.zOffsetMeters) > 10000)) ||
    (e.verticalMeters !== undefined &&
      (!Number.isFinite(e.verticalMeters) || e.verticalMeters <= 0 || e.verticalMeters > 10000))
  )
    throw new Error('3D-Elementhöhe prüfen.');
  if (
    e.sound !== undefined &&
    (!object(e.sound) ||
      typeof e.sound.enabled !== 'boolean' ||
      !Number.isFinite(e.sound.rangeMeters) ||
      e.sound.rangeMeters < 0 ||
      e.sound.rangeMeters > 1000 ||
      !Number.isFinite(e.sound.dc) ||
      e.sound.dc < -100 ||
      e.sound.dc > 100 ||
      !text(e.sound.publicText, 1000))
  )
    throw new Error('Geräuschquelle prüfen.');
  if (e.content !== undefined) {
    validateDungeonContentValue(e.content);
    if (
      e.kind !== 'feature' ||
      (e.content.reference &&
        (e.feature === 'encounter'
          ? !['encounter', 'group'].includes(e.content.reference.kind)
          : e.feature === 'loot'
            ? e.content.reference.kind !== 'treasure'
            : true))
    )
      throw new Error('Inhaltszuordnung passt nicht zum Featuretyp.');
  }
}
