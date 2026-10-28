import type { Result } from '../shared/contracts';
export interface CityActivityQuery {
  cityId: string;
  sceneId: string | null;
  focusFallback: boolean;
  unitId: string | null;
  text: string;
  offset: number;
}
export interface CityActivitySite {
  cityId: string;
  unitId: string;
  title: string;
  detail: string;
  available: boolean;
}
export interface CityActivityRow {
  id: string;
  name: string;
  defeated: boolean;
  actualLocation: string;
  actualRoom: string | null;
  atCityLocation: boolean;
  home: CityActivitySite | null;
  work: CityActivitySite | null;
  current: {
    activity: string;
    time: string;
    place: 'home' | 'work' | 'other' | 'location';
    locationTarget?: import('../campaign/npc-data-contracts').NpcPlanLocation | null;
    notes: string;
    target: CityActivitySite | null;
  } | null;
  next: { activity: string; date: string } | null;
  overrideLabel: string | null;
  problem: string | null;
}
export interface CityActivityPage {
  cityId: string;
  cityRevision: number;
  sceneId: string | null;
  sceneTitle: string;
  date: string;
  clockRevision: number | null;
  instantMs: string | null;
  scenes: { id: string; title: string }[];
  rows: CityActivityRow[];
  next: number | null;
}
export interface CityActivityAPI {
  cityActivities(token: string, query: CityActivityQuery): Promise<Result<CityActivityPage>>;
}
