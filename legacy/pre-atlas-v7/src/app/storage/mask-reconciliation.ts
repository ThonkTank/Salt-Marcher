import { createHash } from 'node:crypto';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export type MaskOwnerKind = 'combat' | 'chase';
export interface MaskReconciliationReceipt {
  version: 1;
  commandId: string;
  campaignId: string;
  ownerKind: MaskOwnerKind;
  ownerId: string;
  sceneId: string;
  beforeRevision: number;
  afterRevision: number;
  removedCharacterIds: string[];
  retired?: boolean;
}

export function installMaskReconciliationSchema(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS mask_reconciliation_receipt(command_id TEXT NOT NULL REFERENCES receipt(command_id) DEFERRABLE INITIALLY DEFERRED,campaign_id TEXT NOT NULL REFERENCES campaign(id),owner_kind TEXT NOT NULL CHECK(owner_kind IN('combat','chase')),owner_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(command_id,owner_kind,owner_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;`,
  );
}

function checked(value: any): MaskReconciliationReceipt {
  const ids = [value?.commandId, value?.campaignId, value?.ownerId, value?.sceneId];
  if (
    !value ||
    value.version !== 1 ||
    ids.some((id) => typeof id !== 'string' || !id || id.length > 1000) ||
    !['combat', 'chase'].includes(value.ownerKind)
  )
    throw new Error('Maskenabgleichbeleg ist ungültig.');
  if (
    !Number.isSafeInteger(value.beforeRevision) ||
    value.beforeRevision < 1 ||
    value.afterRevision !== value.beforeRevision + 1 ||
    !Array.isArray(value.removedCharacterIds) ||
    value.removedCharacterIds.length > 10000 ||
    value.removedCharacterIds.some(
      (id: unknown) => typeof id !== 'string' || !id || id.length > 1000,
    ) ||
    new Set(value.removedCharacterIds).size !== value.removedCharacterIds.length ||
    (value.retired !== undefined && typeof value.retired !== 'boolean') ||
    (!value.removedCharacterIds.length && !value.retired)
  )
    throw new Error('Maskenabgleichbeleg ist ungültig.');
  return value;
}
function decoded(row: any) {
  if (!row || typeof row.payload !== 'string' || hash(row.payload) !== row.checksum)
    throw new Error('Maskenabgleichbeleg ist beschädigt.');
  return checked(JSON.parse(row.payload));
}

export function recordMaskReconciliation(db: any, value: MaskReconciliationReceipt) {
  const receipt = checked(value),
    payload = JSON.stringify(receipt);
  db.prepare('INSERT INTO mask_reconciliation_receipt VALUES(?,?,?,?,?,?,?)').run(
    receipt.commandId,
    receipt.campaignId,
    receipt.ownerKind,
    receipt.ownerId,
    receipt.sceneId,
    payload,
    hash(payload),
  );
}

export function validateMaskReconciliations(db: any) {
  if (
    !db
      .prepare(
        "SELECT 1 FROM sqlite_schema WHERE type='table' AND name='mask_reconciliation_receipt'",
      )
      .get()
  )
    return;
  for (const row of db.prepare('SELECT * FROM mask_reconciliation_receipt').iterate()) {
    const receipt = decoded(row);
    if (
      receipt.commandId !== row.command_id ||
      receipt.campaignId !== row.campaign_id ||
      receipt.ownerKind !== row.owner_kind ||
      receipt.ownerId !== row.owner_id ||
      receipt.sceneId !== row.scene_id
    )
      throw new Error('Maskenabgleichbeleg ist falsch zugeordnet.');
    const command = db
      .prepare('SELECT campaign_id FROM receipt WHERE command_id=?')
      .get(receipt.commandId);
    if (!command || command.campaign_id !== receipt.campaignId)
      throw new Error('Maskenabgleichbeleg besitzt kein passendes Partyreceipt.');
    const owner = db
      .prepare(`SELECT scene_id,revision FROM ${receipt.ownerKind} WHERE campaign_id=? AND id=?`)
      .get(receipt.campaignId, receipt.ownerId);
    if (!owner || owner.scene_id !== receipt.sceneId || owner.revision < receipt.afterRevision)
      throw new Error('Maskenabgleichbeleg besitzt keinen passenden Maskenstand.');
  }
}
