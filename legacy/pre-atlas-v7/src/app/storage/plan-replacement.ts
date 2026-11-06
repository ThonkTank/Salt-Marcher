import { copyVisitPlanning } from '../runtime/session-day';
import { randomUUID } from 'node:crypto';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import type { SessionAction, PlanPublisher } from '../campaign/session-contracts';
import { saveDetail, newGroup, saveGroup } from './preparation-write';
import { readSession } from './session-read';
import { createHash } from 'node:crypto';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function replaceSessionPlan(
  db: any,
  cam: string,
  a: Extract<SessionAction, { kind: 'replace-plan' }>,
  publish: PlanPublisher,
) {
  const before = readSession(db, cam, a.planId),
    target = before.plan;
  if (before.replacementBasis !== a.expectedBasis)
    throw new Error('Plan oder Vorbereitung inzwischen geändert. Ersatzvorschau erneut öffnen.');
  if (typeof a.name !== 'string' || a.name.length > 1000 || typeof a.copyParty !== 'boolean')
    throw new Error('Planangaben ungültig.');
  const contents = a.sourcePlanId ? readSession(db, cam, a.sourcePlanId) : null,
    source = contents?.plan ?? null;
  if (
    (contents && contents.replacementBasis !== a.expectedSourceBasis) ||
    (!contents && a.expectedSourceBasis !== null)
  )
    throw new Error('Vorlage inzwischen geändert. Ersatzvorschau erneut öffnen.');
  const originals = new Map(
    contents?.groups.map((g) => {
      const row = db
          .prepare('SELECT draft_plan_id FROM prepared_group WHERE campaign_id=? AND id=?')
          .get(cam, g.id),
        world = db
          .prepare(
            'SELECT world_group_id FROM prepared_group_origin WHERE campaign_id=? AND source_group_id=?',
          )
          .get(cam, g.id);
      return [
        g.id,
        {
          group: g,
          acceptedId: world?.world_group_id ?? (row.draft_plan_id === null ? g.id : null),
        },
      ] as const;
    }) ?? [],
  );
  const scenes = source?.scenes.map((s) => ({ ...s, id: campaignLocalId(randomUUID()) })) ?? [];
  publish({ ...target, name: a.name, scenes }, target.revision);
  // Suggested work belongs to the old timeline; source generator facts remain as provenance.
  db.prepare(
    'DELETE FROM session_proposal_acceptance WHERE campaign_id=? AND run_id IN(SELECT id FROM session_run WHERE campaign_id=? AND plan_id=?)',
  ).run(cam, cam, target.id);
  db.prepare('DELETE FROM session_run WHERE campaign_id=? AND plan_id=?').run(cam, target.id);
  for (const [index, scene] of scenes.entries()) {
    const old = contents!.visits.find((v) => v.visitId === source!.scenes[index]!.id)!;
    const groupIds = old.groupIds.map((id) => {
      const original = originals.get(id);
      if (!original) throw new Error('Vorlagengruppe fehlt.');
      if (original.acceptedId) return original.acceptedId;
      const g = newGroup(db, cam, original.group.plan, target.id, scene.id);
      g.title = original.group.title;
      g.notes = original.group.notes;
      saveGroup(db, cam, g, target.id, scene.id);
      return g.id;
    });
    const reward = old.reward ? structuredClone(old.reward) : null;
    if (reward && !reward.awarded) reward.id = randomUUID();
    const copied = structuredClone(old);
    delete copied.restAfter;
    saveDetail(db, cam, target.id, {
      ...copied,
      ...copyVisitPlanning(
        old,
        source!.scenes.map((s) => s.id),
        scenes.map((s) => s.id),
      ),
      visitId: scene.id,
      revision: 0,
      groupIds,
      reward,
    });
  }
  if (a.copyParty && contents) {
    const p = {
        ...structuredClone(contents.profile),
        planId: target.id,
        revision: before.profile.revision + 1,
      },
      payload = JSON.stringify(p);
    db.prepare(
      'INSERT INTO session_profile VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,plan_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
    ).run(cam, target.id, p.revision, payload, hash(payload));
  }
  const facts = JSON.stringify({
    recordedAt: new Date().toISOString(),
    text:
      'Spielabendplan ersetzt' + (source ? ' aus ' + (source.name || 'unbenannter Vorlage') : ''),
    facts: {
      kind: 'plan-replaced',
      planId: target.id,
      sourcePlanId: source?.id ?? null,
      previousVisitIds: target.scenes.map((s) => s.id),
      visitIds: scenes.map((s) => s.id),
    },
  });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    cam,
    randomUUID(),
    null,
    facts,
    hash(facts),
  );
}
