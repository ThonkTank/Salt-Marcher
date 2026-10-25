import { validatePreparation, type Note } from './preparation-contracts';
import type { KeyRoomGuard } from './key-contracts';
import type { Result } from '../shared/contracts';
/** With reuseRevision, note identifies the existing target and gmNotes is only the new supplement. */
export interface KeyNoteCaptureCommand {
  commandId: string;
  campaignId: string;
  token: string;
  room: KeyRoomGuard;
  note: Note;
  reuseRevision?: number;
  allowSameTitle?: boolean;
}
export interface KeyNoteChoice {
  id: string;
  kind: Note['kind'];
  title: string;
  revision: number;
  preview: string;
}
export interface KeyNoteChoices {
  entries: KeyNoteChoice[];
  more: boolean;
  notice?: string;
}
export const normalizedNoteTitle = (title: string) => title.normalize('NFC').trim().toLowerCase();
export type KeyNoteCaptureStatus =
  | { outcome: 'applied'; noteId: string; targetChanged: boolean }
  | { outcome: 'not-applied' | 'conflict' };
export interface KeyNoteCaptureAPI {
  keyNoteChoices(token: string, query: string): Promise<Result<KeyNoteChoices>>;
  captureKeyNote(command: KeyNoteCaptureCommand): Promise<Result<{ noteId: string }>>;
  keyNoteCaptureStatus(
    command: KeyNoteCaptureCommand,
    token: string,
  ): Promise<Result<KeyNoteCaptureStatus>>;
}
export function validateKeyNoteCapture(c: KeyNoteCaptureCommand) {
  const id = (v: unknown) => typeof v === 'string' && !!v && v.length <= 1000;
  if (
    !c ||
    !id(c.commandId) ||
    !id(c.campaignId) ||
    !id(c.token) ||
    !c.room ||
    !id(c.room.id) ||
    !Number.isSafeInteger(c.room.expectedRevision) ||
    c.room.expectedRevision < 0 ||
    (c.room.keyRevision !== null &&
      (!Number.isSafeInteger(c.room.keyRevision) || c.room.keyRevision < 0))
  )
    throw new Error('Raumstand für die neue Notiz prüfen.');
  if (
    (c.reuseRevision !== undefined &&
      (!Number.isSafeInteger(c.reuseRevision) || c.reuseRevision < 1)) ||
    (c.allowSameTitle !== undefined && typeof c.allowSameTitle !== 'boolean')
  )
    throw new Error('Notizstand prüfen.');
  if (
    !c.note ||
    ![
      'note',
      'npc',
      'faction',
      'quest',
      'rumor',
      ...(c.reuseRevision !== undefined ? ['rule'] : []),
    ].includes(c.note.kind) ||
    c.note.revision !== 1 ||
    c.note.relations?.length !== 0 ||
    c.note.creatureId !== null ||
    (c.reuseRevision !== undefined && c.note.readAloud !== '')
  )
    throw new Error('Neue Notiz prüfen.');
  validatePreparation({ kind: 'note', expectedRevision: null, note: c.note });
}
