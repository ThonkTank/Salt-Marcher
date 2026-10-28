import { type Hex, type AtlasCell, type MarkerPresentation } from './world-cell-contracts';
import { type AtlasMap, type AtlasPlace } from './world-map-contracts';
import { type FantasyCalendar, type CalendarEvent } from './calendar-contracts';
import { type Weather, type WeatherPhenomenon } from './weather-contracts';
import {
  type Journey,
  type TravelHistoryView,
  type TravelRequest,
  type TravelPreview,
} from './world-travel-contracts';

import type { DungeonPose } from '../atlas/dungeon-position-contracts';
import type { Result } from '../shared/contracts';
import type { LiveScene } from './live-scene-contracts';
export interface ScenePosition extends Hex {
  city?: { cityId: string; x: number; y: number; z: number };
  outdoor?: { x: number; y: number };
  revision: number;
  mapId: string | null;
  locationId: string | null;
  dungeon?: DungeonPose | null;
}
export interface WorldView {
  calendar: FantasyCalendar;
  maps: AtlasMap[];
  places: AtlasPlace[];
  events: CalendarEvent[];
  phenomena: WeatherPhenomenon[];
}
export interface SceneWorld {
  scene: LiveScene;
  position: ScenePosition;
  date: string;
  weather: Weather | null;
  weatherOverrideRevision: number | null;
  events: CalendarEvent[];
  notices: { id: string; text: string }[];
  journey: Journey | null;
  knowledge: { mapId: string; q: number; r: number }[];
  history: { id: string; text: string }[];
  travelHistory?: TravelHistoryView;
}
export type WorldAction =
  | { kind: 'calendar'; calendar: FantasyCalendar; expectedRevision: number }
  | { kind: 'map'; map: AtlasMap; expectedRevision: number | null }
  | { kind: 'cell'; mapId: string; expectedRevision: number; cell: AtlasCell }
  | {
      kind: 'place';
      mapId: string;
      locationId: string;
      expectedRevision: number | null;
      expectedLocationRevision?: number;
      hex: Hex;
    }
  | {
      kind: 'place-presentation';
      locationId: string;
      expectedRevision: number | null;
      presentation: MarkerPresentation;
    }
  | {
      kind: 'calendar-event';
      event: CalendarEvent;
      expectedRevision: number | null;
      basis?: import('./agenda-contracts').AgendaBasis;
    }
  | { kind: 'phenomenon'; phenomenon: WeatherPhenomenon; expectedRevision: number | null }
  | {
      kind: 'weather-override';
      sceneId: string;
      expectedClockRevision: number;
      expectedOverrideRevision: number | null;
      weather: Weather | null;
    }
  | { kind: 'notice-dismiss'; sceneId: string; id: string }
  | { kind: 'reveal'; sceneId: string; mapId: string; hex: Hex; expectedMembershipRevision: number }
  | {
      kind: 'place-scene';
      placementBasis?: {
        mapRevision: number;
        membershipRevision: number;
        requireAuthored: boolean;
      };
      sceneId: string;
      position: Omit<ScenePosition, 'revision'>;
      expectedSceneRevision: number;
      expectedPositionRevision: number;
    }
  | { kind: 'journey'; preview: TravelPreview; presentationSpeed?: 1 | 2 | 5 | 10 }
  | { kind: 'journey-step'; id: string; expectedRevision: number; maxSteps: number }
  | {
      kind: 'travel-history';
      sceneId: string;
      id: string;
      revision: number;
      direction: 'undo' | 'redo';
      expectedClockRevision: number;
      expectedPositionRevision: number;
      expectedJourneyRevision: number;
    }
  | {
      kind: 'journey-state';
      id: string;
      expectedRevision: number;
      state: 'active' | 'paused' | 'ended';
    };
export interface WorldCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action: WorldAction;
}
export interface WorldAck {
  world: WorldView;
  scene: SceneWorld | null;
}
export type WorldReconciliation =
  | { outcome: 'applied'; ack: WorldAck }
  | { outcome: 'not-applied'; ack: null };
export interface WorldAPI {
  reconcileWorld(command: WorldCommand, token: string): Promise<Result<WorldReconciliation>>;
  world(token: string): Promise<Result<WorldView>>;
  sceneWorld(token: string, sceneId: string): Promise<Result<SceneWorld>>;
  previewTravel(token: string, request: TravelRequest): Promise<Result<TravelPreview>>;
  executeWorld(command: WorldCommand): Promise<Result<WorldAck>>;
}
