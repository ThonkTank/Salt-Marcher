import type { AtlasWorkplane } from './atlas-workplane';
import type { CanvasBox } from './atlas-camera';
import type { Point } from '../shared/contracts';
import type { LandscapeRecord } from './landscape-contracts';
export interface TerrainDraft {
  routeRecords: LandscapeRecord[];
}
export type AtlasPresentationHost = {
  draft: () => TerrainDraft | null;
  editingRadius?: () => number;
  live: () => boolean;
  hasDraft: () => boolean;
  navigationLocked?: () => boolean;
  writing: () => boolean;
  cancel: () => void;
  tool: () => string;
  workplane?: () => AtlasWorkplane | null;
  objectPicking?: () => boolean;
  navigate?: (box: CanvasBox, coalesce?: boolean) => void;
  navigation: (event: PointerEvent) => boolean;
  panning: () => boolean;
  redraw: () => void;
  refresh?: () => Promise<boolean | undefined>;
  recovered?: (message: string) => void;
  route?: (kind: 'road' | 'river') => Promise<void>;
  error: (error: unknown) => void;
  selection: () => Point | null;
};
