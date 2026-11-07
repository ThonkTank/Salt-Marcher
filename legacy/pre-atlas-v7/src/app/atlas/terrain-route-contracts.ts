import type { Point } from '../shared/contracts';

export type RouteStructure = 'ground' | 'bridge' | 'ford' | 'tunnel';

export interface RouteLimits {
  corridor: number;
  cut: number;
  fill: number;
  shoulder: number;
  grade: number;
  depth: number;
  clearance: number;
}

export interface RouteNode extends Point {
  z: number;
  structure: RouteStructure;
}

export interface TerrainRoute {
  version: 1;
  anchors: Point[];
  limits: RouteLimits;
  protected: boolean;
  /** One explicit choice per anchor interval. Auto is resolved before saving. */
  sections: ('auto' | RouteStructure)[];
  nodes: RouteNode[];
  mouth?: { id: string; point: Point };
  conflict?: string;
}
