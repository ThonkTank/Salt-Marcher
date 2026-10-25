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
