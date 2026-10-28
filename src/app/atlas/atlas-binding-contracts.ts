export interface AtlasBinding {
  id: string;
  kind: 'city' | 'dungeon';
  ownerId: string;
  parent: 'world' | 'building';
  parentId: string | null;
  x: number;
  y: number;
  angle: number;
  revision: number;
}
