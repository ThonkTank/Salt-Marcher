import { checkedSessionRecapDraft, type SessionRecapDraft } from '../runtime/live-contracts';

export function readSessionRecapDraft(db: any, campaignId: string): SessionRecapDraft | null {
  const value = db
    .prepare('SELECT value FROM settings WHERE key=?')
    .get('session-recap:' + campaignId)?.value;
  if (value === undefined) return null;
  const draft = JSON.parse(value);
  checkedSessionRecapDraft(draft);
  return draft;
}
export function keepSessionRecapDraft(
  db: any,
  campaignId: string,
  draft: SessionRecapDraft,
  expected: SessionRecapDraft | null,
) {
  checkedSessionRecapDraft(draft);
  if (expected !== null) checkedSessionRecapDraft(expected);
  const current = readSessionRecapDraft(db, campaignId),
    same = (a: SessionRecapDraft | null, b: SessionRecapDraft | null) =>
      a === null ? b === null : !!b && a.summary === b.summary && a.handoff === b.handoff;
  if (same(current, draft)) return;
  if (!same(current, expected))
    throw new Error(
      'Rückblick wurde inzwischen an anderer Stelle geändert. Eigene Eingaben bleiben offen.',
    );
  write(db, campaignId, draft);
}
/** Called inside the ending transaction, before its durable receipt is written. */
export function consumeSessionRecapDraft(
  db: any,
  campaignId: string,
  submitted: SessionRecapDraft,
): SessionRecapDraft | null {
  const current = readSessionRecapDraft(db, campaignId);
  if (!current) return null;
  const remaining = {
    summary: current.summary === submitted.summary ? '' : current.summary,
    handoff: current.handoff === submitted.handoff ? '' : current.handoff,
  };
  if (remaining.summary !== current.summary || remaining.handoff !== current.handoff)
    write(db, campaignId, remaining);
  return remaining;
}
function write(db: any, campaignId: string, draft: SessionRecapDraft) {
  db.prepare(
    'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  ).run('session-recap:' + campaignId, JSON.stringify(draft));
}
