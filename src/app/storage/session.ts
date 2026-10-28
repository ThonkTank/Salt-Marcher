import { checkedQuery, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import {
  checkedVisitDetail,
  checkedSessionReceipt,
  checkedSessionProfileValue,
} from './session-read';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { checkVisitPlanning } from '../runtime/session-day';
import { checkNoteThread } from './note-thread';
import { sessionTargets } from '../campaign/generation/session-targets';
import { requiredGenerationNpcs } from './generation-npcs';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  applyLootGuidance,
  fitSessionReward,
  assertSessionRewardBasisCurrent,
} from './session-rewards';
import { copySessionVisits } from './session-copy';
import { replaceSessionPlan } from './plan-replacement';
import { placeNpcGroup } from './npc-world';
import { randomUUID } from 'node:crypto';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { worldNoteDocument } from '../../features/world/world-notes';
import { assessEncounter } from '../catalog/encounter-contracts';
import { exactWeight } from '../campaign/generation-contracts';
import { generateEncounters, assertGenerationSourcesCurrent, previewLoot } from './generation';
import { readGenerationRun, readGeneratorRegistry } from './generation-read';
import { readEncounterPlan } from './encounters';
import { makeTreasure, awardXpPool, validateItemInput } from './progression-records';
import type {
  SessionProfile,
  PreparedGroup,
  SessionView,
  SessionCommand,
  SessionGenerationRequest,
  SessionRun,
  PlanPublisher,
} from '../campaign/session-contracts';
import {
  json,
  hash,
  detail,
  readPlan,
  readPreparedGroup,
  profile,
  readSession,
} from './session-read';
import { saveDetail, newGroup, materialize, saveGroup } from './preparation-write';
import { readSessionRun, sessionRunRow, checkedSessionReward } from './session-result-read';
export { readSessionRun, readSessionRuns, validateSessionRuns } from './session-result-read';
export {
  saveDetail,
  writeWorldActorHealth,
  saveGroup,
  newGroup,
  materialize,
  captureVisitDetails,
  writeSceneReadAloud,
} from './preparation-write';

export {
  readPlan,
  readWorldActor,
  readPreparedGroup,
  readSession,
  sceneReadAloud,
  scenePreparedGroupIds,
  scenePreparation,
} from './session-read';

export { checkedPreparedGroupRow } from './prepared-group';

