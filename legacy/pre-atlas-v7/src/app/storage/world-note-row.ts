import { checkedRow } from './sqlite-connection';
import { createHash } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';

/** Validate the original row before callers decide whether trash is eligible. */
export function checkedWorldNoteRow(
  value: unknown,
  checksumError = 'Notizprüfung fehlgeschlagen.',
) {
  const row = checkedRow(value, {
    id: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  });
  if (!row || createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error(checksumError);
  const note = worldNoteDocument(JSON.parse(row.payload));
  if (note.deleted || note.id !== row.id || note.revision !== row.revision)
    throw new Error('Notizzuordnung widersprüchlich.');
  return note;
}
