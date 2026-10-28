import type { Polygon, Room } from '../shared/contracts';
import type { DrawingElement } from './drawing-element-contracts';

export const GROUP_PROFILES = [
  'Wohnhaus',
  'Werkstatt',
  'Handel',
  'Taverne',
  'Tempel',
  'Lager',
  'Gewölbe',
  'Krypta',
  'Höhle',
] as const;

export type GroupProfile = (typeof GROUP_PROFILES)[number];

export interface GroupRecipe {
  version: 1;
  seed: string;
  profile: GroupProfile;
  width: number;
  depth: number;
  floors?: number;
  basement?: boolean;
}

export interface GroupDraft {
  recipe: GroupRecipe;
  floors: { id: string; name: string; elevation: number }[];
  rooms: Room[];
  elements: DrawingElement[];
  footprint: Polygon[];
}
