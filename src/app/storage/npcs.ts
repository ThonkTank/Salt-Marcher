import { randomUUID } from 'node:crypto';
import type { NpcCommand, NpcDraft, NpcResolution } from '../campaign/npc-contracts';
import type { NpcView, NpcQuery, NpcPage } from '../campaign/npc-data-contracts';
import {
  npcRecord,
  npcDisposition,
  checkedNpcRecord,
  checkedNpcView,
  readNpcDraftRow,
} from './npc-record';
import { npcPositionReader, placeNpc } from './npc-world';
import { writeWorldActorHealth } from './preparation-write';
import { readCreature } from './encounters';
import { syncOpenMaskHealth } from './mask-health';
import { worldNoteDocument } from '../../features/world/world-notes';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { checkedNpcSchedule, npcPlanLocationIds } from '../campaign/npc-daily-plan';
import { readWorldCalendar } from './world-calendar-read';
import { checkedHealth } from '../runtime/progression';
import { hash, readNpc, note } from './npc-read';
export { readNpc } from './npc-read';
export const npcFingerprint = (c: NpcCommand) => hash(JSON.stringify({ ...c, token: undefined }));

function checkedPending(cam: string, d: NpcDraft) {
  const rejected = d.rejectedCommand;
  if (
    rejected &&
    (rejected.campaignId !== cam ||
      rejected.npc?.id !== d.id ||
      typeof rejected.commandId !== 'string' ||
      !rejected.commandId)
  )
    throw new Error('Abgewiesener NPC-Auftrag gehört nicht zu diesem Entwurf.');
  const c = d.pendingCommand;
  if (!c) return;
  if (
    !c.commandId ||
    typeof c.commandId !== 'string' ||
    c.commandId.length > 1000 ||
    c.campaignId !== cam ||
    c.npc?.id !== d.id ||
    c.npc?.record?.id !== d.id ||
    c.draftWriteId !== d.writeId
  )
    throw new Error('NPC-Auftrag gehört nicht zu diesem Entwurf.');
}

function npcReceipt(db: any, c: NpcCommand): NpcView | null {
  const row = db.prepare('SELECT * FROM npc_receipt WHERE command_id=?').get(c.commandId);
  if (!row) return null;
  if (row.campaign_id !== c.campaignId || row.fingerprint !== npcFingerprint(c))
    throw new Error('NPC-Auftragskennung anders verwendet.');
  if (hash(row.payload) !== row.checksum)
    throw new Error('NPC-Beleg beschädigt. Der Originalentwurf bleibt erhalten.');
  const v = checkedNpcView(JSON.parse(row.payload));
  if (
    v?.id !== c.npc.id ||
    v.record?.id !== v.id ||
    v.noteRevision !== (c.expectedNoteRevision ?? 0) + 1 ||
    v.record.revision !== c.expectedRecordRevision + 1
  )
    throw new Error('NPC-Beleg gehört nicht zum ursprünglichen Profil.');
  for (const key of ['name', 'creatureId', 'readAloud', 'gmNotes', 'locationId'] as const)
    if (v[key] !== c.npc[key]) throw new Error('NPC-Beleg weicht vom ursprünglichen Profil ab.');
  for (const key of [
    'factionId',
    'modifier',
    'lifecycle',
    'appearance',
    'behavior',
    'history',
  ] as const)
    if (v.record[key] !== c.npc.record[key])
      throw new Error('NPC-Beleg weicht vom ursprünglichen Profil ab.');
  if (
    JSON.stringify(v.record.demographics) !==
    JSON.stringify(checkedNpcRecord(c.npc.record).demographics)
  )
    throw new Error('NPC-Beleg weicht vom ursprünglichen Demografieprofil ab.');
  if (JSON.stringify(v.record.dailyPlan ?? []) !== JSON.stringify(c.npc.record.dailyPlan ?? []))
    throw new Error('NPC-Beleg weicht vom ursprünglichen Tagesplan ab.');
  if (
    JSON.stringify(v.record.dailyOverrides ?? []) !==
    JSON.stringify(c.npc.record.dailyOverrides ?? [])
  )
    throw new Error('NPC-Beleg weicht von den ursprünglichen Tagesausnahmen ab.');
  if (c.npc.health) {
    const health = checkedHealth(c.npc.health);
    for (const key of ['hp', 'maxHp', 'tempHp', 'conditions', 'concentrating'] as const)
      if (v.health?.[key] !== health[key])
        throw new Error('NPC-Beleg besitzt andere bestätigte Gesundheit.');
  }
  return v;
}

