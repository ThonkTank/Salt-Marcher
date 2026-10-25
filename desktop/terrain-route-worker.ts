import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { vegetationScene } from '../src/app/storage/vegetation';
const db = new Database(workerData.source.filename, { readonly: true, fileMustExist: true });
try {
  db.exec('BEGIN');
  const { campaignId } = workerData.source,
    revision = db
      .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
      .get(campaignId) as { revision: number };
  if (revision.revision !== workerData.revision)
    throw Error('Gelände inzwischen geändert. Vorschau erneut berechnen.');
  const scene = vegetationScene(db, campaignId, workerData.box, workerData.mpp, revision.revision, {
    draft: workerData.draft,
  });
  parentPort!.postMessage({ value: { ...scene, fence: workerData.source.fence } });
} catch (e) {
  parentPort!.postMessage({ error: (e as Error).message });
} finally {
  if (db.inTransaction) db.exec('ROLLBACK');
  db.close();
}
