import { createHash } from 'node:crypto';
import {
  encounterPlanFields,
  validateEncounterPlanInput,
  type EncounterItem,
  type EncounterPlan,
  type EncounterPlanCommand,
  type StoredEncounterPlan,
} from '../catalog/encounter-contracts';
import {
  creatureReference,
  resolveCreatureReference,
  resolveItemReference,
} from './catalog-references';
import { creatureInfo } from './creature-catalog';
import * as shape from './stored-shapes';
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export { creatureInfo, readCreature, searchCreatures } from './creature-catalog';
export function installEncounterSchema(db: any) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS encounter_plan(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,name TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT; CREATE TABLE IF NOT EXISTS encounter_plan_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;',
  );
}
export function readEncounterPlan(db: any, cam: string, id: string): EncounterPlan {
  const row = db.prepare('SELECT * FROM encounter_plan WHERE campaign_id=? AND id=?').get(cam, id);
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Encounter-Vorlage fehlt oder ist beschädigt.');
  const p = JSON.parse(row.payload);
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    Object.keys(p).some(
      (key) =>
        key === 'sourceReferences' ||
        key === 'resolvedItems' ||
        !Object.hasOwn(encounterPlanFields, key),
    ) ||
    typeof p.name !== 'string' ||
    typeof p.notes !== 'string' ||
    !Array.isArray(p.party) ||
    !Array.isArray(p.entries) ||
    !Array.isArray(p.sources) ||
    typeof p.catalogHash !== 'string'
  )
    throw new Error(
      'Encounter-Vorlage hat ein unbekanntes Format. Originaldaten bleiben erhalten.',
    );
  if (
    p.id !== row.id ||
    p.revision !== row.revision ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 1 ||
    p.name !== row.name
  )
    throw new Error('Encounter-Vorlage hat eine widersprüchliche Revision.');
  return resolveStoredPlan(db, p as StoredEncounterPlan);
}
export function readEncounterPlans(db: any, cam: string, search: string, limit?: number) {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100))
    throw new Error('Suchgrenze muss zwischen 1 und 100 liegen.');
  if (typeof search !== 'string' || search.length > 1000)
    throw new Error('Ungültige Vorlagensuche.');
  return db
    .prepare(
      'SELECT id,revision,name FROM encounter_plan WHERE campaign_id=? AND instr(lower(name),lower(?))>0 ORDER BY name,id LIMIT ?',
    )
    .all(cam, search, limit ?? -1);
}
export function saveEncounterPlan(
  db: any,
  command: EncounterPlanCommand,
  guard: () => void,
): EncounterPlan {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000)
        throw new Error('Änderungskennung fehlt.');
      const fp = hash(JSON.stringify({ ...command, token: undefined })),
        prior = db
          .prepare('SELECT * FROM encounter_plan_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== command.campaignId ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('Änderungskennung bereits anders verwendet.');
        return resolveStoredPlan(db, JSON.parse(prior.payload));
      }
      const input = command.plan;
      validateEncounterPlanInput(input);
      const old = db
        .prepare('SELECT revision FROM encounter_plan WHERE campaign_id=? AND id=?')
        .get(command.campaignId, input.id);
      if (
        command.expectedRevision === null
          ? !!old
          : !old || old.revision !== command.expectedRevision
      )
        throw new Error('Encounter-Vorlage wurde geändert. Entwurf bleibt offen.');
      if (old) {
        readEncounterPlan(db, command.campaignId, input.id);
        if (input.sourceReferences === undefined)
          throw new Error(
            'Gespeicherte Encounter-Vorlage benötigt ihre gebundenen Katalogreferenzen.',
          );
      }

      for (const e of input.entries)
        for (const id of e.worldActorIds ?? []) {
          const row = db
            .prepare(
              'SELECT a.payload,a.checksum,n.trashed FROM world_actor a JOIN world_note n ON n.campaign_id=a.campaign_id AND n.id=a.id WHERE a.campaign_id=? AND a.id=?',
            )
            .get(command.campaignId, id);
          if (
            !row ||
            hash(row.payload) !== row.checksum ||
            JSON.parse(row.payload).creatureId !== e.creatureId
          )
            throw new Error('Benannter NPC fehlt oder besitzt einen anderen Statblock.');
        }
      const references =
        input.sourceReferences?.filter((r) =>
          input.entries.some((e) => e.creatureId === r.entryId),
        ) ??
        [...new Set(input.entries.map((e) => e.creatureId))].map((id) =>
          creatureReference(id, input.catalogHash || undefined),
        );
      const sources = references.map(resolveCreatureReference),
        plan: EncounterPlan = {
          id: input.id,
          revision: (old?.revision ?? 0) + 1,
          name: input.name,
          notes: input.notes,
          party: input.party.map((p) => ({ ...p })),
          entries: input.entries.map((e) => ({ ...e })),
          sources,
          catalogHash: creatureInfo().hash,
          sourceReferences: references,
          ...(input.items
            ? {
                items: structuredClone(input.items),
                resolvedItems: resolvedEncounterItems(db, input.items),
              }
            : {}),
          ...(input.generationOrigin
            ? { generationOrigin: structuredClone(input.generationOrigin) }
            : {}),
        };
      validatePlanBindings(plan);
      const payload = JSON.stringify(storedEncounterPlan(plan));
      db.prepare(
        'INSERT INTO encounter_plan VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,name=excluded.name,payload=excluded.payload,checksum=excluded.checksum',
      ).run(command.campaignId, plan.id, plan.revision, plan.name, payload, hash(payload));
      db.prepare('INSERT INTO encounter_plan_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        command.campaignId,
        fp,
        payload,
        hash(payload),
      );
      return plan;
    })
    .immediate();
}

/** Only definitions are persisted in a reusable plan. Historical consumers freeze their own facts. */
export function storedEncounterPlan(plan: EncounterPlan): StoredEncounterPlan {
  const { sources: _display, resolvedItems: _items, sourceReferences, ...stored } = plan;
  if (!sourceReferences) throw new Error('Encounter-Vorlage benötigt gebundene Katalogquellen.');
  return { ...stored, sources: structuredClone(sourceReferences) };
}
function validatePlanBindings(plan: EncounterPlan) {
  const expected = new Set(plan.entries.map((e) => e.creatureId));
  const references = plan.sourceReferences ?? [];
  if (
    references.length !== expected.size ||
    new Set(references.map((r) => r.entryId)).size !== references.length ||
    references.some(
      (r) =>
        r.entryType !== 'creature' || !expected.has(r.entryId) || r.sourceHash !== plan.catalogHash,
    )
  )
    throw new Error('Encounter-Vorlage hat fehlende oder widersprüchliche Katalogreferenzen.');
}
function resolveStoredPlan(db: any, stored: StoredEncounterPlan): EncounterPlan {
  stored = shape.encounter_plan(stored);
  const plan = {
    ...stored,
    sourceReferences: stored.sources,
    sources: stored.sources.map(resolveCreatureReference),
    ...(stored.items ? { resolvedItems: resolvedEncounterItems(db, stored.items) } : {}),
  };
  validateEncounterPlanInput(plan);
  validatePlanBindings(plan);
  return plan;
}

function resolvedEncounterItems(db: any, items: EncounterItem[]) {
  return items.map((item) => {
    const definition = resolveItemReference(db, item.reference);
    return {
      id: definition.id,
      revision: definition.revision,
      name: definition.name,
      unitCopper: definition.unitCopper,
    };
  });
}
