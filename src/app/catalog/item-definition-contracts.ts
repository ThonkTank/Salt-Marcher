import type { ItemCategory } from './item-input-contracts';

export interface ItemDefinition {
  id: string;
  revision: number;
  name: string;
  category: ItemCategory;
  magic: boolean;
  rarity: string;
  attunement: 'no' | 'yes' | 'unspecified';
  unitCopper: string | null;
  weightText: string;
  properties: string[];
  description: string;
  source: { kind: 'authored' | 'srd51'; label: string; license: string | null; url: string | null };
  trashed: boolean;
  sourceHash?: string;
}
