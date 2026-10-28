export type ItemCategory = 'coins' | 'equipment' | 'trade-goods' | 'magic' | 'other';

export interface ItemInput {
  name: string;
  quantity: number;
  valueGold: string;
  category: ItemCategory;
  reference?: ItemReference;
}

export interface ItemReference {
  kind: 'authored';
  definitionId: string;
  revision: number;
  historicalDefinitionId?: string;
  catalogReference?: import('../catalog/catalog-reference-contracts').CatalogReference;
}
