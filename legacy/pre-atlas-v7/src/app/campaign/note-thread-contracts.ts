import type { NoteSourceRecovery } from './note-source-recovery-contracts';
import type { Note } from './note-data';
import type { Result } from '../shared/contracts';
export interface NoteThreadEntry {
  id: string;
  title: string;
  kind: Note['kind'] | null;
  revision: number | null;
  labels: string[];
  status: 'open' | 'closed' | 'untracked' | 'unknown';
  unavailable: boolean;
  trashed?: boolean;
  preview: string;
  stamp: string;
  notice?: string;
}
export interface NoteThreadPage {
  root: Note;
  recoveries?: NoteSourceRecovery[];
  entries: NoteThreadEntry[];
  total: number;
  next: number | null;
}
export interface NoteThreadSelection {
  rootId: string;
  rootRevision: number;
  includeRoot: boolean;
  entries: { id: string; stamp: string }[];
}
export interface NoteThreadAPI {
  noteThread(
    token: string,
    id: string,
    offset: number,
    active: boolean,
    history?: boolean,
  ): Promise<Result<NoteThreadPage>>;
  checkNoteThread(token: string, selection: NoteThreadSelection): Promise<Result<void>>;
}