export function installSessionSchema(db: SqliteDatabase) {
  db.exec(`CREATE TABLE IF NOT EXISTS session_profile(campaign_id TEXT NOT NULL,plan_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,plan_id),FOREIGN KEY(campaign_id,plan_id) REFERENCES plan(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS session_visit(campaign_id TEXT NOT NULL,plan_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,plan_id) REFERENCES plan(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS prepared_group(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,draft_plan_id TEXT,draft_visit_id TEXT,location_id TEXT,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS prepared_group_origin(campaign_id TEXT NOT NULL,source_group_id TEXT NOT NULL,world_group_id TEXT NOT NULL,PRIMARY KEY(campaign_id,source_group_id),FOREIGN KEY(campaign_id,world_group_id) REFERENCES prepared_group(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS world_actor(campaign_id TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES world_note(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS live_scene_extra(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS scene_opponent_group(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,group_id TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id,group_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id),FOREIGN KEY(campaign_id,group_id) REFERENCES prepared_group(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS scene_prepared_group(campaign_id TEXT NOT NULL,adoption_id TEXT NOT NULL,group_id TEXT NOT NULL,PRIMARY KEY(campaign_id,adoption_id,group_id),FOREIGN KEY(campaign_id,adoption_id) REFERENCES scene_adoption(campaign_id,id),FOREIGN KEY(campaign_id,group_id) REFERENCES prepared_group(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS session_run(campaign_id TEXT NOT NULL,plan_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,plan_id) REFERENCES plan(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS session_proposal_acceptance(campaign_id TEXT NOT NULL,run_id TEXT NOT NULL,proposal_index INTEGER NOT NULL,visit_id TEXT NOT NULL,PRIMARY KEY(campaign_id,run_id,proposal_index),FOREIGN KEY(campaign_id,run_id) REFERENCES session_run(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS session_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
}

function availableLocation(db: SqliteDatabase, cam: string, id: string, revision?: number) {
  const row = checkedQuery(db, 'SELECT * FROM location WHERE campaign_id=? AND id=?', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    trashed: 'integer',
    payload: 'text',
    checksum: 'text',
  }).get(cam, id);
  if (!row || row.trashed || (revision !== undefined && revision !== row.revision))
    throw new Error('Ort geändert oder nicht verfügbar.');
  return checkedLocationDocument(decodeStored(row, shape.location));
}

function note(db: SqliteDatabase, cam: string, id: string) {
  const row = checkedQuery(db, 'SELECT * FROM world_note WHERE campaign_id=? AND id=?', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    trashed: 'integer',
    payload: 'text',
    checksum: 'text',
  }).get(cam, id);
  if (!row || row.trashed) throw new Error('Gebundener Weltinhalt nicht verfügbar.');
  return worldNoteDocument(decodeStored(row, shape.world_note));
}

function releaseVisitGroups(
  db: SqliteDatabase,
  cam: string,
  planId: string,
  visitId: string,
  groupId: string | null = null,
) {
  const rows = checkedQuery(
    db,
    'SELECT id FROM prepared_group WHERE campaign_id=? AND draft_plan_id=? AND draft_visit_id=? AND location_id IS NULL AND (? IS NULL OR id=?)',
    { id: 'text' },
  ).all(cam, planId, visitId, groupId, groupId);
  for (const { id } of rows) {
    // Saved, unfinished input belongs to its author, even after removing its visit.
    if (
      checkedQuery(db, 'SELECT 1 FROM group_draft WHERE campaign_id=? AND group_id=?', {
        '1': 'integer',
      }).get(cam, id)
    )
      db.prepare(
        'UPDATE prepared_group SET draft_plan_id=NULL,draft_visit_id=NULL WHERE campaign_id=? AND id=?',
      ).run(cam, id);
    else db.prepare('DELETE FROM prepared_group WHERE campaign_id=? AND id=?').run(cam, id);
  }
}

export function cleanSessionVisits(
  db: SqliteDatabase,
  cam: string,
  planId: string,
  visitIds: readonly string[],
) {
  const positions = new Map(visitIds.map((id, index) => [id, index]));
  for (const row of checkedQuery(
    db,
    'SELECT * FROM session_visit WHERE campaign_id=? AND plan_id=?',
    {
      campaign_id: 'text',
      plan_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    },
  ).all(cam, planId)) {
    if (!positions.has(row.id)) {
      releaseVisitGroups(db, cam, planId, row.id);
      db.prepare('DELETE FROM session_visit WHERE campaign_id=? AND id=?').run(cam, row.id);
    } else {
      const d = checkedVisitDetail(db, cam, row);
      checkVisitPlanning(d);
      if (d.restAfter && d.restAfter.beforeVisitId !== visitIds[positions.get(row.id)! + 1]) {
        delete d.restAfter;
        saveDetail(db, cam, planId, d);
      }
    }
  }
}

// Call inside the generation transaction: only publish a run its reader accepts.
function saveSessionRun(db: SqliteDatabase, cam: string, run: SessionRun): SessionRun {
  const payload = json(run);
  db.prepare('INSERT INTO session_run VALUES(?,?,?,?,?)').run(
    cam,
    run.planId,
    run.id,
    payload,
    hash(payload),
  );
  for (const p of run.proposals)
    if (p.acceptedVisitId)
      db.prepare('INSERT INTO session_proposal_acceptance VALUES(?,?,?,?)').run(
        cam,
        run.id,
        p.index,
        p.acceptedVisitId,
      );
  return readSessionRun(db, cam, run.id);
}

// Normalize omitted defaults; preserve ordered bindings to scenes.
function normalizedSessionRequest(request: SessionGenerationRequest): SessionGenerationRequest {
  const r = structuredClone(request);
  // Table selection is a set; visit/note and required-NPC order still controls scene bindings.
  // Sort copies on both sides so historical origins remain reusable without rewriting them.
  r.encounter.tableIds.sort();
  r.count ??= null;
  r.compensateLoot = r.compensateLoot === true;
  r.compensateMagic = r.compensateMagic === true;
  r.worldSourcesByLocation = r.worldSourcesByLocation === true;
  r.encounter.npcOnly = r.encounter.npcOnly === true;
  r.encounter.includeNpcs = r.encounter.includeNpcs === true;
  for (const key of ['factionIds', 'requiredNpcIds', 'excludedNpcIds'] as const)
    r.encounter[key] ??= [];
  if (r.encounter.filters.text === '') {
    const { text, ...filters } = r.encounter.filters;
    r.encounter.filters = filters;
  }
  r.magicPool?.sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  return r;
}

function sessionWorldBasis(db: SqliteDatabase, cam: string, request: SessionGenerationRequest) {
  const revisions = (table: string, ids: string[]) =>
    ids
      .map((id) => ({
        id,
        revision:
          checkedQuery(db, `SELECT revision FROM ${table} WHERE campaign_id=? AND id=?`, {
            revision: 'integer',
          }).get(cam, id)?.revision ?? -1,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  return {
    locations: revisions('location', request.locationIds),
    notes: revisions('world_note', [
      ...new Set([...request.noteIds, ...(request.encounter.factionIds ?? [])]),
    ]),
  };
}

function sessionMagicCatalog(db: SqliteDatabase, request: SessionGenerationRequest) {
  if (!request.compensateMagic || request.magicPool !== undefined) return undefined;
  const refs = new Map<string, number>();
  for (const row of checkedQuery(
    db,
    "SELECT id,revision FROM authored_item WHERE category='magic'",
    { id: 'text', revision: 'integer' },
  ).iterate())
    refs.set(row.id, row.revision);
  for (const row of checkedQuery(
    db,
    "SELECT id,revision FROM item_definition WHERE json_extract(payload,'$.magic')=1 AND json_extract(payload,'$.trashed')=0",
    { id: 'text', revision: 'integer' },
  ).iterate())
    refs.set(row.id, row.revision);
  return [...refs]
    .map(([definitionId, revision]) => ({ definitionId, revision }))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId));
}

function reusableSession(
  db: SqliteDatabase,
  cam: string,
  p: SessionProfile,
  request: SessionGenerationRequest,
): SessionRun | null {
  const basis = sessionWorldBasis(db, cam, request),
    itemCatalog = sessionMagicCatalog(db, request),
    normalized = canonicalJson(normalizedSessionRequest(request));
  // Inspect only this plan/profile. Old runs without a semantic origin remain readable.
  for (const row of checkedQuery(
    db,
    "SELECT * FROM session_run WHERE campaign_id=? AND plan_id=? AND json_extract(payload,'$.profileRevision')=? AND json_extract(payload,'$.origin.version')='session-origin-v1' ORDER BY rowid DESC",
    { campaign_id: 'text', plan_id: 'text', id: 'text', payload: 'text', checksum: 'text' },
  ).iterate(cam, p.planId, p.revision)) {
    const saved = sessionRunRow(db, row),
      origin = saved.origin!;
    const ordered = (refs: { id: string; revision: number }[]) =>
      refs.slice().sort((a, b) => a.id.localeCompare(b.id));
    if (
      canonicalJson(normalizedSessionRequest(origin.request)) !== normalized ||
      canonicalJson(ordered(origin.locations)) !== canonicalJson(basis.locations) ||
      canonicalJson(ordered(origin.notes)) !== canonicalJson(basis.notes)
    )
      continue;
    if (
      canonicalJson(
        origin.itemCatalog?.slice().sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
      ) !== canonicalJson(itemCatalog)
    )
      continue;
    const run = sessionRunRow(db, row);
    try {
      for (const ref of origin.encounters) {
        const source = readGenerationRun(db, cam, ref.runId);
        assertGenerationSourcesCurrent(db, cam, source);
        const registry = readGeneratorRegistry(db, cam);
        if (
          registry.presets.find((p) => p.id === registry.effectiveId)?.revision !==
          ref.preset.revision
        )
          throw new Error('Regelrevision geändert.');
        for (const loot of source.lootTables ?? []) {
          const current = checkedQuery(
            db,
            'SELECT revision,trashed FROM loot_table WHERE campaign_id=? AND id=?',
            { revision: 'integer', trashed: 'integer' },
          ).get(cam, loot.id);
          if (!current || current.trashed || current.revision !== loot.revision)
            throw new Error('Beutequelle geändert.');
        }
      }
      // Compare against original rewards, never an edited proposal's replacement.
      assertSessionRewardBasisCurrent(db, cam, p, run, { ...run.proposals[0]!, reward: null });
    } catch {
      continue;
    }
    return run;
  }
  return null;
}

export function generateSession(
  db: SqliteDatabase,
  cam: string,
  request: SessionGenerationRequest,
): SessionRun {
  return db
    .transaction(() => {
      if (request.magicPool !== undefined && request.compensateMagic !== true)
        throw new Error('Ein Gegenstandspool benötigt den magischen Beuteausgleich.');
      const p = profile(db, cam, request.planId);
      if (p.revision !== request.expectedProfileRevision)
        throw new Error('Planungsparty geändert.');
      const targets = sessionTargets(p.party, p.adventureDayFraction, p.seed, request.count),
        count = targets.encounterTargets.length;
      if (
        new Set(request.locationIds).size !== request.locationIds.length ||
        new Set(request.noteIds).size !== request.noteIds.length ||
        request.locationIds.length > count
      )
        throw new Error(
          'Die gewählten Orte benötigen mindestens ebenso viele Begegnungen. Automatik berechnet ' +
            count +
            '; Anzahl ausdrücklich erhöhen oder weniger Orte wählen.',
        );
      const party = assessEncounter(p.party, []);
      if (!party.partySize || party.unknownLevels)
        throw new Error('Die Generierung benötigt eine bekannte Planungsparty.');
      const { dayBudget, budget } = targets;
      if (budget <= 0 || targets.encounterTargets.some((n) => n <= 0))
        throw new Error('Adventure Day benötigt ein positives XP-Budget.');
      const locations = request.locationIds.map((id) => ({
          id,
          document: availableLocation(db, cam, id),
        })),
        notes = [...new Set([...request.noteIds, ...(request.encounter.factionIds ?? [])])].map(
          (id) => note(db, cam, id),
        );
      const reusable = reusableSession(db, cam, p, request);
      if (reusable) return reusable;
      const required = requiredGenerationNpcs(db, cam, {
          ...request.encounter,
          party: p.party,
          seed: p.seed,
          count: count,
          title: '',
        }),
        assignments = Array.from({ length: count }, () => [] as string[]);
      for (const [i, n] of required.entries()) {
        const scene = locations.length
          ? locations.findIndex((l) => l.id === n.locationId)
          : i % count;
        if (scene < 0)
          throw new Error(n.name + ': wähle den tatsächlichen NPC-Ort für diesen Spielabend.');
        assignments[scene]!.push(n.id);
      }
      const perLocation =
        (request.worldSourcesByLocation === true ||
          request.encounter.npcOnly === true ||
          request.encounter.includeNpcs === true) &&
        locations.length > 0;
      const proposals: SessionRun['proposals'] = [],
        warnings: string[] = [];
      let usedXp = 0,
        firstRunId = '';
      for (let index = 0; index < count; index++) {
        const place = locations.length ? locations[index % locations.length] : null,
          source = generateEncounters(db, cam, {
            ...request.encounter,
            requiredNpcIds: assignments[index],
            excludedNpcIds: [
              ...(request.encounter.excludedNpcIds ?? []),
              ...required.filter((n) => !assignments[index]!.includes(n.id)).map((n) => n.id),
            ],
            ...(perLocation ? { locationId: place?.id ?? null } : {}),
            party: p.party,
            seed: p.seed + '|scene|' + index,
            count: 1,
            title: place?.document.name ?? 'Spielabend-Begegnung',
            targetXp: targets.encounterTargets[index],
            xpCeiling: Math.min(request.encounter.xpCeiling ?? budget, budget - usedXp),
          }),
          encounter = source.plans[0]!;
        firstRunId ||= source.id;
        usedXp += encounter.assessment.adjustedXp;
        encounter.generationOrigin = {
          runId: source.id,
          index: 0,
          seed: source.seed,
          preset: source.preset,
        };
        warnings.push(...source.warnings.map((text) => 'Szene ' + (index + 1) + ': ' + text));
        const bindings = notes.filter((_, i) => i % count === index),
          loot = source.lootTables?.length === 1 ? source.lootTables[0]! : null,
          lootSeed = source.seed + '|reward|' + index;
        const reward = loot
          ? { poolXp: 0, items: previewLoot(db, cam, loot.id, loot.revision, lootSeed) }
          : null;
        proposals.push({
          id: randomUUID(),
          revision: 1,
          index,
          title: place?.document.name ?? 'Begegnung ' + (index + 1),
          notes: [encounter.notes, ...bindings.map((n) => n.title + '\n' + n.gmNotes)].join('\n\n'),
          readAloud: bindings
            .map((n) => n.readAloud)
            .filter(Boolean)
            .join('\n\n'),
          locationId: place?.id ?? null,
          noteIds: [
            ...new Set([
              ...bindings.map((n) => n.id),
              ...encounter.entries.flatMap((e) => e.worldActorIds ?? []),
            ]),
          ],
          encounter,
          reward,
          rewardOrigin: loot ? { tableId: loot.id, revision: loot.revision, seed: lootSeed } : null,
          acceptedVisitId: null,
        });
      }
      if (usedXp > budget)
        throw new Error(
          'Die gültigen Kompositionen benötigen ' +
            usedXp +
            ' XP; das Adventure-Day-Budget beträgt ' +
            budget +
            '. Mehr Adventure Day oder andere Quellen/Presetbereiche wählen.',
        );
      const lootGuidance =
        request.compensateLoot === true || request.compensateMagic === true
          ? applyLootGuidance(
              db,
              cam,
              p,
              proposals,
              request.compensateMagic === true,
              request.magicPool,
            )
          : undefined;
      const origin: NonNullable<SessionRun['origin']> = {
        version: 'session-origin-v1',
        request: normalizedSessionRequest(request),
        itemCatalog: sessionMagicCatalog(db, request),
        ...sessionWorldBasis(db, cam, request),
        encounters: proposals.map((p) => {
          const g = readGenerationRun(db, cam, p.encounter.generationOrigin!.runId);
          return { runId: g.id, seed: g.seed, catalogHash: g.catalogHash, preset: g.preset };
        }),
        rewards: structuredClone(proposals.map((p) => p.reward ?? null)),
      };
      const run: SessionRun = {
        origin,
        targets,
        ...(lootGuidance ? { lootGuidance } : {}),
        id: randomUUID(),
        worldSourcesByLocation: perLocation,
        planId: p.planId,
        profileRevision: p.revision,
        seed: p.seed,
        dayBudget,
        budget,
        usedXp,
        generationRunId: firstRunId,
        proposals,
        warnings: [...new Set(warnings)],
      };
      return saveSessionRun(db, cam, run);
    })
    .immediate();
}

export function regenerateSessionProposal(
  db: SqliteDatabase,
  cam: string,
  id: string,
  index: number,
  seed: string,
): SessionRun {
  return db
    .transaction(() => {
      const run = readSessionRun(db, cam, id),
        proposal = run.proposals[index];
      if (!proposal || proposal.acceptedVisitId)
        throw new Error(
          'Angenommene Szenen bleiben erhalten. Für neue Ergebnisse eine weitere Vorschau erzeugen.',
        );
      const source = readGenerationRun(
          db,
          cam,
          proposal.encounter.generationOrigin?.runId ?? run.generationRunId,
        ),
        generated = generateEncounters(db, cam, {
          ...source.request,
          ...(run.worldSourcesByLocation ? { locationId: proposal.locationId } : {}),
          count: 1,
          seed,
          targetXp:
            run.targets?.encounterTargets[index] ?? proposal.encounter.assessment.adjustedXp,
          xpCeiling: Math.min(
            source.request.xpCeiling ?? run.budget,
            run.budget - run.usedXp + proposal.encounter.assessment.adjustedXp,
          ),
        }),
        encounter = generated.plans[0]!,
        used =
          run.usedXp - proposal.encounter.assessment.adjustedXp + encounter.assessment.adjustedXp;
      if (used > run.budget)
        throw new Error('Neuer Vorschlag überschreitet das verbleibende Tagesbudget.');
      encounter.generationOrigin = {
        runId: generated.id,
        index: 0,
        seed: generated.seed,
        preset: generated.preset,
      };
      const next: SessionRun = {
        ...run,
        origin: undefined,
        id: randomUUID(),
        seed,
        usedXp: used,
        proposals: run.proposals.map((p, i) =>
          i === index
            ? {
                ...p,
                id: randomUUID(),
                revision: (p.revision ?? 1) + 1,
                needsEncounterRefresh: false,
                rejected: false,
                noteIds: [
                  ...new Set([
                    ...p.noteIds.filter(
                      (id) => !p.encounter.entries.some((e) => e.worldActorIds?.includes(id)),
                    ),
                    ...encounter.entries.flatMap((e) => e.worldActorIds ?? []),
                  ]),
                ],
                encounter,
              }
            : p,
        ),
      };
      return saveSessionRun(db, cam, next);
    })
    .immediate();
}

export function regenerateSessionReward(
  db: SqliteDatabase,
  cam: string,
  id: string,
  index: number,
  seed: string,
): SessionRun {
  return db
    .transaction(() => {
      const run = readSessionRun(db, cam, id),
        p = run.proposals[index];
      if (!p || p.acceptedVisitId) throw new Error('Angenommene Belohnungen bleiben erhalten.');
      const source = readGenerationRun(
          db,
          cam,
          p.encounter.generationOrigin?.runId ?? run.generationRunId,
        ),
        loot = source.lootTables?.length === 1 ? source.lootTables[0]! : null;
      if (!loot && !run.lootGuidance)
        throw new Error(
          'Diese Begegnung hat keine eindeutige Beutetabelle. Belohnung manuell bearbeiten.',
        );
      const raw = loot ? previewLoot(db, cam, loot.id, loot.revision, seed) : [],
        result = run.lootGuidance
          ? fitSessionReward(db, raw, run.lootGuidance, index, seed)
          : { items: raw, warnings: [], missing: undefined },
        items = result.items,
        next = {
          ...run,
          origin: undefined,
          id: randomUUID(),
          proposals: run.proposals.map((p, i) =>
            i === index
              ? {
                  ...p,
                  revision: (p.revision ?? 1) + 1,
                  rewardEdited: false,
                  rewardWarnings: result.warnings,
                  rewardMissingMagic: run.lootGuidance?.magic ? result.missing : undefined,
                  reward: { poolXp: p.reward?.poolXp ?? 0, items },
                  rewardOrigin: loot ? { tableId: loot.id, revision: loot.revision, seed } : null,
                }
              : p,
          ),
        };
      return saveSessionRun(db, cam, next);
    })
    .immediate();
}

export function executeSession(
  db: SqliteDatabase,
  command: SessionCommand,
  guard: () => void,
  publish: PlanPublisher,
): SessionView {
  return db
    .transaction(() => {
      guard();
      const cam = command.campaignId,
        fp = hash(json({ ...command, token: undefined })),
        prior = checkedQuery(db, 'SELECT * FROM session_receipt WHERE command_id=?', {
          command_id: 'text',
          campaign_id: 'text',
          fingerprint: 'text',
          payload: 'text',
          checksum: 'text',
        }).get(command.commandId);
      if (prior) {
        if (prior.campaign_id !== cam || prior.fingerprint !== fp)
          throw new Error('Änderungskennung bereits anders verwendet.');
        const result = checkedSessionReceipt(db, prior);
        const planId =
          command.action.kind === 'profile' ? command.action.profile.planId : command.action.planId;
        if (result.profile.planId !== planId)
          throw new Error('Spielabendbestätigung gehört zu einem anderen Plan.');
        return result;
      }
      const a = command.action;
      let planId: string;
      if (a.kind === 'edit-proposal' || a.kind === 'reject-proposal') {
        planId = a.planId;
        const run = readSessionRun(db, cam, a.runId),
          p = run.proposals[a.index];
        if (
          run.planId !== planId ||
          !p ||
          p.acceptedVisitId ||
          (p.revision ?? 1) !== a.expectedRevision
        )
          throw new Error('Vorschlag geändert oder bereits angenommen. Neu öffnen.');
        if (a.kind === 'reject-proposal') {
          if (typeof a.rejected !== 'boolean') throw new Error('Vorschlagsstatus prüfen.');
          p.rejected = a.rejected;
          p.revision = (p.revision ?? 1) + 1;
        } else {
          if (
            typeof a.title !== 'string' ||
            !a.title.trim() ||
            a.title.length > 1000 ||
            typeof a.notes !== 'string' ||
            a.notes.length > 2000000 ||
            typeof a.readAloud !== 'string' ||
            a.readAloud.length > 2000000 ||
            !Array.isArray(a.noteIds) ||
            a.noteIds.length > 1000
          )
            throw new Error('Vorschlag benötigt Titel und gültige Texte/Verweise.');
          if (a.locationId) availableLocation(db, cam, a.locationId);
          for (const id of a.noteIds) note(db, cam, id);
          let reward = null;
          if (a.reward != null) {
            checkedSessionReward(a.reward);
            for (const item of a.reward.items) validateItemInput(db, item);
            reward = structuredClone(a.reward);
          }
          Object.assign(p, {
            title: a.title,
            notes: a.notes,
            readAloud: a.readAloud,
            locationId: a.locationId,
            noteIds: [...new Set(a.noteIds)],
            reward,
            rewardEdited: p.rewardEdited || json(p.reward ?? null) !== json(reward),
            needsEncounterRefresh:
              p.needsEncounterRefresh ||
              (!!run.worldSourcesByLocation && p.locationId !== a.locationId),
            revision: (p.revision ?? 1) + 1,
          });
        }
        const payload = json(run);
        db.prepare('UPDATE session_run SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
          payload,
          hash(payload),
          cam,
          run.id,
        );
      } else if (a.kind === 'scene-planning') {
        planId = a.planId;
        const plan = readPlan(db, cam, planId),
          index = plan.scenes.findIndex((s) => s.id === a.visitId),
          d = detail(db, cam, planId, a.visitId);
        if (plan.revision !== a.expectedPlanRevision || d.revision !== a.expectedVisitRevision)
          throw new Error('Plan oder Szenenvorbereitung geändert. Tagesplan erneut ansehen.');
        if (a.allocationXp === undefined && a.rest === undefined)
          throw new Error('Szenenplanung fehlt.');
        if (a.allocationXp !== undefined) {
          if (a.allocationXp === null) delete d.allocationXp;
          else d.allocationXp = a.allocationXp;
        }
        if (a.rest !== undefined) {
          if (
            !a.rest ||
            index < 0 ||
            plan.scenes[index + 1]?.id !== a.rest.beforeVisitId ||
            (a.rest.kind !== null && !['short', 'long'].includes(a.rest.kind))
          )
            throw new Error('Rasten nur zwischen benachbarten Szenen planen.');
          if (a.rest.kind === null) delete d.restAfter;
          else d.restAfter = { kind: a.rest.kind, beforeVisitId: a.rest.beforeVisitId };
        }
        checkVisitPlanning(d);
        saveDetail(db, cam, planId, d);
        publish(plan, plan.revision);
      } else if (a.kind === 'copy-visits') {
        planId = a.planId;
        copySessionVisits(db, cam, a, publish);
      } else if (a.kind === 'replace-plan') {
        planId = a.planId;
        replaceSessionPlan(db, cam, a, publish);
      } else if (a.kind === 'profile') {
        planId = a.profile.planId;
        const old = profile(db, cam, planId),
          p = structuredClone(a.profile);
        if (old.revision !== a.expectedRevision) throw new Error('Spielabendprofil geändert.');
        assessEncounter(p.party, []);
        if (
          p.encounterCount != null &&
          (!Number.isSafeInteger(p.encounterCount) || p.encounterCount < 1 || p.encounterCount > 10)
        )
          throw new Error(
            'Begegnungszahl muss zwischen 1 und 10 liegen oder für Automatik leer bleiben.',
          );
        const fraction = Number(exactWeight(p.adventureDayFraction));
        if (
          !Number.isFinite(fraction) ||
          fraction < 0 ||
          fraction > 10 ||
          typeof p.seed !== 'string' ||
          !p.seed.trim() ||
          p.seed.length > 1000
        )
          throw new Error(
            'Adventure Day benötigt einen Anteil zwischen 0 und 10 sowie einen Seed.',
          );
        p.revision = old.revision + 1;
        p.adventureDayFraction = exactWeight(p.adventureDayFraction);
        checkedSessionProfileValue(p);
        const payload = json(p);
        db.prepare(
          'INSERT INTO session_profile VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,plan_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
        ).run(cam, planId, p.revision, payload, hash(payload));
      } else if (a.kind === 'accept-proposal' || a.kind === 'accept-proposals') {
        planId = a.planId;
        const plan = readPlan(db, cam, planId),
          run = readSessionRun(db, cam, a.runId);
        if (run.planId !== planId) throw new Error('Szenenvorschlag gehört nicht zu diesem Plan.');
        const picks =
          a.kind === 'accept-proposals'
            ? a.proposals
            : [{ index: a.index, expectedRevision: undefined }];
        if (
          !Array.isArray(picks) ||
          !picks.length ||
          picks.length > run.proposals.length ||
          new Set(picks.map((p) => p.index)).size !== picks.length
        )
          throw new Error('Szenenauswahl prüfen.');
        const proposals = picks
          .map((p) => {
            const proposal = run.proposals[p.index];
            if (!Number.isSafeInteger(p.index) || !proposal || proposal.index !== p.index)
              throw new Error('Szenenvorschlag fehlt.');
            if (
              a.kind === 'accept-proposals' &&
              ((proposal.revision ?? 1) !== p.expectedRevision || proposal.acceptedVisitId)
            )
              throw new Error(
                'Ausgewählter Vorschlag geändert oder bereits übernommen. Auswahl erneut ansehen.',
              );
            return proposal;
          })
          .filter((p) => !p.acceptedVisitId)
          .sort((x, y) => x.index - y.index);
        if (proposals.length && plan.revision !== a.expectedPlanRevision)
          throw new Error('Timeline geändert. Erneut ansehen und bewusst übernehmen.');
        for (const proposal of proposals) {
          if (proposal.rejected)
            throw new Error('Verworfenen Vorschlag vor Übernahme wiederherstellen.');
          if (proposal.needsEncounterRefresh)
            throw new Error('Ort geändert: diese Begegnung vor der Übernahme neu erzeugen.');
          const source = readGenerationRun(
            db,
            cam,
            proposal.encounter.generationOrigin?.runId ?? run.generationRunId,
          );
          assertGenerationSourcesCurrent(db, cam, source);
          assertSessionRewardBasisCurrent(db, cam, profile(db, cam, planId), run, proposal);
        }
        const additions = proposals.map((proposal) => ({
          proposal,
          visitId: campaignLocalId(randomUUID()),
        }));
        if (additions.length)
          publish(
            {
              ...plan,
              scenes: [
                ...plan.scenes,
                ...additions.map(({ proposal, visitId }) => ({
                  id: visitId,
                  title: proposal.title,
                  notes: proposal.notes,
                  locationId: proposal.locationId ? campaignLocalId(proposal.locationId) : null,
                })),
              ],
            },
            plan.revision,
          );
        for (const { proposal, visitId } of additions) {
          const g = newGroup(db, cam, proposal.encounter, planId, visitId);
          saveDetail(db, cam, planId, {
            visitId,
            revision: 0,
            readAloud: proposal.readAloud,
            noteIds: proposal.noteIds,
            groupIds: [g.id],
            reward: proposal.reward
              ? {
                  id: randomUUID(),
                  ...structuredClone(proposal.reward),
                  placedTreasureId: null,
                  awarded: false,
                }
              : null,
          });
          db.prepare('INSERT INTO session_proposal_acceptance VALUES(?,?,?,?)').run(
            cam,
            run.id,
            proposal.index,
            visitId,
          );
        }
      } else {
        planId = a.planId;
        if (a.kind === 'place' || a.kind === 'group-content') {
          const g = readPreparedGroup(db, cam, a.groupId);
          if (g.revision !== a.expectedRevision) throw new Error('Vorbereitete Gruppe geändert.');
          const row = checkedQuery(
            db,
            'SELECT draft_plan_id,draft_visit_id FROM prepared_group WHERE campaign_id=? AND id=?',
            { draft_plan_id: 'nullable-text', draft_visit_id: 'nullable-text' },
          ).required(cam, g.id);
          if (a.kind === 'place') {
            availableLocation(db, cam, a.locationId, a.expectedLocationRevision);
            g.locationId = a.locationId;
            materialize(db, cam, g);
          } else {
            if (
              typeof a.title !== 'string' ||
              a.title.length > 1000 ||
              typeof a.notes !== 'string' ||
              a.notes.length > 2000000
            )
              throw new Error('Ungültiger Gruppeninhalt.');
            g.title = a.title;
            g.notes = a.notes;
          }
          g.revision++;
          saveGroup(
            db,
            cam,
            g,
            g.locationId ? null : row.draft_plan_id,
            g.locationId ? null : row.draft_visit_id,
          );
          if (a.kind === 'place')
            placeNpcGroup(
              db,
              cam,
              g.actors.map((actor) => actor.id),
              a.locationId,
            );
        } else {
          const visitId = a.kind === 'visit' ? a.detail.visitId : a.visitId,
            d = detail(db, cam, planId, visitId);
          if (
            a.kind === 'visit'
              ? d.revision !== a.expectedRevision
              : d.revision !== a.expectedVisitRevision
          )
            throw new Error('Besuchsinhalte geändert.');
          if (a.kind === 'visit') {
            if (a.noteThread !== undefined) {
              checkNoteThread(db, cam, a.noteThread);
              const selected = [
                ...a.noteThread.entries.map((e) => e.id),
                ...(a.noteThread.includeRoot ? [a.noteThread.rootId] : []),
              ];
              if (
                !Array.isArray(a.detail.noteIds) ||
                selected.some((id) => !a.detail.noteIds.includes(id))
              )
                throw new Error('Notizmappenauswahl passt nicht zum Besuch.');
            }
            if (
              typeof a.detail.readAloud !== 'string' ||
              a.detail.readAloud.length > 2000000 ||
              !Array.isArray(a.detail.noteIds)
            )
              throw new Error('Ungültige Besuchsinhalte.');
            for (const id of a.detail.noteIds) note(db, cam, id);
            d.readAloud = a.detail.readAloud;
            d.noteIds = [...new Set(a.detail.noteIds)];
            if (d.reward?.placedTreasureId || d.reward?.awarded) {
              if (json(d.reward) !== json(a.detail.reward))
                throw new Error(
                  'Platzierte oder vergebene Belohnung über ihren bestehenden Beuteeintrag bearbeiten.',
                );
            } else if (a.detail.reward) {
              if (
                !Number.isSafeInteger(a.detail.reward.poolXp) ||
                a.detail.reward.poolXp < 0 ||
                !Array.isArray(a.detail.reward.items)
              )
                throw new Error('Ungültige Belohnung.');
              d.reward = {
                ...structuredClone(a.detail.reward),
                id: d.reward?.id ?? randomUUID(),
                placedTreasureId: null,
                awarded: false,
              };
            } else d.reward = null;
          } else if (a.kind === 'attach') {
            const source = readEncounterPlan(db, cam, a.encounterId);
            if (source.revision !== a.expectedEncounterRevision)
              throw new Error('Encounter-Vorlage geändert.');
            d.groupIds.push(newGroup(db, cam, source, planId, visitId).id);
          } else if (a.kind === 'detach') {
            d.groupIds = d.groupIds.filter((id) => id !== a.groupId);
            releaseVisitGroups(db, cam, planId, visitId, a.groupId);
          } else if (a.kind === 'place-reward') {
            availableLocation(db, cam, a.locationId, a.expectedLocationRevision);
            if (!d.reward?.items.length) throw new Error('Keine vorbereitete Beute.');
            if (!d.reward.placedTreasureId)
              d.reward.placedTreasureId = makeTreasure(
                db,
                cam,
                readPlan(db, cam, planId).scenes.find((s) => s.id === visitId)!.title + ' · Beute',
                null,
                null,
                d.reward.items,
                a.locationId,
              );
          } else if (a.kind === 'award-reward') {
            if (!d.reward) throw new Error('Keine vorbereitete Belohnung.');
            if (d.reward.awarded) throw new Error('Diese Besuchsbelohnung wurde bereits vergeben.');
            if ((a.noXp && a.recipients.length) || (!a.noXp && !a.recipients.length))
              throw new Error('XP-Empfänger oder ausdrücklich keine XP wählen.');
            awardXpPool(db, cam, a.noXp ? 0 : d.reward.poolXp, a.recipients, 'visit', d.reward.id);
            if (d.reward.items.length && !d.reward.placedTreasureId)
              d.reward.placedTreasureId = makeTreasure(
                db,
                cam,
                readPlan(db, cam, planId).scenes.find((s) => s.id === visitId)!.title +
                  ' · Belohnung',
                null,
                null,
                d.reward.items,
              );
            d.reward.awarded = true;
          } else throw new Error('Unbekannte Besuchsaktion.');
          saveDetail(db, cam, planId, d);
        }
      }
      const { plan: confirmedPlan, ...result } = readSession(db, cam, planId),
        payload = json(result);
      db.prepare('INSERT INTO session_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}

export function createDungeonGroup(
  db: SqliteDatabase,
  cam: string,
  encounterId: string,
  locationId: string,
): PreparedGroup {
  availableLocation(db, cam, locationId);
  const group = newGroup(db, cam, readEncounterPlan(db, cam, encounterId), null, null);
  group.locationId = locationId;
  materialize(db, cam, group);
  saveGroup(db, cam, group, null, null);
  return group;
}
