import type { KeyContent } from '../campaign/key-contracts';
import type { TriggerField } from '../runtime/trigger-contracts';
import type { GraphPreviewState, Room, RoomGeometry } from '../shared/contracts';

import type { DungeonPassage, DungeonPath } from './path-contracts';
import type { DungeonVolume } from './volume-contracts';
import type { DrawingElement } from './drawing-element-contracts';
import type { RoomStyle } from './drawing-element-contracts';
import type { DrawingElementGeometry } from './drawing-element-contracts';

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
