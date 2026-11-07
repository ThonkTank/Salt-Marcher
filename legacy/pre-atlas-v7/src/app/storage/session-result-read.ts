import { rawCreature } from '../../features/catalog/creature-catalog';
import { checkedQuery } from './sqlite-connection';
import { sessionTargets } from '../campaign/generation/session-targets';
import { canonicalJson } from '../campaign/generation/canonical-json';
import { readItemDefinition } from './item-definitions';
import { checkedSessionLootGuidance } from './session-reward-validation';
import { assessEncounter, validateEncounterPlanInput } from '../catalog/encounter-contracts';
import { readGenerationRun } from './generation-read';
import { checkedItemInput } from './progression-records';
import type { SessionRun } from '../campaign/session-contracts';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { checkedRow, type SqliteDatabase } from './sqlite-connection';
export const object = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v);

export const identity = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;

export const unsigned = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function checkedSessionReward(
  reward: NonNullable<SessionRun['proposals'][number]['reward']>,
) {
  if (
    !object(reward) ||
    !unsigned(reward.poolXp) ||
    !Array.isArray(reward.items) ||
    reward.items.length > 100
  )
    throw new Error('Belohnung prüfen.');
  for (const item of reward.items) checkedItemInput(item);
  return reward;
}

export function sessionRunRow(db: SqliteDatabase, value: unknown): SessionRun {
  const row = checkedRow(value, { id: 'text', plan_id: 'text', campaign_id: 'text' });
  const run = decodeStored(value, shape.session_run),
    cam = row.campaign_id;
  if (
    !object(run) ||
    run.id !== row.id ||
    run.planId !== row.plan_id ||
    !identity(run.id) ||
    !identity(run.planId) ||
    !unsigned(run.profileRevision) ||
    run.profileRevision < 1 ||
    !identity(run.seed) ||
    ![run.dayBudget, run.budget, run.usedXp].every(unsigned) ||
    run.budget < 1 ||
    run.usedXp > run.budget ||
    !identity(run.generationRunId) ||
    !Array.isArray(run.proposals) ||
    run.proposals.length < 1 ||
    run.proposals.length > 20 ||
    new Set(run.proposals.map((p) => p?.id)).size !== run.proposals.length ||
    !Array.isArray(run.warnings) ||
    run.warnings.some((s) => typeof s !== 'string') ||
    (run.worldSourcesByLocation !== undefined && typeof run.worldSourcesByLocation !== 'boolean')
  )
    throw new Error('Spielabend-Vorschau hat ungültige Kennungen, Budgets oder Vorschläge.');
  if (
    !checkedQuery(db, 'SELECT 1 FROM plan WHERE campaign_id=? AND id=?', { '1': 'integer' }).get(
      cam,
      run.planId,
    ) ||
    run.profileRevision >
      (checkedQuery(db, 'SELECT revision FROM session_profile WHERE campaign_id=? AND plan_id=?', {
        revision: 'integer',
      }).get(cam, run.planId)?.revision ?? 0)
  )
    throw new Error('Vorschau gehört nicht zur Kampagne.');
  const sources = new Map<string, ReturnType<typeof readGenerationRun>>();
  const source = (id: string) => {
    if (!sources.has(id)) {
      const value = readGenerationRun(db, cam, id);
      if (value.id !== id || !Array.isArray(value.plans))
        throw new Error('Generierungsquelle beschädigt.');
      sources.set(id, value);
    }
    return sources.get(id)!;
  };
  source(run.generationRunId);
  for (const [index, p] of run.proposals.entries()) {
    if (
      !object(p) ||
      !identity(p.id) ||
      p.index !== index ||
      (p.revision !== undefined && (!unsigned(p.revision) || p.revision < 1)) ||
      typeof p.title !== 'string' ||
      !p.title.trim() ||
      [p.notes, p.readAloud].some((s) => typeof s !== 'string') ||
      (p.locationId !== null && !identity(p.locationId)) ||
      !Array.isArray(p.noteIds) ||
      p.noteIds.length > 1000 ||
      p.noteIds.some((id) => !identity(id)) ||
      new Set(p.noteIds).size !== p.noteIds.length ||
      (p.acceptedVisitId !== null && !identity(p.acceptedVisitId)) ||
      [p.rejected, p.needsEncounterRefresh, p.rewardEdited].some(
        (v) => v !== undefined && typeof v !== 'boolean',
      )
    )
      throw new Error('Szenenvorschlag beschädigt.');
    if (p.title.length > 1000 || [p.notes, p.readAloud].some((s) => s.length > 2000000))
      throw new Error(
        'Szenenvorschlag ist zu lang. Kürzeren Ortstitel oder weniger Welttexte pro Szene wählen.',
      );
    if (
      p.locationId &&
      !checkedQuery(db, 'SELECT 1 FROM location WHERE campaign_id=? AND id=?', {
        '1': 'integer',
      }).get(cam, p.locationId)
    )
      throw new Error('Vorschlagsort gehört nicht zur Kampagne.');
    for (const id of p.noteIds)
      if (
        !checkedQuery(db, 'SELECT 1 FROM world_note WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, id)
      )
        throw new Error('Vorschlagswissen gehört nicht zur Kampagne.');
    if (
      !object(p.encounter) ||
      !Array.isArray(p.encounter.sources) ||
      new Set(p.encounter.sources.map((c) => c?.id)).size !== p.encounter.sources.length
    )
      throw new Error('Vorgeschlagene Begegnung beschädigt.');
    validateEncounterPlanInput(p.encounter);
    p.encounter.sources.forEach(rawCreature);
    const opponents = p.encounter.entries.map((e) => {
      const c = p.encounter.sources.find((c) => c.id === e.creatureId);
      if (!c) throw new Error('Kreaturquelle des Vorschlags fehlt.');
      return { xp: c.xp, count: e.count };
    });
    if (
      canonicalJson(assessEncounter(p.encounter.party, opponents)) !==
      canonicalJson(p.encounter.assessment)
    )
      throw new Error('Begegnungsbudget widersprüchlich.');
    const origin = p.encounter.generationOrigin;
    if (origin && (!object(origin) || !identity(origin.runId) || !unsigned(origin.index)))
      throw new Error('Generierungsherkunft des Vorschlags beschädigt.');
    const original = source(origin?.runId ?? run.generationRunId).plans[origin?.index ?? index];
    if (!original || original.id !== p.encounter.id)
      throw new Error('Begegnung gehört zu einer anderen Generierung.');
    if (p.reward != null) {
      checkedSessionReward(p.reward);
      for (const item of p.reward.items)
        if (item.reference)
          readItemDefinition(db, item.reference.definitionId, item.reference.revision);
    }
    if (p.rewardOrigin) {
      const o = p.rewardOrigin;
      if (
        !object(o) ||
        !identity(o.tableId) ||
        !unsigned(o.revision) ||
        o.revision < 1 ||
        !identity(o.seed) ||
        !checkedQuery(db, 'SELECT 1 FROM loot_table WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, o.tableId)
      )
        throw new Error('Beutequelle des Vorschlags fehlt.');
    }
  }
  if (run.origin) {
    const o = run.origin;
    if (
      o.version !== 'session-origin-v1' ||
      !object(o.request) ||
      o.request.planId !== run.planId ||
      o.request.expectedProfileRevision !== run.profileRevision ||
      !Array.isArray(o.encounters) ||
      o.encounters.length !== run.proposals.length ||
      !Array.isArray(o.rewards) ||
      o.rewards.length !== run.proposals.length
    )
      throw new Error('Berechnungsherkunft der Vorschau beschädigt.');
    for (const list of [o.locations, o.notes])
      if (
        !Array.isArray(list) ||
        list.some((r) => !object(r) || !identity(r.id) || !unsigned(r.revision) || r.revision < 1)
      )
        throw new Error('Weltgrundlage der Vorschau beschädigt.');
    for (const ref of o.encounters) {
      const g = source(ref.runId);
      if (
        ref.seed !== g.seed ||
        ref.catalogHash !== g.catalogHash ||
        canonicalJson(ref.preset) !== canonicalJson(g.preset)
      )
        throw new Error('Katalog- oder Regelherkunft der Vorschau beschädigt.');
    }
    if (
      o.itemCatalog !== undefined &&
      (!Array.isArray(o.itemCatalog) ||
        o.itemCatalog.some(
          (r) => !identity(r.definitionId) || !unsigned(r.revision) || r.revision < 1,
        ))
    )
      throw new Error('Gegenstandskatalog der Berechnung beschädigt.');
    for (const reward of o.rewards)
      if (reward !== null) {
        checkedSessionReward(reward);
        for (const item of reward.items)
          if (item.reference)
            readItemDefinition(db, item.reference.definitionId, item.reference.revision);
      }
  }
  if (run.targets) {
    const t = run.targets,
      expected = sessionTargets(t.party, t.fraction, t.seed, t.requestedCount);
    if (
      canonicalJson(t) !== canonicalJson(expected) ||
      t.budget !== run.budget ||
      t.dayBudget !== run.dayBudget ||
      t.encounterTargets.length !== run.proposals.length
    )
      throw new Error('Gespeicherte Begegnungsziele widersprüchlich.');
  }
  if (run.proposals.reduce((n, p) => n + p.encounter.assessment.adjustedXp, 0) !== run.usedXp)
    throw new Error('Spielabendbudget widersprüchlich.');
  const accepted = new Map<number, string>();
  for (const a of checkedQuery(
    db,
    'SELECT * FROM session_proposal_acceptance WHERE campaign_id=? AND run_id=?',
    { campaign_id: 'text', run_id: 'text', proposal_index: 'integer', visit_id: 'text' },
  ).all(cam, run.id)) {
    if (!unsigned(a.proposal_index) || !run.proposals[a.proposal_index] || !identity(a.visit_id))
      throw new Error('Vorschlagsübernahme beschädigt.');
    accepted.set(a.proposal_index, a.visit_id);
  }
  for (const p of run.proposals) {
    if (p.acceptedVisitId !== null && p.acceptedVisitId !== accepted.get(p.index))
      throw new Error('Vorschlagsübernahme widersprüchlich.');
    p.acceptedVisitId = accepted.get(p.index) ?? null;
  }
  if (run.lootGuidance !== undefined) {
    const g = checkedSessionLootGuidance(run.lootGuidance, run.proposals.length);
    for (const item of g.magic?.pool ?? [])
      readItemDefinition(db, item.definitionId, item.revision);
    for (const c of g.characters)
      if (
        !checkedQuery(db, 'SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?', {
          '1': 'integer',
        }).get(cam, c.characterId)
      )
        throw new Error('Figur des Beuteausgleichs gehört nicht zur Kampagne.');
  }

  return run;
}

export function readSessionRun(db: SqliteDatabase, cam: string, id: string): SessionRun {
  return sessionRunRow(
    db,
    checkedQuery(db, 'SELECT * FROM session_run WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      plan_id: 'text',
      id: 'text',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
  );
}

export function readSessionRuns(db: SqliteDatabase, cam: string, planId: string) {
  return checkedQuery(
    db,
    'SELECT * FROM session_run WHERE campaign_id=? AND plan_id=? ORDER BY rowid DESC LIMIT 50',
    { campaign_id: 'text', plan_id: 'text', id: 'text', payload: 'text', checksum: 'text' },
  )
    .all(cam, planId)
    .map((row) => {
      const r = sessionRunRow(db, row);
      return { id: r.id, seed: r.seed, count: r.proposals.length };
    });
}

export function validateSessionRuns(db: SqliteDatabase) {
  for (const name of ['session_run', 'session_proposal_acceptance'])
    if (
      !checkedQuery(db, "SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?", {
        '1': 'integer',
      }).get(name)
    )
      throw new Error('Spielabend-Vorschauspeicher fehlt.');
  for (const row of checkedQuery(db, 'SELECT * FROM session_run', {
    campaign_id: 'text',
    plan_id: 'text',
    id: 'text',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    sessionRunRow(db, row);
}
