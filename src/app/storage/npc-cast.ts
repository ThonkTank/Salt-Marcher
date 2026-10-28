import { createHash } from 'node:crypto';
import type { NpcCastQuery, NpcCastPage, NpcDossier } from '../campaign/npc-cast-contracts';
import { readNpcPlanLocation } from './npc-daily-places';
import { dailyPlanAt } from '../campaign/npc-daily-plan';
import { readNpcPlaces } from './npc-places';
import { readNpcs } from './npcs';
import { readNpc } from './npc-read';
import { readLiveScene } from './live-read';
import { readWorldCalendar } from './world-calendar-read';
import { calendarDate } from '../runtime/world-model';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { worldNoteDocument } from '../../features/world/world-notes';
const decode = (row: any) => {
  if (!row || createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('NSC-Dossierquelle fehlt oder ist beschädigt.');
  return JSON.parse(row.payload);
};
const note = (row: any) => {
  const n = worldNoteDocument(decode(row));
  if (n.id !== row.id || n.revision !== row.revision)
    throw new Error('NSC-Dossierquelle widerspricht ihrer Identität.');
  return n;
};
function scene(db: any, cam: string, id: string) {
  const s = readLiveScene(db, cam, id);
  if (s.retired) throw new Error('Diese Gruppe ist archiviert.');
  return s;
}
function locationTitle(db: any, cam: string, id: string | null) {
  if (!id) return 'Ohne Ortsbindung';
  const row = db
    .prepare('SELECT payload,checksum,trashed FROM location WHERE campaign_id=? AND id=?')
    .get(cam, id);
  if (!row) return 'Ort nicht verfügbar';
  const location = checkedLocationDocument(decode(row));
  if (location.id !== id) throw new Error('NSC-Dossierquelle widerspricht ihrer Identität.');
  return location.name + (row.trashed ? ' · Papierkorb' : '');
}
export function readNpcCast(db: any, cam: string, q: NpcCastQuery): NpcCastPage {
  if (!q || !['current', 'all', 'unplaced'].includes(q.scope))
    throw new Error('NSC-Ortsfilter prüfen.');
  const s = scene(db, cam, q.sceneId);
  return {
    ...readNpcs(db, cam, {
      text: q.text,
      lifecycle: 'all',
      factionId: null,
      locationId: q.scope === 'current' ? s.locationId : null,
      onlyUnplaced: q.scope === 'unplaced' || (q.scope === 'current' && !s.locationId),
      offset: q.offset,
    }),
    sceneId: s.id,
    sceneTitle: s.title,
    locationTitle: locationTitle(db, cam, s.locationId),
  };
}
export function readNpcDossier(db: any, cam: string, sceneId: string, id: string): NpcDossier {
  const s = scene(db, cam, sceneId),
    npc = readNpc(db, cam, id),
    own = note(db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id)),
    refs: NpcDossier['relations'] = [];
  let relationCount = 0;
  const target = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?');
  for (const r of own.relations) {
    relationCount++;
    if (refs.length >= 40) continue;
    const row = target.get(cam, r.targetId),
      n = row ? note(row) : null;
    refs.push({
      id: r.targetId,
      title: n?.title ?? 'Verweis nicht verfügbar',
      kind: n?.kind ?? '',
      label: r.label,
      incoming: false,
      available: !!row && !row.trashed,
    });
  }
  for (const row of db
    .prepare(
      "SELECT * FROM world_note WHERE campaign_id=? AND trashed=0 AND EXISTS(SELECT 1 FROM json_each(payload,'$.relations') WHERE json_extract(value,'$.targetId')=?) ORDER BY json_extract(payload,'$.title'),id",
    )
    .iterate(cam, id)) {
    const n = note(row);
    for (const r of n.relations.filter((r: any) => r.targetId === id)) {
      relationCount++;
      if (refs.length >= 40) continue;
      refs.push({
        id: n.id,
        title: n.title,
        kind: n.kind,
        label: r.label,
        incoming: true,
        available: true,
      });
    }
  }
  const groups = db
    .prepare(
      "SELECT * FROM prepared_group WHERE campaign_id=? AND EXISTS(SELECT 1 FROM json_each(payload,'$.actors') WHERE json_extract(value,'$.id')=?) ORDER BY json_extract(payload,'$.title'),id LIMIT 20",
    )
    .all(cam, id)
    .map((r: any) => {
      const g = decode(r);
      return { id: g.id, title: g.title };
    });
  const factionRow = npc.record.factionId ? target.get(cam, npc.record.factionId) : null,
    factionNote = factionRow ? note(factionRow) : null,
    faction = npc.record.factionId
      ? {
          id: npc.record.factionId,
          title: factionNote?.title ?? 'Fraktion nicht verfügbar',
          available: !!factionRow && !factionRow.trashed,
        }
      : null;
  const arow = db.prepare('SELECT * FROM autonomy_actor WHERE campaign_id=? AND id=?').get(cam, id),
    a = arow ? decode(arow) : null,
    jrow =
      a && (a.jobId || a.assignedJobId)
        ? db
            .prepare('SELECT * FROM autonomy_job WHERE campaign_id=? AND id=?')
            .get(cam, a.jobId ?? a.assignedJobId)
        : null,
    job = jrow ? decode(jrow) : null,
    latest = db
      .prepare('SELECT coalesce(max(ordinal),0) n FROM autonomy_interval WHERE campaign_id=?')
      .get(cam).n;
  const autonomy = a
    ? {
        enabled: a.enabled,
        paused: a.paused,
        role: a.role,
        pending: a.pending,
        jobName: job?.name ?? '',
        progressSeconds: a.progressSeconds,
        remainingIntervals: Math.max(0, latest - a.cursor),
        needs: a.needs
          .filter((n: any) => n.enabled)
          .map((n: any) => ({ name: n.name, value: n.value })),
      }
    : null;
  const logs = db
    .prepare(
      'SELECT * FROM autonomy_log WHERE campaign_id=? AND actor_id=? ORDER BY rowid DESC LIMIT 12',
    )
    .all(cam, id)
    .map((r: any) => {
      const l = decode(r);
      return { id: l.id, text: l.text };
    });
  const calendar = readWorldCalendar(db, cam),
    places = readNpcPlaces(db, cam, id, 0),
    dailyPlan = {
      ...dailyPlanAt(
        npc.record.dailyPlan,
        s.clock.instantMs,
        calendar.daySeconds,
        calendar.weekdays.length,
        npc.record.dailyOverrides,
      ),
      daySeconds: calendar.daySeconds,
      weekdayTitle:
        calendar.weekdays[
          Number(
            (BigInt(s.clock.instantMs) / (BigInt(calendar.daySeconds) * 1000n)) %
              BigInt(calendar.weekdays.length),
          )
        ]!,
      weekdayTitles: [...calendar.weekdays],
      nextDate: null as string | null,
    };
  if (dailyPlan.nextInstantMs) dailyPlan.nextDate = calendarDate(calendar, dailyPlan.nextInstantMs);
  const targets = [
    ...new Set(
      [...(npc.record.dailyPlan ?? []), dailyPlan.current, dailyPlan.next]
        .filter((s) => s?.place === 'location')
        .map((s) => s!.locationId!),
    ),
  ].map((id) => readNpcPlanLocation(db, cam, id));
  return {
    dailyPlan: { ...dailyPlan, targets },
    places,
    scene: s,
    date: calendarDate(calendar, s.clock.instantMs),
    npc,
    locationTitle: locationTitle(db, cam, npc.locationId),
    faction,
    relations: refs,
    relationCount,
    groups,
    autonomy,
    logs,
  };
}
