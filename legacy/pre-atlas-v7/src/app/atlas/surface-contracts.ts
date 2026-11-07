export type SurfaceSide = 'north' | 'east' | 'south' | 'west' | 'floor' | 'ceiling';

export interface SurfaceFace {
  x: number;
  y: number;
  z: number;
  side: SurfaceSide;
}

export interface SurfaceRegion {
  roomId: string;
  fragments: {
    id: string;
    volumeId: string;
    faces: SurfaceFace[];
    unbound?: boolean;
    orphanedWorld?: { floorId: string; faces: SurfaceFace[] };
  }[];
}
