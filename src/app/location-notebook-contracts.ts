import type { LocationActivityAPI as importLocationActivityAPI } from './location-activity-contracts';
import type { Result } from './contracts';
import type { DeskRef } from './scene-desk-contracts';
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
