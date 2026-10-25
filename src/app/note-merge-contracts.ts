import type { Note } from './preparation-contracts';

export interface NoteMergeChange {
  kind: 'note-merge';
  id: string;
  expectedRevision: number;
  targetId: string;
  expectedTargetRevision: number;
  basis: string;
  readAloud: string;
  gmNotes: string;
}
export interface NoteMergePreview {
  source: Note;
  target: Note;
  basis: string;
  uses: { kind: 'key' | 'visit' | 'note' | 'location'; id: string; title: string }[];
  blockers: string[];
}
export function checkedNoteMerge(change: NoteMergeChange): NoteMergeChange {
  if (
    !change ||
    change.kind !== 'note-merge' ||
    [change.id, change.targetId].some((id) => typeof id !== 'string' || !id || id.length > 1000) ||
    change.id === change.targetId ||
    [change.expectedRevision, change.expectedTargetRevision].some(
      (r) => !Number.isSafeInteger(r) || r < 1,
    ) ||
    typeof change.basis !== 'string' ||
    !/^[a-f0-9]{64}$/.test(change.basis) ||
    [change.readAloud, change.gmNotes].some((s) => typeof s !== 'string' || s.length > 2_000_000)
  )
    throw new Error('Zusammenführungsauftrag prüfen.');
  return change;
}
