import type { Point } from '../shared/contracts';
import type { DrawingElement } from './drawing-contracts';
/** Shared context values; their mutable state belongs to the author controller. */
export type AtlasSelection =
  | {
      kind: 'city';
      id: string;
    }
  | {
      kind: 'scope';
      id: string;
    }
  | {
      kind: 'building';
      id: string;
      cityId: string;
    }
  | {
      kind: 'city-unit';
      id: string;
      cityId: string;
    }
  | {
      kind: 'room';
      id: string;
    }
  | {
      kind: 'element';
      id: string;
    }
  | null;
export type AtlasFamily = 'navigation' | 'terrain' | 'city' | 'interior' | 'decoration' | 'travel';
export type AtlasRoomDrag = {
  id: number;
  scopeId: string;
  floorId: string;
  start: Point;
  last: Point;
  x: number;
  y: number;
  moved: boolean;
};
export type AtlasPathDrag = {
  id: number;
  token: string | undefined;
  element: DrawingElement;
  index: number;
  insert: boolean;
  point: Point;
  x: number;
  y: number;
  moved: boolean;
};

/** Read-only geometry published by the region owner. */
export interface AtlasRegionView {
  readonly data: import('./campaign-atlas-contracts').AtlasRenderView | null;
  geometryCurrent(): boolean;
}
export interface AtlasRegionEditing extends AtlasRegionView {
  readonly loadedRegionQuery: import('./atlas-region-contracts').AtlasRegionQuery | null;
  refresh(keepScene?: boolean): Promise<boolean | undefined>;
  scheduleRegion(camera?: boolean): void;
}
/** Region reads fence the journey preview; they never write journey state. */
export interface AtlasJourneyContext {
  readonly entranceId: string | null;
  beginContextRead(keepPreview?: boolean): boolean;
  completeContextRead(fence: string): void;
  failContextRead(): void;
  renderTravel(): void;
}
export interface AtlasJourneySelection {
  invalidatePreview(): void;
  selectEntrance(id: string | null): void;
  renderTravel(): void;
}
export interface AtlasJourneyView {
  readonly localPreview: import('./atlas-travel-contracts').AtlasLocalPreview | null;
}
/** Pointer handling belongs to output; authoring cannot mutate an export drag. */
export interface AtlasOutputSelection {
  readonly exportOpen: boolean;
  beginArea(event: PointerEvent, point: Point): void;
  moveArea(event: PointerEvent, point: Point): boolean;
  ownsAreaPointer(pointerId: number): boolean;
  endArea(event: PointerEvent, point: Point): boolean;
}
export interface AtlasOutputView {
  readonly exportOpen: boolean;
  selectionBox(): import('../runtime/passive-map-canvas').CanvasBox | null;
}
export interface AtlasAuthorView {
  readonly drag: Readonly<{
    id: number;
    start: Point;
    last: Point;
    selection: AtlasSelection;
  }> | null;
  readonly measurementHover: Point | null;
  readonly roomDrag: Readonly<AtlasRoomDrag> | null;
  readonly draft: readonly Point[];
  readonly selection: AtlasSelection;
  readonly pathDrag: Readonly<AtlasPathDrag> | null;
  readonly partyDrag: Readonly<{ id: number; start: Point; last: Point }> | null;
}