export function readNpcs(db: any, cam: string, q: NpcQuery): NpcPage {
  if (
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !['all', 'active', 'defeated'].includes(q.lifecycle) ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0
  )
    throw new Error('NPC-Suche prüfen.');
  const rows = db
    .prepare(
      `SELECT n.id,json_extract(n.payload,'$.title') name,json_extract(n.payload,'$.creatureId') creatureId,r.faction_id factionId,coalesce(json_extract(r.payload,'$.lifecycle'),'active') lifecycle
  FROM world_note n LEFT JOIN npc_record r ON r.campaign_id=n.campaign_id AND r.id=n.id
  WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND (
   instr(atlas_lower(coalesce(json_extract(n.payload,'$.title'),'')||char(10)||coalesce(json_extract(n.payload,'$.readAloud'),'')||char(10)||coalesce(json_extract(n.payload,'$.gmNotes'),'')||char(10)||coalesce(json_extract(r.payload,'$.appearance'),'')||char(10)||coalesce(json_extract(r.payload,'$.behavior'),'')||char(10)||coalesce(json_extract(r.payload,'$.history'),'')),atlas_lower(@text))>0
   OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.dailyPlan') p WHERE instr(atlas_lower(coalesce(json_extract(p.value,'$.activity'),'')||char(10)||coalesce(json_extract(p.value,'$.notes'),'')),atlas_lower(@text))>0)
   OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.dailyOverrides') o WHERE instr(atlas_lower(coalesce(json_extract(o.value,'$.label'),'')),atlas_lower(@text))>0 OR EXISTS(SELECT 1 FROM json_each(o.value,'$.slots') p WHERE instr(atlas_lower(coalesce(json_extract(p.value,'$.activity'),'')||char(10)||coalesce(json_extract(p.value,'$.notes'),'')),atlas_lower(@text))>0))
  ) AND (@lifecycle='all' OR coalesce(json_extract(r.payload,'$.lifecycle'),'active')=@lifecycle) AND (@faction IS NULL OR r.faction_id=@faction)
  ORDER BY name,n.id`,
    )
    .iterate({ cam, text: q.text, lifecycle: q.lifecycle, faction: q.factionId });
  const positionFor = npcPositionReader(db, cam),
    page: any[] = [];
  let total = 0;
  for (const row of rows) {
    const locationId = positionFor(row.id).locationId;
    if ((q.locationId && locationId !== q.locationId) || (q.onlyUnplaced && locationId !== null))
      continue;
    if (total >= q.offset && page.length < 50) page.push({ ...row, locationId });
    total++;
  }
  return {
    total,
    offset: q.offset,
    rows: page.map((r: any) => ({ ...r, ...npcDisposition(db, cam, npcRecord(db, cam, r.id)) })),
  };
}

export function npcDraft(db: any, cam: string, id: string): NpcDraft | null {
  const r = db.prepare('SELECT * FROM npc_draft WHERE campaign_id=? AND id=?').get(cam, id);
  if (!r) return null;
  const d = readNpcDraftRow(db, r);
  checkedPending(cam, d);
  return d;
}

export function npcDrafts(db: any, cam: string) {
  return db
    .prepare('SELECT id FROM npc_draft WHERE campaign_id=? ORDER BY id LIMIT 50')
    .all(cam)
    .map((r: any) => ({
      id: r.id,
      name: npcDraft(db, cam, r.id)!.fields.name || 'Unbenannter NPC',
    }));
}

