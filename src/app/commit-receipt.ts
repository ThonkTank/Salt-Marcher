export type CommitFamily = 'progress' | 'items' | 'combat' | 'chase' | 'session';
export interface CommitCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action: unknown;
}
export interface CommitReference {
  family: CommitFamily;
  commandId: string;
  campaignId: string;
  fingerprint: string;
}
export type CommitOutcome<T = unknown> =
  | { outcome: 'pending' | 'not-applied' }
  | { outcome: 'applied'; value: T };
export function commitFingerprintInput(family: CommitFamily, command: CommitCommand): string {
  return JSON.stringify(
    family === 'items'
      ? { campaignId: command.campaignId, action: command.action }
      : { ...command, token: undefined },
  );
}
export function checkedCommitReference(ref: CommitReference): void {
  if (
    !ref ||
    !['progress', 'items', 'combat', 'chase', 'session'].includes(ref.family) ||
    typeof ref.commandId !== 'string' ||
    !ref.commandId ||
    ref.commandId.length > 1000 ||
    typeof ref.campaignId !== 'string' ||
    !ref.campaignId ||
    !/^[a-f0-9]{64}$/.test(ref.fingerprint)
  )
    throw new Error('Ungültiger Buchungsbeleg.');
}
