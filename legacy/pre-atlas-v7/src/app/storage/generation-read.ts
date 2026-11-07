import { rawCreature, validatedQuery } from '../../features/catalog/creature-catalog';
import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { canonicalSourceSnapshot } from './world-sources';
import { createHash } from 'node:crypto';
import { checkedGeneratorConfig } from '../campaign/generation/config';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  assessEncounter,
  validateEncounterPlanInput,
  type EncounterPlan,
} from '../catalog/encounter-contracts';
import {
  exactWeight,
  integerWeights,
  generatorPresetFields,
  type GeneratorPreset,
  type GeneratorRegistry,
  type GenerationRun,
} from '../campaign/generation-contracts';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export const systemId = 'generator-system-v5';

export function checkedPresetValue(value: unknown): GeneratorPreset {
  const preset = shape.generator_preset(value);
  if (
    !preset ||
    typeof preset !== 'object' ||
    Array.isArray(preset) ||
    Object.keys(preset).some((key) => !Object.hasOwn(generatorPresetFields, key)) ||
    typeof preset.name !== 'string' ||
    !preset.name.trim() ||
    preset.name.length > 1000 ||
    typeof preset.system !== 'boolean' ||
    !Number.isSafeInteger(preset.revision) ||
    preset.revision < 1 ||
    !preset.id.trim()
  )
    throw new Error(
      'Preset besitzt ein unbekanntes Format oder eine widersprüchliche Identität. Originaldaten bleiben erhalten.',
    );
  const config = checkedGeneratorConfig(preset.config);
  if (preset.hash !== hash(canonicalJson(config)))
    throw new Error('Preset-Regelhash widerspricht seinem Inhalt. Originaldaten bleiben erhalten.');
  return preset;
}

export function decodePreset(value: unknown): GeneratorPreset {
  const row = checkedRow(value, { id: 'text', revision: 'integer', system: 'integer' }),
    p = decodeStored(value, checkedPresetValue);
  if (p.id !== row.id || p.revision !== row.revision || Number(p.system) !== row.system)
    throw new Error('Presetidentität oder Revision widersprüchlich.');
  return p;
}

export function readGeneratorRegistry(db: SqliteDatabase, cam: string): GeneratorRegistry {
  const presets = checkedQuery(db, 'SELECT * FROM generator_preset ORDER BY system DESC,id', {
      id: 'text',
      revision: 'integer',
      system: 'integer',
      payload: 'text',
      checksum: 'text',
    })
      .all()
      .map((r) => decodePreset(r)),
    assignedId =
      checkedQuery(db, 'SELECT preset_id FROM generator_assignment WHERE campaign_id=?', {
        preset_id: 'text',
      }).get(cam)?.preset_id ?? null;
  const revision = checkedQuery(db, 'SELECT revision FROM generator_meta WHERE id=1', {
    revision: 'integer',
  }).required().revision;
  if (revision < 0 || !presets.some((p) => p.id === (assignedId ?? systemId)))
    throw new Error('Generatorregisterstand widersprüchlich.');
  return { revision, presets, assignedId, effectiveId: assignedId ?? systemId };
}

