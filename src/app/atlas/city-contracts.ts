import type { CityActivityAPI as importCityActivityAPI } from './city-activity-contracts';
import type { Result } from '../contracts';
export interface CityPoint {
  x: number;
  y: number;
}
export interface CityHousehold {
  id: string;
  name: string;
  memberIds: string[];
}
export interface CityJob {
  id: string;
  name: string;
  workerIds: string[];
}
export interface CityHeader {
  id: string;
  revision: number;
  name: string;
  locationId: string;
  width: number;
  height: number;
  paper: string;
  roof: string;
}
export interface CityUnit {
  terrain?: import('./terrain-objects').TerrainBuilding;
  groupId?: string;
  groupRecipe?: import('./room-group-generator').GroupRecipe;
  footprint?: import('../contracts').Polygon[];
  label?: import('./map-label-style').MapLabelStyle;
  id: string;
  kind: 'node' | 'road' | 'district' | 'plaza' | 'water' | 'wall' | 'building';
  name: string;
  protected: boolean;
  point?: CityPoint;
  nodeIds?: string[];
  via?: CityPoint[];
  width?: number;
  outline?: CityPoint[];
  position?: CityPoint;
  angle?: number;
  use?: string;
  notes?: string;
  districtId?: string | null;
  ownerId?: string | null;
  factionId?: string | null;
  residentIds?: string[];
  workerIds?: string[];
  households?: CityHousehold[];
  jobs?: CityJob[];
  recipe?: { seed: string; algorithm: string };
  interior?: boolean;
}
export interface CityDemographicCount {
  value: string;
  count: number;
}
export interface CityDemographics {
  residentCount: number;
  profiledCount: number;
  ancestries: CityDemographicCount[];
  genders: CityDemographicCount[];
  ages: { years: number; count: number }[];
}
export interface CityFactionPresence {
  id: string;
  name: string;
  available: boolean;
  residentCount: number;
  workerCount: number;
  unitCount: number;
}
export interface CityView {
  header: CityHeader;
  units: CityUnit[];
  demographics: CityDemographics;
  factions: CityFactionPresence[];
  canUndo: boolean;
  canRedo: boolean;
}
export interface CityOverview {
  cities: CityHeader[];
  locations: { id: string; name: string }[];
  factions: { id: string; name: string }[];
  assignedPeople: { id: string; name: string }[];
}
export interface CityPersonMove {
  npcId: string;
  role: 'home' | 'work';
  fromCityId: string;
  fromUnitId: string;
  expectedRevision: number;
}
export interface CityLifeMove {
  role: 'home' | 'work';
  fromCityId: string;
  fromUnitId: string;
  recordId: string;
  expectedRevision: number;
  toUnitId: string;
}
export interface CityBuildingQuery {
  text: string;
  offset: number;
  excludeUnitId?: string;
}
export interface CityBuildingChoice {
  cityId: string;
  unitId: string;
  title: string;
  cityTitle: string;
}
export interface CityBuildingChoices {
  items: CityBuildingChoice[];
  next: number | null;
}
export interface CityCommand {
  commandId: string;
  token: string;
  campaignId: string;
  cityId: string;
  expectedRevision: number;
  action:
    | { kind: 'create'; header: CityHeader }
    | {
        kind: 'change';
        upsert: CityUnit[];
        remove: string[];
        removeGroups?: boolean;
        header?: CityHeader;
        label: string;
        bindingMoves?: CityPersonMove[];
        lifeMoves?: CityLifeMove[];
      }
    | { kind: 'undo' | 'redo' };
}
export interface CityRecipe {
  seed: string;
  density: number;
  size: number;
  reach: number;
  districtId: string;
  use: string;
}
export interface CityPreview {
  cityId: string;
  baseRevision: number;
  recipe: CityRecipe;
  buildings: CityUnit[];
  replaceIds: string[];
  attempts: number;
}
export interface CityAPI extends importCityActivityAPI {
  cityBuildings(token: string, query: CityBuildingQuery): Promise<Result<CityBuildingChoices>>;
  cities(token: string): Promise<Result<CityOverview>>;
  city(token: string, id: string): Promise<Result<CityView>>;
  executeCity(command: CityCommand): Promise<Result<CityView>>;
  exportCity(
    token: string,
    id: string,
    format: 'svg' | 'json',
  ): Promise<Result<{ cancelled: boolean }>>;
}
