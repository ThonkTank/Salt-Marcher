import type { ItemInput } from './progression';
import type { Result } from './contracts';
export type FinishOwner = {
  kind: 'combat' | 'narrative';
  targetId: string;
  revision: number;
  // Historical narrative drafts can have an unknown note basis.
  noteRevision?: number;
};
export type RewardItemDraft = Omit<ItemInput, 'quantity'> & {
  quantity: string;
};
export interface FinishDraft extends FinishOwner {
  writeId: string;
  outcome: string;
  poolXp: string;
  loadXp: string;
  noXp: boolean;
  hasLoot: boolean;
  recipientIds: string[];
  items: RewardItemDraft[];
}
export interface FinishDraftAPI {
  finishDraft(token: string, owner: FinishOwner): Promise<Result<FinishDraft | null>>;
  keepFinishDraft(
    token: string,
    draft: FinishDraft,
    expected: string | null,
  ): Promise<Result<void>>;
  discardFinishDraft(token: string, owner: FinishOwner, writeId: string): Promise<Result<void>>;
}
