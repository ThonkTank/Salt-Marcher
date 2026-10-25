import type { CityPersonMove } from '../atlas/city-contracts';
import type { Result } from '../shared/contracts';
export type NpcPlaceSite = (
  | { kind: 'home' | 'work'; cityId: string; unitId: string }
  | { kind: 'dungeon'; roomId: string; scopeId: string; floorId: string }
) & { id: string; title: string; detail: string; available: boolean };
export interface NpcPlaces {
  npcId: string;
  name: string;
  locationTitle: string;
  sites: NpcPlaceSite[];
  next: number | null;
}
export interface NpcBuildingQuery {
  role: 'home' | 'work';
  text: string;
  offset: number;
}
export interface NpcBuildingChoices {
  npcId: string;
  name: string;
  currentCityTitle: string | null;
  currentBinding: Omit<CityPersonMove, 'npcId' | 'role'> | null;
  items: { cityId: string; unitId: string; title: string; cityTitle: string }[];
  next: number | null;
}
export interface NpcBuildingAssignment {
  kind: 'assign';
  role: 'home' | 'work';
  npcId: string;
  cityId: string;
  unitId: string;
  recordName: string;
  from?: Omit<CityPersonMove, 'npcId' | 'role'>;
}
export type NpcPlaceChoice = NpcPlaceSite | NpcBuildingAssignment;
export interface NpcPlacesAPI {
  npcBuildingChoices(
    token: string,
    id: string,
    query: NpcBuildingQuery,
  ): Promise<Result<NpcBuildingChoices>>;
  npcPlaces(token: string, id: string, offset: number): Promise<Result<NpcPlaces>>;
}