export function keepNpcDraft(db: any, cam: string, d: NpcDraft, expected: string | null) {
  return db
    .transaction(() => {
      const p = JSON.stringify(d);
      readNpcDraftRow(db, { campaign_id: cam, id: d.id, payload: p, checksum: hash(p) });
      checkedPending(cam, d);
      const old = npcDraft(db, cam, d.id);
      if (old?.writeId === d.writeId && JSON.stringify(old) === p) return;
      if ((old?.writeId ?? null) !== expected) throw new Error('NPC-Entwurf inzwischen geändert.');
      if (old?.pendingCommand)
        throw new Error('Originaler NPC-Auftrag ist noch ungeklärt. Zuerst prüfen.');
      db.prepare(
        'INSERT INTO npc_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.id, p, hash(p));
    })
    .immediate();
}

export function discardNpcDraft(db: any, cam: string, id: string, writeId: string) {
  const d = npcDraft(db, cam, id);
  if (d?.writeId !== writeId) throw new Error('NPC-Entwurf inzwischen geändert.');
  if (d.pendingCommand)
    throw new Error('Originaler NPC-Auftrag ist noch ungeklärt. Zuerst prüfen.');
  db.prepare('DELETE FROM npc_draft WHERE campaign_id=? AND id=?').run(cam, id);
}

export function executeNpc(db: any, c: NpcCommand, guard: () => void): NpcView {
  return db
    .transaction(() => {
      guard();
      if (typeof c.commandId !== 'string' || !c.commandId || c.commandId.length > 1000)
        throw new Error('NPC-Auftragskennung fehlt.');
      const cam = c.campaignId,
        fp = npcFingerprint(c),
        prior = npcReceipt(db, c);
      if (prior) return prior;
      const held = npcDraft(db, cam, c.npc.id);
      if (held?.pendingCommand && npcFingerprint(held.pendingCommand) !== fp)
        throw new Error('NPC-Auftrag weicht vom gesicherten Original ab.');
      if (c.draftWriteId !== undefined && npcDraft(db, cam, c.npc.id)?.writeId !== c.draftWriteId)
        throw new Error('NPC-Entwurf inzwischen geändert.');
      const v = c.npc,
        old = c.expectedNoteRevision === null ? null : readNpc(db, cam, v.id);
      if (
        (c.expectedNoteRevision === null &&
          db.prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?').get(cam, v.id)) ||
        (old &&
          (old.noteRevision !== c.expectedNoteRevision ||
            old.record.revision !== c.expectedRecordRevision ||
            old.actorRevision !== c.expectedActorRevision ||
            old.positionRevision !== c.expectedPositionRevision))
      )
        throw new Error('NPC, Notizen, Gesundheit oder Position inzwischen geändert. Neu öffnen.');
      const r = checkedNpcRecord(v.record),
        calendar = readWorldCalendar(db, cam);
      checkedNpcSchedule(
        r.dailyPlan ?? [],
        r.dailyOverrides ?? [],
        calendar.daySeconds,
        calendar.weekdays.length,
      );
      if (r.id !== v.id || r.revision !== c.expectedRecordRevision)
        throw new Error('NPC-Profil gehört zu einem anderen Ausgangsstand.');
      for (const id of npcPlanLocationIds(r)) {
        const target = db
          .prepare('SELECT trashed FROM location WHERE campaign_id=? AND id=?')
          .get(cam, id);
        if (!target || (target.trashed && !npcPlanLocationIds(old?.record ?? {}).includes(id)))
          throw new Error('Tagesplanziel nicht verfügbar.');
      }
      if (
        r.factionId &&
        !db
          .prepare(
            "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0 AND json_extract(payload,'$.kind')='faction'",
          )
          .get(cam, r.factionId)
      )
        throw new Error('Fraktion nicht verfügbar.');
      if (
        v.locationId &&
        !db
          .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
          .get(cam, v.locationId)
      )
        throw new Error('Ort nicht verfügbar.');
      if (
        old?.actorRevision !== null &&
        old?.actorRevision !== undefined &&
        old.creatureId !== v.creatureId
      )
        throw new Error(
          'Die Kreaturreferenz einer materialisierten Figur bleibt erhalten. Lege eine andere Figur an.',
        );
      const oldNote = old ? note(db, cam, v.id) : null,
        n = worldNoteDocument({
          version: 1,
          id: campaignLocalId(v.id),
          revision: (oldNote?.revision ?? 0) + 1,
          kind: 'npc',
          title: v.name,
          readAloud: v.readAloud,
          gmNotes: v.gmNotes,
          relations: oldNote?.relations ?? [],
          creatureId: v.creatureId,
          deleted: false,
        });
      if ([n.title, n.readAloud, n.gmNotes].some((s) => s.length > 2000000))
        throw new Error('NPC-Text zu groß.');
      const payload = JSON.stringify(n);
      db.prepare(
        'INSERT INTO world_note VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, n.id, n.revision, payload, hash(payload));
      db.prepare('DELETE FROM note_search WHERE campaign_id=? AND note_id=?').run(cam, n.id);
      db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(
        cam,
        n.id,
        n.title,
        n.readAloud + '\n' + n.gmNotes,
      );
      if (old?.actorRevision !== null && old?.actorRevision !== undefined && v.health === null)
        throw new Error(
          'Bestehende NPC-Gesundheit benötigt vollständige HP. Der Entwurf bleibt erhalten.',
        );
      if (v.creatureId) {
        const creature = readCreature(v.creatureId),
          health = checkedHealth(
            v.health ?? {
              hp: creature.hp,
              maxHp: creature.hp,
              tempHp: 0,
              conditions: '',
              concentrating: false,
            },
          );
        if (old?.actorRevision !== null && old?.actorRevision !== undefined)
          writeWorldActorHealth(db, cam, v.id, old.actorRevision, health);
        else {
          const actor = {
              id: v.id,
              name: v.name,
              creatureId: v.creatureId,
              revision: 1,
              ...health,
              unavailable: false,
              entryId: randomUUID(),
            },
            p = JSON.stringify(actor);
          db.prepare('INSERT INTO world_actor VALUES(?,?,1,?,?)').run(cam, v.id, p, hash(p));
        }
        syncOpenMaskHealth(
          db,
          cam,
          undefined,
          old && old.name !== n.title
            ? new Map([[v.id, { before: old.name, after: n.title }]])
            : undefined,
        );
      }
      const next = { ...r, revision: (old?.record.revision ?? 0) + 1 },
        rp = JSON.stringify(next);
      db.prepare(
        'INSERT INTO npc_record VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET faction_id=excluded.faction_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, v.id, next.factionId, next.revision, rp, hash(rp));
      if ((old?.locationId ?? null) !== v.locationId)
        placeNpc(db, cam, v.id, v.locationId, c.expectedPositionRevision);
      const result = readNpc(db, cam, v.id),
        body = JSON.stringify(result),
        history = JSON.stringify({
          text: 'NPC-Weltprofil aktualisiert: ' + result.name,
          recordedAt: new Date().toISOString(),
          facts: { before: old, after: result },
        });
      db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
        cam,
        randomUUID(),
        null,
        history,
        hash(history),
      );
      db.prepare('INSERT INTO npc_receipt VALUES(?,?,?,?,?)').run(
        c.commandId,
        cam,
        fp,
        body,
        hash(body),
      );
      if (c.draftWriteId !== undefined && !held?.pendingCommand)
        discardNpcDraft(db, cam, v.id, c.draftWriteId);
      return result;
    })
    .immediate();
}

// Resolve the original write and its raw draft in one writer transaction.
// Rotating the draft ID fences a late, previously undelivered command.
export function reconcileNpc(db: any, c: NpcCommand, guard: () => void): NpcResolution {
  return db
    .transaction(() => {
      guard();
      if (!c?.commandId || !c.draftWriteId || !c.npc?.id)
        throw new Error('Originaler NPC-Auftrag fehlt.');
      const value = npcReceipt(db, c),
        d = npcDraft(db, c.campaignId, c.npc.id);
      if (!d) {
        if (value) return { outcome: 'applied' as const, value };
        throw new Error('Originaler NPC-Entwurf fehlt. Ausgang nicht bestätigt.');
      }
      if (
        !value &&
        !d.pendingCommand &&
        d.rejectedCommand &&
        npcFingerprint(d.rejectedCommand) === npcFingerprint(c)
      )
        return { outcome: 'not-applied' as const, draft: d };
      if (
        d.writeId !== c.draftWriteId ||
        !d.pendingCommand ||
        npcFingerprint(d.pendingCommand) !== npcFingerprint(c)
      )
        throw new Error(
          'NPC-Entwurf inzwischen geändert. Originalauftrag nicht auf fremde Eingaben anwenden.',
        );
      if (value) {
        db.prepare('DELETE FROM npc_draft WHERE campaign_id=? AND id=?').run(c.campaignId, d.id);
        return { outcome: 'applied' as const, value };
      }
      const next = { ...d, writeId: randomUUID(), rejectedCommand: c };
      delete next.pendingCommand;
      const payload = JSON.stringify(next);
      db.prepare('UPDATE npc_draft SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
        payload,
        hash(payload),
        c.campaignId,
        d.id,
      );
      return { outcome: 'not-applied' as const, draft: next };
    })
    .immediate();
}

export function validateNpcRecovery(db: any) {
  for (const row of db.prepare('SELECT campaign_id,id FROM npc_draft').iterate()) {
    const d = npcDraft(db, row.campaign_id, row.id)!;
    if (d.pendingCommand) npcReceipt(db, d.pendingCommand);
  }
}
