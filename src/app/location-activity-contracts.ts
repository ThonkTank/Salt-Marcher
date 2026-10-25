import type { Result } from './contracts';
import type { CityActivitySite } from './atlas/city-activity-contracts';
export interface LocationActivityQuery {
  locationId: string;
  sceneId: string | null;
  focusFallback: boolean;
  text: string;
  offset: number;
}
export interface LocationVisit {
  activity: string;
  time: string;
  notes: string;
  house: CityActivitySite | null;
}
export interface LocationActivityRow {
  id: string;
  name: string;
  defeated: boolean;
  actualLocation: string;
  actualRoom: string | null;
  atLocation: boolean;
  current: LocationVisit | null;
  next: (LocationVisit & { date: string }) | null;
  overrideLabel: string | null;
  problem: string | null;
}
export interface LocationActivityPage {
  locationId: string;
  locationRevision: number;
  sceneId: string | null;
  sceneTitle: string;
  date: string;
  scenes: { id: string; title: string }[];
  rows: LocationActivityRow[];
  next: number | null;
}
export interface LocationActivityAPI {
  locationActivities(
    token: string,
    q: LocationActivityQuery,
  ): Promise<Result<LocationActivityPage>>;
}
