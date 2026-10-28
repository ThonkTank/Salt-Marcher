import type { CityHeader, CityUnit } from './city-data-contracts';

/** Geometry is display-only. In particular it is never a CityCommand upsert. */
export type CityUnitGeometry = Pick<
  CityUnit,
  | 'label'
  | 'id'
  | 'kind'
  | 'name'
  | 'protected'
  | 'point'
  | 'footprint'
  | 'outline'
  | 'position'
  | 'angle'
  | 'width'
  | 'interior'
  | 'terrain'
> & { floorElevations?: number[] };

export interface CityGeometry {
  header: CityHeader;
  units: CityUnitGeometry[];
}
