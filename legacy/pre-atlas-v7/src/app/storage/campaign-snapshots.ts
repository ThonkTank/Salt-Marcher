import { checkedRow, sqliteInteger } from './sqlite-connection';
import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync as closeSnapshot,
  closeSync,
  copyFileSync,
  fsyncSync,
  mkdtempSync,
  openSync as openSnapshot,
  openSync,
  readSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { ConflictChoice } from '../campaign/campaign-contracts';
import { canonicalJson } from '../campaign/generation/canonical-json';
import DATA_FORMAT from '../data-format.json';
import { type Campaign } from '../shared/contracts';
import { validateTransferSnapshot } from '../transfer/registry';
import {
  archiveSourceChoices,
  definitionConflicts,
  pruneCampaignSnapshot,
  publishSnapshot,
  remapSnapshot,
  sharedPlan,
  snapshotCounts,
  validateCampaignSnapshotSettings,
} from './campaign-data';
import { audioMediaFiles } from './music';
import { playerMediaFiles } from './player';
import { validateRoomGroups } from './room-groups';
import { validateDatabase } from './snapshot-validation';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
// Hash the source without retaining a second, potentially huge database in memory.
function snapshotDigest(filename: string) {
  const fd = openSnapshot(filename, 'r'),
    hash = createHash('sha256'),
    chunk = Buffer.allocUnsafe(65536);
  try {
    let n: number;
    while ((n = readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, n));
    return hash.digest('hex');
  } finally {
    closeSnapshot(fd);
  }
}

export async function writeCampaignSnapshot(
  db: any,
  id: string,
  fence: number,
  checkFence: () => void,
  filename: string,
) {
  const candidate = filename + '.snapshot-' + randomUUID();
  try {
    await db.backup(candidate);
    checkFence();
    const snapshotDb = new Database(candidate, { fileMustExist: true });
    let snapshot;
    try {
      snapshotDb.pragma('journal_mode=DELETE');
      pruneCampaignSnapshot(snapshotDb, id);
      validateDatabase(snapshotDb);
      validateTransferSnapshot(snapshotDb);
      const c = checkedRow(snapshotDb.prepare('SELECT id,name FROM campaign').get(), {
        id: 'text',
        name: 'text',
      });
      snapshot = {
        ...c,
        fence,
        schema: sqliteInteger(snapshotDb.pragma('user_version', { simple: true })),
        counts: snapshotCounts(snapshotDb),
        media: [...audioMediaFiles(snapshotDb), ...playerMediaFiles(snapshotDb, id)],
      };
    } finally {
      snapshotDb.close();
    }
    const fd = openSync(candidate, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    checkFence();
    renameSync(candidate, filename);
    const directory = openSync(dirname(filename), 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
    return snapshot;
  } finally {
    for (const suffix of ['', '-wal', '-shm']) rmSync(candidate + suffix, { force: true });
  }
}
function inspectCampaignDatabase(target: any, db: any) {
  const schema = db.pragma('user_version', { simple: true });
  if (schema !== DATA_FORMAT.schema)
    throw new Error(
      'Dieses Paket gehört zum alten Testformat oder benötigt eine neuere Appversion. Originaldatei bleibt erhalten.',
    );
  validateDatabase(db);
  validateRoomGroups(db);
  const rows = db.prepare('SELECT id,name FROM campaign').all();
  if (rows.length !== 1) throw new Error('Paket muss genau eine Kampagne enthalten.');
  const c: Pick<Campaign, 'id' | 'name'> = rows[0];
  validateCampaignSnapshotSettings(db, c.id);
  validateTransferSnapshot(db);
  return {
    ...c,
    schema,
    counts: snapshotCounts(db),
    media: [...audioMediaFiles(db), ...playerMediaFiles(db, rows[0].id)],
    conflicts: definitionConflicts(target, db),
  };
}
export function previewCampaignSnapshot(target: any, filename: string) {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    return inspectCampaignDatabase(target, db);
  } finally {
    db.close();
  }
}
export function readCampaignTransferOutcome(
  db: any,
  ticket: string,
  expected?: { name: string; choices: Record<string, ConflictChoice> },
): Campaign | null {
  if (typeof ticket !== 'string' || !ticket || ticket.length > 128)
    throw new Error('Übernahmekennung fehlt.');
  const receipt = db
    .prepare('SELECT subject_id,fingerprint FROM campaign_management_receipt WHERE command_id=?')
    .get(ticket);
  if (!receipt) return null;
  if (
    !receipt.fingerprint.startsWith('transfer:') ||
    (expected && receipt.fingerprint !== transferFingerprint(expected.name, expected.choices))
  )
    throw new Error('Verwaltungskennung anders verwendet.');
  return (
    db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(receipt.subject_id) ?? null
  );
}
function transferFingerprint(name: string, choices: Record<string, ConflictChoice>) {
  return 'transfer:' + hash(canonicalJson({ name, choices }));
}
export function acceptCampaignSnapshot(
  db: any,
  filename: string,
  name: string,
  choices: Record<string, ConflictChoice>,
  ticket?: string,
  expectedDigest?: string,
) {
  if (!name.trim() || name.length > 1000) throw new Error('Kampagnenname fehlt.');
  if (ticket !== undefined) {
    const confirmed = readCampaignTransferOutcome(db, ticket, { name, choices });
    if (confirmed) return confirmed;
  }
  // Remapping must never consume or mutate the reviewed input, even when publication fails.
  const staging = mkdtempSync(filename + '.accept-'),
    candidate = staging + '/campaign.sqlite';
  let source: any;
  try {
    copyFileSync(filename, candidate);
    source = new Database(candidate, { fileMustExist: true });
    const sha256 = snapshotDigest(candidate);
    if (expectedDigest !== undefined && sha256 !== expectedDigest)
      throw new Error('Geprüfte Paketdatenbank wurde verändert.');
    const c = inspectCampaignDatabase(db, source),
      original = Buffer.from(
        JSON.stringify({
          format: 'Campaign provenance',
          version: 1,
          campaignId: c.id,
          name: c.name,
          schema: c.schema,
          sha256,
        }),
      ),
      plan = sharedPlan(db, source, choices);
    archiveSourceChoices(source, plan);
    const remap = remapSnapshot(source, c.id, name, plan.mapping, plan.history);
    validateDatabase(source);
    return publishSnapshot(
      db,
      source,
      remap,
      plan,
      original,
      c.id,
      c.name,
      ticket === undefined
        ? undefined
        : { commandId: ticket, fingerprint: transferFingerprint(name, choices) },
    );
  } finally {
    try {
      source?.close();
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
