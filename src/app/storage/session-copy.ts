import { copyVisitPlanning } from '../session-day';
import { randomUUID } from 'node:crypto';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import type { SessionAction, PlanPublisher, PreparedGroup } from '../session-contracts';
import { readPlan, readSession, saveDetail, newGroup, saveGroup } from './session';
import { createHash } from 'node:crypto';
/** Add authored preparation, preserving existing physical groups and booked rewards. */
export function copySessionVisits(
  db: any,
  cam: string,
  a: Extract<SessionAction, { kind: 'copy-visits' }>,
  publish: PlanPublisher,
) {
  const contents = readSession(db, cam, a.sourcePlanId),
    source = contents.plan;
  if (contents.replacementBasis !== a.expectedSourceBasis)
    throw new Error('Quellplan oder Vorbereitung geändert. Auswahl erneut öffnen.');
  if (
    typeof a.name !== 'string' ||
    a.name.length > 1000 ||
    typeof a.copyParty !== 'boolean' ||
    !Array.isArray(a.visitIds) ||
    !a.visitIds.length ||
    a.visitIds.length > 1000 ||
    new Set(a.visitIds).size !== a.visitIds.length
  )
    throw new Error('Szenenauswahl und Planangaben prüfen.');
  const newPlan = a.expectedBasis === null;
  if (newPlan && db.prepare('SELECT 1 FROM plan WHERE campaign_id=? AND id=?').get(cam, a.planId))
    throw new Error('Zielplan bereits vorhanden. Auswahl erneut öffnen.');
  const target = newPlan
    ? { version: 1 as const, id: campaignLocalId(a.planId), revision: 1, name: a.name, scenes: [] }
    : readPlan(db, cam, a.planId);
  if (!newPlan && readSession(db, cam, target.id).replacementBasis !== a.expectedBasis)
    throw new Error('Zielplan oder Vorbereitung geändert. Auswahl erneut öffnen.');
  if (!newPlan && a.copyParty)
    throw new Error('Planungsparty nur für einen neuen Abend übernehmen.');
  const scenes = a.visitIds.map((id) => {
    const s = source.scenes.find((s) => s.id === id);
    if (!s) throw new Error('Ausgewählter Besuch fehlt.');
    return { ...s, id: campaignLocalId(randomUUID()) };
  });
  const originals = new Map(
    contents.groups.map((g) => {
      const row = db
          .prepare('SELECT draft_plan_id FROM prepared_group WHERE campaign_id=? AND id=?')
          .get(cam, g.id),
        accepted = db
          .prepare(
            'SELECT world_group_id FROM prepared_group_origin WHERE campaign_id=? AND source_group_id=?',
          )
          .get(cam, g.id);
      return [
        g.id,
        {
          group: g,
          acceptedId: accepted?.world_group_id ?? (row.draft_plan_id === null ? g.id : null),
        },
      ] as const;
    }),
  );
  publish({ ...target, scenes: [...target.scenes, ...scenes] }, newPlan ? null : target.revision);
  const copiedGroups = new Map<string, string>();
  for (const [index, scene] of scenes.entries()) {
    const old = contents.visits.find((v) => v.visitId === a.visitIds[index]);
    if (!old) throw new Error('Besuchsvorbereitung fehlt.');
    const groupIds = old.groupIds.map((id) => {
      const original = originals.get(id);
      if (!original) throw new Error('Vorbereitete Gruppe fehlt.');
      if (original.acceptedId) return original.acceptedId;
      if (copiedGroups.has(id)) return copiedGroups.get(id)!;
      const g: PreparedGroup = newGroup(db, cam, original.group.plan, target.id, scene.id);
      g.title = original.group.title;
      g.notes = original.group.notes;
      saveGroup(db, cam, g, target.id, scene.id);
      copiedGroups.set(id, g.id);
      return g.id;
    });
    const reward = old.reward ? structuredClone(old.reward) : null;
    if (reward && !reward.awarded && !reward.placedTreasureId) reward.id = randomUUID();
    const copied = structuredClone(old);
    delete copied.restAfter;
    saveDetail(db, cam, target.id, {
      ...copied,
      ...copyVisitPlanning(
        old,
        a.visitIds,
        scenes.map((s) => s.id),
      ),
      visitId: scene.id,
      revision: 0,
      groupIds,
      reward,
    });
  }
  if (newPlan && a.copyParty) {
    const p = { ...structuredClone(contents.profile), planId: target.id, revision: 1 },
      payload = JSON.stringify(p);
    db.prepare('INSERT INTO session_profile VALUES(?,?,?,?,?)').run(
      cam,
      target.id,
      1,
      payload,
      createHash('sha256').update(payload).digest('hex'),
    );
  }
}
