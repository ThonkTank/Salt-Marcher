import type { Point, Polygon } from "../../model";

export const CITY_FORMAT_VERSION = 1;
/** All points are local meters; the Atlas owns the city's world placement. */
export interface CityRoadNode {
  readonly id: string;
  readonly point: Point;
}
export interface CityRoad {
  readonly id: string;
  readonly startNodeId: string;
  readonly endNodeId: string;
  /** Interior points only. Endpoints come from the referenced nodes. */
  readonly via: readonly Point[];
  readonly widthMeters: number;
}
export interface CityArea {
  readonly id: string;
  readonly name: string;
  readonly outline: Polygon;
}
export interface CityPlot {
  readonly id: string;
  readonly outline: Polygon;
  readonly districtId?: string;
}
export interface CityBuilding {
  readonly id: string;
  readonly name: string;
  /** Meter geometry relative to this building's position, before its pose. */
  readonly footprint: Polygon;
  readonly position: Point;
  readonly rotationRadians: number;
  readonly scale: Point;
  readonly plotId?: string;
}
export interface CityDocument {
  readonly kind: "city";
  readonly version: typeof CITY_FORMAT_VERSION;
  readonly id: string;
  readonly name: string;
  readonly units: "meters";
  readonly roadNodes: readonly CityRoadNode[];
  readonly roads: readonly CityRoad[];
  readonly plazas: readonly CityArea[];
  readonly plots: readonly CityPlot[];
  readonly districts: readonly CityArea[];
  readonly buildings: readonly CityBuilding[];
}
