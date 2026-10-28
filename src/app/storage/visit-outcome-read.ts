import { createHash } from 'node:crypto';
import type { VisitOutcome } from '../runtime/visit-outcome-contracts';
export function readVisitOutcome(db: any, cam: string, adoptionId: string): VisitOutcome | null {
  const row = db
    .prepare(
      "SELECT payload,checksum FROM world_history WHERE campaign_id=? AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.kind') END='visit-outcome' AND CASE WHEN json_valid(payload) THEN json_extract(payload,'$.facts.adoptionId') END=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(cam, adoptionId);
  if (!row) return null;
  if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Besuchsergebnis ist beschädigt.');
  const p = JSON.parse(row.payload);
  if (
    !['open', 'completed', 'skipped'].includes(p.facts.status) ||
    typeof p.facts.outcome !== 'string' ||
    typeof p.recordedAt !== 'string'
  )
    throw new Error('Besuchsergebnis ist ungültig.');
  return { status: p.facts.status, text: p.facts.outcome, recordedAt: p.recordedAt };
}
