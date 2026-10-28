import {
  type CityHeader,
  type CityUnit,
  type CityView,
  type CityOverview,
  type CityPersonMove,
  type CityLifeMove,
} from './city-data-contracts';
import type { CityActivityAPI as importCityActivityAPI } from './city-activity-contracts';
import type { Result } from '../shared/contracts';
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
