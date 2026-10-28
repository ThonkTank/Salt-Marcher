import type { AtlasEntrance, AtlasLocalJourney } from './atlas-journey-contracts';
import type { WorkspaceState, Room, RoomGeometry } from '../shared/contracts';

import type { CityView } from './city-data-contracts';
import type { SceneWorld } from '../runtime/world-contracts';
import type { AtlasMap } from '../runtime/world-map-contracts';
import type { DungeonView } from './dungeon-contracts';

import type { DrawingElement, DrawingElementGeometry } from './drawing-element-contracts';
import type { AtlasBinding } from './atlas-binding-contracts';

export interface CampaignAtlas<
  R extends RoomGeometry = Room,
  E extends DrawingElementGeometry = DrawingElement,
  C extends import('./city-geometry-contracts').CityGeometry = CityView,
> {
  scopes: { id: string; name: string }[];
  perception: import('./dungeon-travel-contracts').DungeonDisplay | null;
  entrances: AtlasEntrance[];
  localJourney: AtlasLocalJourney | null;
  campaignId: string;
  revision: number;
  terrain: AtlasMap;
  bindings: AtlasBinding[];
  cities: C[];
  geometry: DungeonView<R, E>;
  workspace: WorkspaceState<R>;
  scene: SceneWorld | null;
  canUndo: boolean;
  canRedo: boolean;
}

export type AtlasRenderView = Omit<
  CampaignAtlas<
    RoomGeometry,
    DrawingElementGeometry,
    import('./city-geometry-contracts').CityGeometry
  >,
  'scene' | 'terrain' | 'geometry'
> & {
  geometry: DungeonMapView;
  terrain: Omit<AtlasMap, 'cells' | 'landscape'>;
  scene: Pick<SceneWorld, 'scene' | 'position' | 'journey'> | null;
  region?: Omit<
    import('./atlas-region-geometry-contracts').AtlasRegionGeometry,
    'rooms' | 'floors' | 'drawing' | 'cities' | 'bindings' | 'scopes'
  >;
};

/** Map authoring publishes geometry independently of the optional live overlay. */
export type DungeonMapRuntime = Pick<DungeonView, 'npcs' | 'tracks' | 'senses' | 'traceRules'>;
export type DungeonMapView = Omit<
  DungeonView<RoomGeometry, DrawingElementGeometry>,
  keyof DungeonMapRuntime
> & { runtime: import('../shared/contracts').Result<DungeonMapRuntime> };