/** Read frozen proposals without requiring their sources to still be current. */
export function generationRunRow(db: SqliteDatabase, value: unknown): GenerationRun {
  const row = checkedRow(value, { id: 'text', campaign_id: 'text' });
  const run = decodeStored(value, shape.generation_run),
    cam = row.campaign_id;
  const object = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  const unsigned = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const revision = (v: unknown) => typeof v === 'number' && unsigned(v) && v >= 1;
  const digest = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
  const fail = () => {
    throw new Error('Generierungsvorschau beschädigt. Originaldaten bleiben erhalten.');
  };
  if (
    !object(run) ||
    run.id !== row.id ||
    !id(run.id) ||
    run.revision !== 1 ||
    !id(run.seed) ||
    !object(run.request) ||
    run.seed !== run.request.seed ||
    !object(run.preset) ||
    !id(run.preset.id) ||
    typeof run.preset.name !== 'string' ||
    !revision(run.preset.revision) ||
    !digest(run.preset.hash) ||
    !unsigned(run.preset.mobThreshold) ||
    !digest(run.catalogHash) ||
    (run.sourceBasis !== undefined && run.sourceBasis !== null && !digest(run.sourceBasis))
  )
    fail();
  const r = run.request;
  validatedQuery(r.filters);
  if (
    (r.xpCeiling != null && !unsigned(r.xpCeiling)) ||
    (r.targetXp !== undefined && !unsigned(r.targetXp))
  )
    fail();
  for (const ids of [r.factionIds ?? []])
    if (ids.length > 1000 || ids.some((v) => !id(v)) || new Set(ids).size !== ids.length) fail();
  if (
    r.locationId != null &&
    (!id(r.locationId) ||
      !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, r.locationId))
  )
    fail();
  for (const id of r.factionIds ?? [])
    if (!db.prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?').get(cam, id)) fail();
  const fixed = run.fixedRoster;
  if (r.fillPlan !== undefined) {
    if (
      !object(r.fillPlan) ||
      !id(r.fillPlan.id) ||
      !revision(r.fillPlan.revision) ||
      !fixed ||
      fixed.id !== r.fillPlan.id ||
      fixed.revision !== r.fillPlan.revision
    )
      fail();
    validateEncounterPlanInput(fixed!);
  } else if (fixed !== undefined) fail();
  if (
    !unsigned(r.count) ||
    r.count < 1 ||
    r.count > 20 ||
    typeof r.title !== 'string' ||
    r.title.length > 1000 ||
    typeof r.habitat !== 'string' ||
    !['any', 'day', 'night'].includes(r.time) ||
    !Array.isArray(r.party) ||
    !r.party.length ||
    !Array.isArray(r.tableIds) ||
    r.tableIds.length > 1000 ||
    r.tableIds.some((v) => !id(v)) ||
    new Set(r.tableIds).size !== r.tableIds.length ||
    !object(r.filters) ||
    (r.npcOnly !== undefined && typeof r.npcOnly !== 'boolean') ||
    !Array.isArray(run.plans) ||
    run.plans.length !== r.count ||
    new Set(run.plans.map((p) => p?.id)).size !== run.plans.length ||
    !Array.isArray(run.warnings) ||
    run.warnings.some((s) => typeof s !== 'string') ||
    !Array.isArray(run.acceptedPlanIds) ||
    run.acceptedPlanIds.length > run.plans.length ||
    !Array.isArray(run.candidates) ||
    new Set(run.candidates.map((c) => c?.creatureId)).size !== run.candidates.length
  )
    fail();
  for (const refs of [run.tables, run.lootTables ?? []]) {
    if (
      !Array.isArray(refs) ||
      refs.length > 1000 ||
      new Set(refs.map((v) => v?.id)).size !== refs.length ||
      refs.some((v) => !object(v) || !id(v.id) || !revision(v.revision))
    )
      fail();
  }
  for (const c of run.candidates)
    if (!object(c) || !id(c.creatureId) || integerWeights([exactWeight(c.weight)])[0]! <= 0n)
      fail();
  const required = r.requiredNpcIds ?? [],
    excluded = r.excludedNpcIds ?? [],
    basis = run.npcBasis;
  for (const ids of [required, excluded])
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((v) => !id(v)) ||
      new Set(ids).size !== ids.length
    )
      fail();
  if (
    required.some((v) => excluded.includes(v)) ||
    (r.includeNpcs !== undefined && typeof r.includeNpcs !== 'boolean')
  )
    fail();
  const usesNpcs = r.npcOnly === true || r.includeNpcs === true || required.length > 0;
  if (usesNpcs ? !Array.isArray(basis) : basis !== undefined) fail();
  if (!run.candidates.length && !required.length && !fixed?.entries.length) fail();
  if (basis !== undefined) {
    if (new Set(basis.map((n) => n?.id)).size !== basis.length) fail();
    for (const n of basis) {
      if (
        !object(n) ||
        !id(n.id) ||
        typeof n.name !== 'string' ||
        n.name.length > 1000 ||
        !id(n.creatureId) ||
        !revision(n.noteRevision) ||
        !revision(n.recordRevision) ||
        !revision(n.actorRevision) ||
        (n.positionRevision !== null && !revision(n.positionRevision)) ||
        (n.locationId !== null && !id(n.locationId)) ||
        n.role !== 'hostile' ||
        !checkedQuery(db, 'SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, n.id)
      )
        fail();
    }
  }
  if (
    required.some((v) => !basis?.some((n) => n.id === v)) ||
    basis?.some((n) => excluded.includes(n.id))
  )
    fail();
  if (run.sourceSnapshot !== undefined) canonicalSourceSnapshot(run.sourceSnapshot);
  const party = (rows: EncounterPlan['party']) => rows.map(({ id, ...p }) => p);
  for (const p of run.plans) {
    if (
      !object(p) ||
      !id(p.id) ||
      p.revision !== 0 ||
      p.catalogHash !== run.catalogHash ||
      !Array.isArray(p.sources) ||
      new Set(p.sources.map((c) => c?.id)).size !== p.sources.length
    )
      fail();
    validateEncounterPlanInput(p);
    p.sources.forEach(rawCreature);
    if (canonicalJson(party(p.party)) !== canonicalJson(party(r.party))) fail();
    if (
      fixed &&
      (p.entries.length < fixed.entries.length ||
        fixed.entries.some((entry, i) => {
          const { id, ...original } = entry,
            { id: newId, ...copied } = p.entries[i]!;
          return canonicalJson(original) !== canonicalJson(copied);
        }))
    )
      fail();
    const opponents = p.entries.map((e, index) => {
      const source = p.sources.find((c) => c.id === e.creatureId);
      if (!source || !unsigned(source.xp)) fail();
      if (fixed && index < fixed.entries.length) {
        if (
          canonicalJson(source) !== canonicalJson(fixed.sources.find((c) => c.id === e.creatureId))
        )
          fail();
        return { xp: source!.xp, count: e.count };
      }
      const named = e.worldActorIds ?? [],
        anonymous = e.count - named.length;
      if (
        (r.npcOnly && anonymous) ||
        (!run.candidates.some((c) => c.creatureId === e.creatureId) &&
          (anonymous || named.some((actorId) => !required.includes(actorId))))
      )
        fail();
      if (named.length) {
        if (!basis || !e.actorNames) fail();
        for (const [i, actorId] of named.entries()) {
          const n = basis!.find((n) => n.id === actorId);
          if (
            !n ||
            n.creatureId !== e.creatureId ||
            n.name !== e.actorNames![i] ||
            (!r.npcOnly && !r.includeNpcs && !required.includes(actorId))
          )
            fail();
        }
      } else if (e.actorNames?.length) fail();
      return { xp: source!.xp, count: e.count };
    });
    if (required.some((v) => !p.entries.some((e) => e.worldActorIds?.includes(v)))) fail();
    if (canonicalJson(assessEncounter(p.party, opponents)) !== canonicalJson(p.assessment)) fail();
  }
  const accepted = new Map<number, string>();
  for (const a of checkedQuery(
    db,
    'SELECT proposal_index,plan_id FROM generation_acceptance WHERE campaign_id=? AND run_id=?',
    { proposal_index: 'integer', plan_id: 'text' },
  ).all(cam, run.id)) {
    if (
      !unsigned(a.proposal_index) ||
      !run.plans[a.proposal_index] ||
      !id(a.plan_id) ||
      !checkedQuery(db, 'SELECT 1 FROM encounter_plan WHERE campaign_id=? AND id=?', {
        '1': 'integer',
      }).get(cam, a.plan_id)
    )
      fail();
    accepted.set(a.proposal_index, a.plan_id);
  }
  for (const [index, value] of run.acceptedPlanIds.entries())
    if (value !== null && value !== undefined && value !== accepted.get(index)) fail();
  for (const [index, value] of accepted) run.acceptedPlanIds[index] = value;
  return run;
}

export function readGenerationRun(db: SqliteDatabase, cam: string, id: string): GenerationRun {
  return generationRunRow(
    db,
    checkedQuery(db, 'SELECT * FROM generation_run WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
  );
}

export function readGenerationRuns(db: SqliteDatabase, cam: string) {
  return checkedQuery(
    db,
    'SELECT * FROM generation_run WHERE campaign_id=? ORDER BY rowid DESC LIMIT 50',
    { campaign_id: 'text', id: 'text', payload: 'text', checksum: 'text' },
  )
    .all(cam)
    .map((r) => {
      const run = generationRunRow(db, r);
      return { id: run.id, seed: run.seed, title: run.request.title, count: run.plans.length };
    });
}
