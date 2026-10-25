import type { Result } from './contracts';
import type { WorldFamilyRelationKind } from '../features/world/world-notes';

export interface WorldRelationPairAction {
  kind: 'add' | 'remove';
  sourceId: string;
  targetId: string;
  sourceRevision: number;
  targetRevision: number;
  forwardLabel: string;
  reverseLabel: string;
  forwardFamilyKind?: WorldFamilyRelationKind;
  reverseFamilyKind?: WorldFamilyRelationKind;
}
export interface WorldRelationPairCommand {
  commandId: string;
  campaignId: string;
  token: string;
  draftWriteId?: string;
  action: WorldRelationPairAction;
}
export interface WorldRelationPairAck {
  sourceRevision: number;
  targetRevision: number;
}
export interface WorldRelationPairDraft {
  version: 1;
  writeId: string;
  command: WorldRelationPairCommand;
}
export interface WorldRelationPairHistoryView {
  cursor: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}
export interface WorldRelationPairHistoryCommand {
  commandId: string;
  campaignId: string;
  token: string;
  expectedCursor: number;
  direction: 'undo' | 'redo';
}
export interface WorldRelationPairAPI {
  executeWorldRelationPair(
    command: WorldRelationPairCommand,
  ): Promise<Result<WorldRelationPairAck>>;
  reconcileWorldRelationPair(
    command: WorldRelationPairCommand,
    token: string,
  ): Promise<Result<{ outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean }>>;
  worldRelationPairDraft(
    token: string,
    sourceId: string,
  ): Promise<Result<WorldRelationPairDraft | null>>;
  keepWorldRelationPairDraft(
    token: string,
    draft: WorldRelationPairDraft,
    expected: string | null,
  ): Promise<Result<void>>;
  discardWorldRelationPairDraft(
    token: string,
    sourceId: string,
    writeId: string,
  ): Promise<Result<void>>;
  worldRelationPairHistory(token: string): Promise<Result<WorldRelationPairHistoryView>>;
  executeWorldRelationPairHistory(
    command: WorldRelationPairHistoryCommand,
  ): Promise<Result<WorldRelationPairHistoryView>>;
  reconcileWorldRelationPairHistory(
    command: WorldRelationPairHistoryCommand,
    token: string,
  ): Promise<Result<{ outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean }>>;
}
