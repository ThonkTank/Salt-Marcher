import type { Result } from './contracts';
import type { ItemInput } from './progression';
export type TreasuryRow = Omit<ItemInput, 'quantity'> & {
  quantity: string;
  lotId?: string | null;
};
export interface TreasureOrigin {
  treasureId: string;
  itemId: string;
  combatId: string | null;
  sceneId: string | null;
  locationId: string | null;
  sourceNoteId?: string;
  awardId?: string;
}
export interface TreasuryDraft {
  writeId: string;
  treasureId: string;
  revision: number;
  title: string;
  locationId: string | null;
  reason: string;
  items: TreasuryRow[];
}
export type TreasureAnchor = { kind: 'unplaced' } | { kind: 'scene' | 'location'; id: string };
export interface TreasureQuery {
  search: string;
  anchor: 'all' | 'inbox' | 'scene' | 'location';
  anchorId?: string;
  remainingOnly?: boolean;
}
export type TreasuryAction =
  | {
      kind: 'treasure-anchor';
      treasureId: string;
      expectedRevision: number;
      anchor: TreasureAnchor;
      reason: string;
    }
  | { kind: 'treasure-create'; title: string; locationId: string | null }
  | {
      kind: 'treasure-edit';
      treasureId: string;
      expectedRevision: number;
      title: string;
      locationId: string | null;
      items: { lotId: string | null; item: ItemInput }[];
      reason: string;
      draftWriteId?: string;
    }
  | {
      kind: 'treasure-move';
      treasureId: string;
      expectedRevision: number;
      itemId: string;
      quantity: number;
      target:
        | { id: string; expectedRevision: number }
        | { title: string; locationId: string | null };
      reason: string;
    };
export interface TreasuryAPI {
  treasuryDraft(token: string, id: string): Promise<Result<TreasuryDraft | null>>;
  keepTreasuryDraft(
    token: string,
    draft: TreasuryDraft,
    expected: string | null,
  ): Promise<Result<void>>;
  discardTreasuryDraft(token: string, id: string, writeId: string): Promise<Result<void>>;
  treasureHistory(
    token: string,
    id: string,
    after: string | null,
  ): Promise<
    Result<{
      items: { id: string; kind: string; facts: Record<string, unknown> }[];
      next: string | null;
    }>
  >;
}
