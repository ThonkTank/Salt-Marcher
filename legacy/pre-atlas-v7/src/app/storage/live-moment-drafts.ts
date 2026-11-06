import { createHash } from 'node:crypto';
import {
  checkedLiveMomentDraft,
  sameLiveMomentDraft,
  type LiveMomentDraft,
} from '../runtime/live-moment-drafts';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

export function readLiveMomentDraft(db: any, cam: string, sceneId: string): LiveMomentDraft | null {
  const row = db
    .prepare('SELECT payload,checksum FROM live_moment_draft WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  if (!row) return null;
  if (hash(row.payload) !== row.checksum)
    throw new Error('Gesicherter Momententwurf ist beschädigt.');
  return checkedLiveMomentDraft(JSON.parse(row.payload));
}
export function keepLiveMomentDraft(
  db: any,
  cam: string,
  sceneId: string,
  draft: LiveMomentDraft | null,
  expected: LiveMomentDraft | null,
) {
  if (draft) draft = checkedLiveMomentDraft(draft);
  if (expected) expected = checkedLiveMomentDraft(expected);
  const current = readLiveMomentDraft(db, cam, sceneId);
  if (sameLiveMomentDraft(current, draft)) return;
  if (!sameLiveMomentDraft(current, expected))
    throw new Error('Momententwurf wurde inzwischen geändert. Eigene Eingabe bleibt offen.');
  if (draft) {
    const payload = JSON.stringify(draft);
    db.prepare(
      'INSERT INTO live_moment_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
    ).run(cam, sceneId, payload, hash(payload));
  } else
    db.prepare('DELETE FROM live_moment_draft WHERE campaign_id=? AND scene_id=?').run(
      cam,
      sceneId,
    );
}
export function clearSubmittedMomentDraft(
  db: any,
  cam: string,
  sceneId: string,
  draft: LiveMomentDraft,
) {
  if (sameLiveMomentDraft(readLiveMomentDraft(db, cam, sceneId), draft))
    keepLiveMomentDraft(db, cam, sceneId, null, draft);
}
