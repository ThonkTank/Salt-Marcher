import type { ItemInput } from '../catalog/item-input-contracts';
import type { ProgressGuard } from './reward-contracts';
export interface NarrativeState {
  noteId: string;
  revision: number;
  status: 'open' | 'closed';
  locationId?: string | null;
  contributors: string[];
  poolXp: number;
  items: ItemInput[];
  awardId: string | null;
}
export interface NarrativeAward {
  id: string;
  noteId: string;
  title: string;
  sceneId: string | null;
  poolXp: number;
  shareXp: number;
  recipientIds: string[];
  treasureId: string | null;
  outcome: string;
  recordedAt: string;
}
export interface NarrativeDraft {
  /** Absent on historical drafts; approval requires explicit review of that basis. */
  noteRevision?: number;
  noteId: string;
  writeId: string;
  revision: number;
  status: 'open' | 'closed';
  locationId: string | null;
  contributors: string[];
  poolXp: string;
  items: (Omit<ItemInput, 'quantity'> & { quantity: string })[];
}
export type NarrativeAction =
  | {
      kind: 'narrative-state';
      state: NarrativeState;
      expectedRevision: number;
      expectedNoteRevision: number;
      draftWriteId?: string;
    }
  | {
      kind: 'narrative-award';
      noteId: string;
      expectedRevision: number;
      expectedNoteRevision: number;
      sceneId: string | null;
      poolXp: number;
      noXp: boolean;
      recipients: ProgressGuard[];
      items: ItemInput[];
      outcome: string;
      finishDraftWriteId?: string;
      draftWriteId?: string;
    };
export interface NarrativeView {
  state: NarrativeState;
  award: NarrativeAward | null;
  noteRevision: number;
  draft: NarrativeDraft | null;
}
