import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  CreatureCatalog,
  SRD_5_1_ARTIFACT_SHA256,
  SRD_5_1_XP_CORRECTIONS,
  SRD_5_1_REACTION_SUPPLEMENT,
  SRD_5_1_NOTICE,
  type CreatureCatalogQuery,
} from '../../features/catalog/creature-catalog';
import {
  encounterPlanFields,
  validateEncounterPlanInput,
  type EncounterPlan,
  type EncounterPlanCommand,
} from '../encounter-contracts';
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const effectiveCatalogHash = hash(
  JSON.stringify({
    artifact: SRD_5_1_ARTIFACT_SHA256,
    xpCorrections: SRD_5_1_XP_CORRECTIONS,
    reactions: SRD_5_1_REACTION_SUPPLEMENT,
  }),
);
let catalog: CreatureCatalog | undefined;
function load() {
  if (!catalog) {
    const bytes = readFileSync(path.join(__dirname, 'catalog', 'srd-5.1.generated.json'));
    if (hash(bytes) !== SRD_5_1_ARTIFACT_SHA256)
      throw new Error('Monsterkatalog gehört nicht zum bestätigten Artefakt.');
    catalog = new CreatureCatalog(JSON.parse(bytes.toString('utf8')));
  }
  return catalog;
}
export function creatureInfo() {
  const c = load(),
    unique = (values: readonly string[]) => [...new Set(values)].filter(Boolean).sort();
  return {
    count: c.creatures.length,
    types: unique(c.creatures.map((c) => c.type)),
    subtypes: unique(c.creatures.map((c) => c.subtype)),
    sizes: unique(c.creatures.map((c) => c.size)),
    habitats: unique(c.creatures.flatMap((c) => c.biomes)),
    alignments: unique(c.creatures.map((c) => c.alignment)),
    notice: SRD_5_1_NOTICE,
    hash: effectiveCatalogHash,
  };
}
export function readCreature(id: string) {
  const c = load().detail(id);
  if (!c) throw new Error('Kreatur nicht gefunden.');
  return c;
}
export function searchCreatures(query: CreatureCatalogQuery) {
  const result = load().search(query);
  return {
    ...result,
    rows: result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      challengeRating: c.challengeRating,
      cr: c.cr,
      type: c.type,
      size: c.size,
      ac: c.ac,
      hp: c.hp,
      xp: c.xp,
      sourceLabel: c.sourceLabel,
    })),
  };
}
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
    Object.keys(p).some((key) => !Object.hasOwn(encounterPlanFields, key)) ||
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
  validateEncounterPlanInput(p);
  return p;
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
        return JSON.parse(prior.payload);
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
      if (old) readEncounterPlan(db, command.campaignId, input.id);

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
      const sources = [...new Set(input.entries.map((e) => e.creatureId))].map(readCreature),
        plan: EncounterPlan = {
          id: input.id,
          revision: (old?.revision ?? 0) + 1,
          name: input.name,
          notes: input.notes,
          party: input.party.map((p) => ({ ...p })),
          entries: input.entries.map((e) => ({ ...e })),
          sources,
          catalogHash: effectiveCatalogHash,
          ...(input.generationOrigin
            ? { generationOrigin: structuredClone(input.generationOrigin) }
            : {}),
        };
      const payload = JSON.stringify(plan);
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
