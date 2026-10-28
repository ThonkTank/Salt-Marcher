import type { MarkerPresentation } from './world-cell-contracts';
export type WorldEdits = { map: number; calendar: number; phenomenon: number; marker: number };
export type WeatherOwner = {
  token: string;
  campaignId: string;
  sceneId: string;
  generation: number;
  clockRevision: number;
  overrideRevision: number | null;
};
export type WeatherIntent = { owner: WeatherOwner; version: number; preserveDraft?: boolean };
export type TravelOwner = {
  token: string;
  sceneId: string;
  mapId: string;
  generation: number;
  sceneSelection: number;
  mapSelection: number;
};
export type MarkerDraft = {
  id: string;
  revision: number;
  presentation: MarkerPresentation;
  dirty: boolean;
};

export type MapProjectionContext = {
  token: string;
  generation: number;
  mapSelection: number;
  sceneSelection: number;
};
