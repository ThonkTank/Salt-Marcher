import { createHash } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import type {
  CampaignCatalogCommand,
  CampaignCatalogReceipt,
} from '../campaign/campaign-contracts';
import { validateCampaignCatalogCommand } from '../campaign/campaign-catalog-command';
import type { Campaign } from '../shared/contracts';
import { eraseCampaignRows, trashCampaign } from './campaign-data';
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

/** Apply the catalog mutation inside the caller's immediate transaction. */
export function applyCampaignCatalog(
  db: any,
  command: CampaignCatalogCommand,
  create: (name: string) => import('../shared/contracts').Campaign,
): CampaignCatalogReceipt {
  let campaign: Campaign;
  if (command.kind === 'create') campaign = create(command.name.trim());
  else {
    const row = db
      .prepare(
        'SELECT c.*,l.trashed,l.revision trashRevision FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=?',
      )
      .get(command.id);
    if (!row) throw new Error('Kampagne fehlt.');
    campaign = { id: row.id, name: row.name, revision: row.revision };
    if ((command.kind === 'open' && row.trashed) || (command.kind === 'rename' && row.trashed))
      throw new Error('Kampagne zuerst wiederherstellen.');
    if (command.kind === 'rename') {
      if (row.revision !== command.expectedRevision)
        throw new Error('Kampagnenname inzwischen geändert.');
      db.prepare('UPDATE campaign SET name=?,revision=revision+1 WHERE id=?').run(
        command.name.trim(),
        command.id,
      );
      campaign.name = command.name.trim();
    }
    if (command.kind === 'trash')
      trashCampaign(db, {
        commandId: command.commandId,
        id: command.id,
        expectedRevision: command.expectedRevision,
        trashed: command.trashed,
      });
    if (command.kind === 'erase')
      eraseCampaignRows(db, {
        commandId: command.commandId,
        id: command.id,
        expectedRevision: command.expectedRevision,
        confirmName: command.confirmName,
      });
  }
  if (command.kind === 'open' || command.kind === 'create') {
    noteCampaignOpened(db, campaign.id);
    db.prepare(
      "INSERT INTO settings VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(campaign.id);
  }
  if (command.kind === 'trash' && command.trashed)
    db.prepare("DELETE FROM settings WHERE key='active' AND value=?").run(campaign.id);
  const usage = db
    .prepare('SELECT created_at,last_opened_at FROM campaign_usage WHERE campaign_id=?')
    .get(campaign.id);
  const receipt: CampaignCatalogReceipt = {
    commandId: command.commandId,
    kind: command.kind,
    campaignId: campaign.id,
    name: command.kind === 'erase' ? '' : campaign.name,
    createdAt: usage?.created_at ?? null,
    lastOpenedAt: usage?.last_opened_at ?? null,
  };
  catalogReceipt(db, command, receipt);
  return receipt;
}
