import { createHash } from 'node:crypto';

const digest = (value: object) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Original property order and JSON encoding are part of the stored receipt contract. */
export const commandFingerprint = (command: object) => digest({ ...command, token: undefined });
/** Older room/preparation receipts included the activation token. Never rewrite them. */
export const matchesReceipt = (receipt: { fingerprint: string }, command: object) =>
  receipt.fingerprint === commandFingerprint(command) || receipt.fingerprint === digest(command);
