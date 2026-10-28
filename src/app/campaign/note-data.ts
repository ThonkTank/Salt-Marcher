import { type WorldNoteV1 } from '../../features/world/world-notes';

export type Note = WorldNoteV1;

export interface NoteSearchPreview {
  owner: string;
  parts: { text: string; matched: boolean }[];
}

export interface NoteRow {
  note: Note;
  trashed: boolean;
  searchPreview?: NoteSearchPreview;
}
