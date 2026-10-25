import { createHash } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import type {
  CampaignCatalogCommand,
  CampaignCatalogReceipt,
} from '../campaign/campaign-contracts';
import { validateCampaignCatalogCommand } from '../campaign/campaign-catalog-command';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installCampaignCatalog(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS campaign_usage(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id),created_at TEXT,last_opened_at TEXT) STRICT;CREATE TABLE IF NOT EXISTS campaign_catalog_receipt(command_id TEXT PRIMARY KEY,subject_id TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`,
  );
}
export function catalogCommand(c: CampaignCatalogCommand) {
  validateCampaignCatalogCommand(c);
  return hash(canonicalJson(c));
}
export function catalogOutcome(db: any, c: CampaignCatalogCommand): CampaignCatalogReceipt | null {
  const fp = catalogCommand(c),
    row = db.prepare('SELECT * FROM campaign_catalog_receipt WHERE command_id=?').get(c.commandId);
  if (!row) return null;
  if (row.fingerprint !== fp) throw new Error('Kampagnenauftrag wurde bereits anders verwendet.');
  if (hash(row.payload) !== row.checksum) throw new Error('Kampagnenbeleg beschädigt.');
  return JSON.parse(row.payload);
}
export function catalogReceipt(db: any, c: CampaignCatalogCommand, r: CampaignCatalogReceipt) {
  const payload = JSON.stringify(r);
  db.prepare('INSERT INTO campaign_catalog_receipt VALUES(?,?,?,?,?)').run(
    c.commandId,
    r.campaignId,
    catalogCommand(c),
    payload,
    hash(payload),
  );
}
export function noteCampaignCreated(db: any, id: string) {
  db.prepare('INSERT INTO campaign_usage VALUES(?,?,NULL)').run(id, new Date().toISOString());
}
export function noteCampaignOpened(db: any, id: string) {
  db.prepare(
    'INSERT INTO campaign_usage VALUES(?,NULL,?) ON CONFLICT(campaign_id) DO UPDATE SET last_opened_at=excluded.last_opened_at',
  ).run(id, new Date().toISOString());
}
