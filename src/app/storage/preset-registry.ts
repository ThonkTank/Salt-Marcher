import { createHash } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import { mutatePreset, readGeneratorRegistry } from './generation';
import type { PresetCommand, PresetReceipt } from '../campaign/generation-contracts';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
function context(db: any, id: string | null) {
  if (
    id !== null &&
    (typeof id !== 'string' ||
      !db
        .prepare('SELECT campaign_id FROM campaign_lifecycle WHERE campaign_id=? AND trashed=0')
        .get(id))
  )
    throw new Error('Kampagne nicht verfügbar. Wähle den Kontext erneut.');
}
export function readPresetRegistry(db: any, id: string | null) {
  context(db, id);
  return readGeneratorRegistry(db, id ?? '');
}
function checked(command: PresetCommand) {
  if (
    !command ||
    typeof command.commandId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(command.commandId) ||
    !command.action ||
    !['preset-save', 'preset-delete', 'preset-assign'].includes(command.action.kind) ||
    !Number.isSafeInteger(command.action.expectedRegistryRevision) ||
    command.action.expectedRegistryRevision < 0
  )
    throw new Error('Ungültiger Presetauftrag.');
  return hash(canonicalJson(command));
}
export function readPresetOutcome(db: any, command: PresetCommand): PresetReceipt | null {
  const fingerprint = checked(command),
    row = db
      .prepare('SELECT * FROM generator_registry_receipt WHERE command_id=?')
      .get(command.commandId);
  if (!row) return null;
  if (row.fingerprint !== fingerprint)
    throw new Error('Änderungskennung bereits anders verwendet.');
  if (hash(row.payload) !== row.checksum)
    throw new Error('Presetbeleg beschädigt. Originaldaten bleiben erhalten.');
  return JSON.parse(row.payload);
}
export function executePresetCommand(db: any, command: PresetCommand): PresetReceipt {
  return db
    .transaction(() => {
      const prior = readPresetOutcome(db, command);
      if (prior) return prior;
      context(db, command.campaignId);
      const a = command.action;
      const affectedCampaignIds =
        a.kind === 'preset-delete'
          ? db
              .prepare(
                'SELECT campaign_id FROM generator_assignment WHERE preset_id=? ORDER BY campaign_id',
              )
              .all(a.id)
              .map((r: any) => r.campaign_id)
          : [];
      mutatePreset(db, command.campaignId, a);
      const registry = readGeneratorRegistry(db, command.campaignId ?? ''),
        preset =
          a.kind === 'preset-save'
            ? registry.presets.find((p) => p.id === a.preset.id)!
            : a.kind === 'preset-assign'
              ? registry.presets.find((p) => p.id === registry.effectiveId)!
              : null;
      const receipt: PresetReceipt = {
          commandId: command.commandId,
          kind: a.kind,
          registry,
          preset,
          deletedId: a.kind === 'preset-delete' ? a.id : null,
          affectedCampaignIds,
          campaignId: command.campaignId,
        },
        payload = JSON.stringify(receipt);
      db.prepare('INSERT INTO generator_registry_receipt VALUES(?,?,?,?)').run(
        command.commandId,
        checked(command),
        payload,
        hash(payload),
      );
      db.exec(
        'DELETE FROM generator_registry_receipt WHERE rowid NOT IN (SELECT rowid FROM generator_registry_receipt ORDER BY rowid DESC LIMIT 512)',
      );
      return receipt;
    })
    .immediate();
}
