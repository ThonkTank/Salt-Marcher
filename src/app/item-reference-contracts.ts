import type { Result } from './contracts';
export interface ItemReferenceRecord {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  magic: boolean;
  attunement: string;
  cost?: { sourceText: string; copperPieces?: number | null };
  weight?: { sourceText: string };
  rarity?: { value?: string; sourceText?: string; choices?: { value: string; label: string }[] };
  properties: { name: string; description?: string }[];
  description: { text: string }[];
  armor?: Record<string, string>;
  damage?: Record<string, string>;
  speed?: { sourceText: string };
  carryingCapacity?: { sourceText: string };
  sourceHeader?: { text: string };
  source: { document: string; pdfUrl: string; pdfPages: number[]; occurrenceIds: string[] };
}
export interface ItemReferenceQuery {
  name: string;
  category: string;
  subcategory: string;
  rarity: string;
  magic: '' | 'yes' | 'no';
  attunement: string;
  minimumCopper: string;
  maximumCopper: string;
  sort: 'name' | 'category' | 'rarity' | 'cost';
  direction: 'asc' | 'desc';
  offset: number;
}
export interface ItemReferencePage {
  status: 'ready' | 'missing' | 'incompatible' | 'invalid';
  message: string;
  complete?: boolean;
  rows: ItemReferenceRecord[];
  total: number;
  offset: number;
  limit: number;
  categories: string[];
  subcategories: string[];
  rarities: string[];
  license: string;
}
export interface ItemReferenceAPI {
  itemReferenceCatalog(query: ItemReferenceQuery): Promise<Result<ItemReferencePage>>;
}
