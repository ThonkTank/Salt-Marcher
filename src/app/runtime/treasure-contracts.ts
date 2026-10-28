import type { TreasureOrigin } from './treasure-origin-contracts';

import type { ItemDefinition } from '../catalog/item-definition-contracts';
import type { ItemCategory } from '../catalog/item-input-contracts';
import type { ItemReference } from '../catalog/item-input-contracts';

export interface TreasureItem {
  id: string;
  reference: ItemReference;
  name: string;
  category: ItemCategory;
  quantity: number;
  allocated: number;
  unitCopper: string | null;
  currentDefinition?: ItemDefinition;
  origin?: TreasureOrigin;
}

export interface Treasure {
  id: string;
  revision: number;
  title: string;
  sceneId: string | null;
  locationId: string | null;
  combatId: string | null;
  sourceNoteId?: string;
  awardId?: string;
  items: TreasureItem[];
}

export interface LedgerItem {
  id: string;
  characterId: string;
  revision: number;
  reference: ItemReference;
  name: string;
  category: ItemCategory;
  quantity: number;
  unitCopper: string | null;
  origin: 'award' | 'purchase' | 'manual' | 'transfer';
  status: 'received' | 'sold' | 'given';
  actualSaleCopper: string | null;
  counterparty: string;
  treasureId: string | null;
  combatId: string | null;
  sceneId: string | null;
  locationId: string | null;
  instantMs: string | null;
  recordedAt: string;
  parentId: string | null;
  sourceTreasureId?: string;
  sourceTreasureItemId?: string;
  rewardCreditId?: string;
  creditedCopper?: string | null;
  recipientCharacterId?: string;
  sourceCharacterId?: string;
  sourceNoteId?: string;
  awardId?: string;
  provenance?: string;
  mergeTargetId?: string;
  counterpartyLink?: { kind: 'shop' | 'npc' | 'location' | 'faction'; id: string };
  paidCopper?: string;
  instanceId?: string | null;
  counterpartyReference?: { shopId: string; owner: { kind: 'npc' | 'location'; id: string } };
  currentName?: string;
  currentUnitCopper?: string | null;
  /** Current source title for navigation; never part of the stored grant. */
  sourceTitle?: string;
}
