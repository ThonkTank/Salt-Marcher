import type { AtlasWorkplane } from './atlas-workplane';
import type { Point } from '../contracts';
import type { LandscapeRecord } from './atlas-landscape';
export interface TerrainDraft {
  routeRecords: LandscapeRecord[];
}
export type AtlasPresentationHost = {
  draft: () => TerrainDraft | null;
  live: () => boolean;
  hasDraft: () => boolean;
  navigationLocked?: () => boolean;
  writing: () => boolean;
  cancel: () => void;
  tool: () => string;
  workplane?: () => AtlasWorkplane | null;
  objectPicking?: () => boolean;
  navigation: (event: PointerEvent) => boolean;
  panning: () => boolean;
  redraw: () => void;
  refresh?: () => Promise<boolean | undefined>;
  recovered?: (message: string) => void;
  route?: (kind: 'road' | 'river') => Promise<void>;
  error: (error: unknown) => void;
  selection: () => Point | null;
};
