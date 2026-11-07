import type { Terrain } from './world-cell-contracts';
import type { Hex } from './world-cell-contracts';
import type { Weather } from './weather-contracts';

export interface Journey {
  supplies?: string[];
  id: string;
  revision: number;
  sceneId: string;
  mapId: string;
  mapRevision: number;
  // Older journeys remain readable, but cannot resume without their original bases.
  clockRevision?: number;
  positionRevision?: number;
  environmentBasis?: string;
  actorIds: string[];
  membershipRevision: number;
  status: 'active' | 'paused' | 'interrupted' | 'arrived' | 'ended';
  route: Hex[];
  nextIndex: number;
  paceKmh: number;
  usePartyPace?: boolean;
  factor: number;
  finalSeconds: number | null;
  plannedSeconds: number;
  segmentSeconds: number[];
  destinationLocationId: string | null;
  reason: string;
  createdAt: string;
  presentationSpeed?: 1 | 2 | 5 | 10;
  continuedFrom?: { id: string; revision: number; completedSteps: number };
}

export interface TravelHistoryView {
  undo: {
    id: string;
    revision: number;
    journeyId: string;
    label: string;
    retainedShared?: boolean;
  } | null;
  redo: {
    id: string;
    revision: number;
    journeyId: string;
    label: string;
    retainedShared?: boolean;
  } | null;
}

export interface TravelRequest {
  supplies?: string[];
  sceneId: string;
  destination: Hex;
  mapId: string;
  destinationLocationId: string | null;
  waypoints: Hex[];
  paceKmh: number;
  usePartyPace?: boolean;
  factor: number;
  finalSeconds: number | null;
  continuation?: { journeyId: string; expectedRevision: number };
}

export interface TravelStage {
  index: number;
  hex: Hex;
  seconds: number;
  arrival: string;
  placeName: string;
  terrain: Terrain;
  weather: Weather;
  interrupt: string;
}

export interface TravelPreview {
  environmentBasis: string;
  request: TravelRequest;
  route: Hex[];
  distanceMeters: number;
  durationSeconds: number;
  terrainCost: number;
  segmentSeconds: number[];
  calendarRevision: number;
  mapRevision: number;
  clockRevision: number;
  positionRevision: number;
  membershipRevision: number;
  actorIds: string[];
  weather: Weather | null;
  departure: string;
  arrival: string;
  warnings: string[];
  stages: TravelStage[];
  events: { name: string; date: string; state: 'active' | 'upcoming' }[];
  continuation?: {
    journeyId: string;
    revision: number;
    completedSteps: number;
    previousRemainingSeconds: number;
  };
}
