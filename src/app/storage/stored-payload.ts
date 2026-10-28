import { createHash } from 'node:crypto';
import { checkedRow } from './sqlite-connection';

/** Check the original serialized bytes before parsing. Never changes the stored record. */
export function storedPayload(row: unknown): unknown {
  const checked = checkedRow(row, { payload: 'text', checksum: 'text' });
  if (createHash('sha256').update(checked.payload).digest('hex') !== checked.checksum)
    throw new Error(
      'Gespeicherter Inhalt fehlt oder ist beschädigt. Originaldaten bleiben erhalten.',
    );
  const value: unknown = JSON.parse(checked.payload);
  return value;
}
export function decodeStored<T>(row: unknown, decoder: (value: unknown) => T): T {
  return decoder(storedPayload(row));
}
