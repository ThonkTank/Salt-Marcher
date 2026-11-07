import type { Note } from './note-data';

export interface NoteSourceRecovery {
  id: string;
  sourceId: string;
  title: string;
  unavailable?: boolean;
  before: Note;
  after: Note;
}
