import type { Room, RoomGeometry } from '../shared/contracts';
import type { DrawingView } from './drawing-view-contracts';
import type { DrawingElement, DrawingElementGeometry } from './drawing-element-contracts';

export type SpatialGeometry = DungeonGeometry<RoomGeometry, DrawingElementGeometry>;

export interface DungeonGeometry<
  R extends RoomGeometry = Room,
  E extends DrawingElementGeometry = DrawingElement,
> {
  rooms: R[];
  floors: { id: string; scopeId: string; name: string; elevation: number }[];
  drawing: DrawingView<R, E>;
}
