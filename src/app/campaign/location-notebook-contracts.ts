import type { Result } from '../shared/contracts';
import type { DeskRef } from '../shared/desk-reference';
import type { LocationActivityAPI as importLocationActivityAPI } from './location-activity-contracts';
export type LocationMaterialKind =
  | 'directory'
  | 'npc'
  | 'narrative'
  | 'group'
  | 'shop'
  | 'faction'
  | 'event';
export interface LocationMaterial {
  id: string;
  title: string;
  detail: string;
  ref?: DeskRef;
  unavailable?: boolean;
  locationId?: string | null;
}
export interface LocationMaterialsQuery {
  locationId: string | null;
  kind: LocationMaterialKind;
  text: string;
  offset: number;
  scope?: 'location' | 'campaign';
}
export interface LocationMaterialsPage {
  items: LocationMaterial[];
  next: number | null;
  locationRevision: number | null;
}
export interface LocationNotebookAPI extends importLocationActivityAPI {
  locationMaterials(
    token: string,
    query: LocationMaterialsQuery,
  ): Promise<Result<LocationMaterialsPage>>;
}
