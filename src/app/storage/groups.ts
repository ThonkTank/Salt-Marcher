import type { PreparedGroup, WorldActor } from '../session-contracts';
import type { EncounterEntry } from '../encounter-contracts';
import { createHash, randomUUID } from 'node:crypto';
import type { GroupAction, GroupDraft, GroupView } from '../groups-contracts';
import { checkedHealth } from '../progression';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { worldNoteDocument } from '../../features/world/world-notes';
import {
  readPreparedGroup,
  checkedPreparedGroupRow,
  readWorldActor,
  writeWorldActorHealth,
  saveGroup,
  newGroup,
  materialize,
} from './session';
import { readCreature, readEncounterPlan, creatureInfo } from './encounters';
import { placeNpcGroup, npcPosition, npcPositionReader } from './npc-world';
import { event } from './progression';
import { syncOpenMaskHealth } from './mask-health';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installGroups(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS group_draft(campaign_id TEXT NOT NULL,group_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,group_id),FOREIGN KEY(campaign_id,group_id) REFERENCES prepared_group(campaign_id,id) ON DELETE CASCADE) STRICT;`,
  );
}
export function groupView(db: any, cam: string, id: string): GroupView {
  const group = readPreparedGroup(db, cam, id),
    row = db
      .prepare('SELECT draft_plan_id FROM prepared_group WHERE campaign_id=? AND id=?')
      .get(cam, id);
  const position = npcPositionReader(db, cam),
    names = new Map<string, string>();
  const placeName = (id: string | null) => {
    if (!id) return 'Ohne Ort';
    if (names.has(id)) return names.get(id)!;
    const row = db
      .prepare('SELECT payload,checksum,trashed FROM location WHERE campaign_id=? AND id=?')
      .get(cam, id);
    if (!row) return 'Ort nicht verfügbar';
    if (hash(row.payload) !== row.checksum) throw new Error('Gruppenort beschädigt.');
    const doc = checkedLocationDocument(JSON.parse(row.payload));
    if (doc.id !== id) throw new Error('Gruppenort falsch zugeordnet.');
    const title = doc.name + (row.trashed ? ' · Papierkorb' : '');
    names.set(id, title);
    return title;
  };
  return {
    ...group,
    locationTitle: group.locationId ? placeName(group.locationId) : 'Ohne gemeinsamen Ort',
    draftPlanId: row.draft_plan_id,
    actors: group.actors.map((a) => {
      const r = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, a.id);
      if (!r || hash(r.payload) !== r.checksum) throw new Error('NPC-Profil beschädigt.');
      const p = worldNoteDocument(JSON.parse(r.payload));
      const at = position(a.id).locationId;
      return {
        ...a,
        locationId: at,
        locationTitle: placeName(at),
        profileRevision: p.revision,
        gmNotes: p.gmNotes,
        readAloud: p.readAloud,
      };
    }),
  };
}
export function preparedGroups(db: any, cam: string, search: string, after: string | null) {
  if (
    typeof search !== 'string' ||
    search.length > 1000 ||
    (after !== null && typeof after !== 'string')
  )
    throw new Error('Gruppensuche ungültig.');
  let title: string | null = null;
  if (after !== null) {
    const anchor = db
      .prepare(
        "SELECT * FROM prepared_group WHERE campaign_id=? AND id=? AND instr(atlas_lower(json_extract(payload,'$.title')),atlas_lower(?))>0",
      )
      .get(cam, after, search);
    if (!anchor) throw new Error('Suchseite veraltet. Suche neu starten.');
    title = checkedPreparedGroupRow(anchor).title;
  }
  const rows = db
    .prepare(
      "SELECT * FROM prepared_group WHERE campaign_id=? AND instr(atlas_lower(json_extract(payload,'$.title')),atlas_lower(?))>0 AND (? IS NULL OR json_extract(payload,'$.title') COLLATE NOCASE > ? OR (json_extract(payload,'$.title') COLLATE NOCASE = ? AND id>?)) ORDER BY json_extract(payload,'$.title') COLLATE NOCASE,id LIMIT 26",
    )
    .all(cam, search, after, title, title, after);
  return {
    items: rows.slice(0, 25).map((r: any) => {
      const g = checkedPreparedGroupRow(r);
      return { id: g.id, title: g.title, locationId: g.locationId, count: g.actors.length };
    }),
    next: rows.length > 25 ? rows[24].id : null,
  };
}
function checkDraft(d: GroupDraft): GroupDraft {
  const text = (v: unknown, n = 1000) => typeof v === 'string' && v.length <= n,
    id = (v: unknown) => text(v) && !!(v as string).trim();
  if (
    !d ||
    !id(d.writeId) ||
    !id(d.groupId) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1 ||
    !text(d.title) ||
    !text(d.notes, 2000000) ||
    (d.locationId !== null && !id(d.locationId)) ||
    !Array.isArray(d.actors) ||
    d.actors.length > 200 ||
    d.actors.some(
      (a) =>
        !a ||
        (a.id !== null && !id(a.id)) ||
        !id(a.creatureId) ||
        !text(a.name) ||
        !text(a.hp) ||
        !text(a.maxHp) ||
        !text(a.tempHp) ||
        !text(a.conditions, 4000) ||
        !text(a.gmNotes, 2000000) ||
        !text(a.readAloud, 2000000) ||
        typeof a.concentrating !== 'boolean' ||
        !Number.isSafeInteger(a.revision) ||
        !Number.isSafeInteger(a.profileRevision) ||
        (a.id === null
          ? a.revision !== 0 || a.profileRevision !== 0
          : a.revision < 1 || a.profileRevision < 1),
    ) ||
    Buffer.byteLength(JSON.stringify(d)) > 4000000
  )
    throw new Error('Gruppenentwurf ungültig oder zu groß.');
  return d;
}
function validateDraft(db: any, cam: string, d: GroupDraft) {
  const g = readPreparedGroup(db, cam, d.groupId);
  if (d.revision > g.revision) throw new Error('Gruppenentwurf aus neuerem Stand.');
  if (
    d.locationId !== null &&
    !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, d.locationId)
  )
    throw new Error('Gruppenentwurfsort gehört nicht zur Kampagne.');
  const seen = new Set<string>();
  for (const row of d.actors) {
    if (row.id === null) {
      readCreature(row.creatureId);
      continue;
    }
    const actor = readWorldActor(db, cam, row.id),
      profile = db
        .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, row.id);
    if (
      seen.has(row.id) ||
      actor.creatureId !== row.creatureId ||
      row.revision > actor.revision ||
      row.profileRevision > profile.revision ||
      (d.revision === g.revision && !g.actors.some((a) => a.id === row.id))
    )
      throw new Error('Gruppenentwurfsfigur falsch zugeordnet oder aus neuerem Stand.');
    seen.add(row.id);
  }
}
function checkedDraftRow(db: any, row: any): GroupDraft {
  if (hash(row.payload) !== row.checksum) throw new Error('Gruppenentwurf beschädigt.');
  const d = checkDraft(JSON.parse(row.payload));
  if (d.groupId !== row.group_id) throw new Error('Gruppenentwurf falsch zugeordnet.');
  validateDraft(db, row.campaign_id, d);
  return d;
}
export function groupDraft(db: any, cam: string, id: string): GroupDraft | null {
  readPreparedGroup(db, cam, id);
  const row = db
    .prepare('SELECT * FROM group_draft WHERE campaign_id=? AND group_id=?')
    .get(cam, id);
  return row ? checkedDraftRow(db, row) : null;
}
export function validateGroups(db: any) {
  for (const row of db.prepare('SELECT campaign_id,id FROM prepared_group').iterate())
    readPreparedGroup(db, row.campaign_id, row.id);
  for (const row of db.prepare('SELECT campaign_id,id FROM world_actor').iterate())
    readWorldActor(db, row.campaign_id, row.id);
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='group_draft'").get()) {
    if (db.pragma('user_version', { simple: true }) < 40) return;
    throw new Error('Gruppenentwurfsspeicher fehlt.');
  }
  for (const row of db.prepare('SELECT * FROM group_draft').iterate()) checkedDraftRow(db, row);
}
export function keepGroupDraft(db: any, cam: string, d: GroupDraft, expected: string | null) {
  return db
    .transaction(() => {
      checkDraft(d);
      validateDraft(db, cam, d);
      const old = groupDraft(db, cam, d.groupId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if ((old?.writeId ?? null) !== expected)
        throw new Error('Gruppenentwurf inzwischen geändert.');
      db.prepare(
        'INSERT INTO group_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,group_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.groupId, payload, hash(payload));
    })
    .immediate();
}
export function discardGroupDraft(db: any, cam: string, id: string, writeId: string) {
  return db
    .transaction(() => {
      const d = groupDraft(db, cam, id);
      if (d?.writeId !== writeId) throw new Error('Gruppenentwurf inzwischen geändert.');
      db.prepare('DELETE FROM group_draft WHERE campaign_id=? AND group_id=?').run(cam, id);
    })
    .immediate();
}
export function editGroup(db: any, cam: string, a: GroupAction): string {
  if (a.kind === 'group-create') {
    if (typeof a.title !== 'string' || a.title.length > 1000 || !a.title.trim())
      throw new Error('Gruppenname fehlt.');
    let source;
    if (a.encounterId) {
      source = readEncounterPlan(db, cam, a.encounterId);
      if (source.revision !== a.expectedEncounterRevision) throw new Error('Vorlage geändert.');
      if (source.entries.reduce((n, e) => n + e.count, 0) > 200)
        throw new Error('Bitte eine Vorlage mit höchstens 200 Figuren wählen.');
    } else
      source = {
        id: '',
        revision: 0,
        name: a.title,
        notes: '',
        party: [],
        entries: [],
        sources: [],
        catalogHash: creatureInfo().hash,
      };
    const g = newGroup(db, cam, source, null, null);
    g.title = a.title;
    materialize(db, cam, g);
    saveGroup(db, cam, g, null, null);
    event(db, cam, null, 'group-created', { groupId: g.id, after: g });
    return g.id;
  }
  const d = a.draft;
  checkDraft(d);
  const g = readPreparedGroup(db, cam, a.groupId),
    old = groupDraft(db, cam, g.id);
  if (
    d.groupId !== g.id ||
    g.revision !== a.expectedRevision ||
    d.revision !== g.revision ||
    !old ||
    old.writeId !== d.writeId ||
    JSON.stringify(old) !== JSON.stringify(d)
  )
    throw new Error('Gruppe oder Eingabe inzwischen geändert. Gespeicherten Stand laden.');
  if (!d.title.trim()) throw new Error('Gruppenname fehlt.');
  if (
    d.locationId &&
    !db
      .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
      .get(cam, d.locationId)
  )
    throw new Error('Ort nicht verfügbar.');
  const before = structuredClone(g),
    ids = new Set<string>(),
    actors: WorldActor[] = [],
    sources = [...g.plan.sources],
    entries: EncounterEntry[] = [],
    renames = new Map<string, { before: string; after: string }>();
  for (const row of d.actors) {
    if (!row.name.trim()) throw new Error('Jede Figur benötigt einen Namen.');
    const number = (v: string) => {
      if (!/^(0|[1-9][0-9]{0,6})$/.test(v.trim())) throw new Error('HP benötigen ganze Zahlen.');
      return Number(v);
    };
    const health = checkedHealth({
      hp: number(row.hp),
      maxHp: number(row.maxHp),
      tempHp: number(row.tempHp),
      conditions: row.conditions,
      concentrating: row.concentrating,
    });
    let actor: WorldActor;
    if (row.id) {
      if (ids.has(row.id) || !g.actors.some((x) => x.id === row.id))
        throw new Error('Figur gehört nicht eindeutig zur Gruppe.');
      ids.add(row.id);
      actor = readWorldActor(db, cam, row.id);
      if (
        actor.creatureId !== row.creatureId ||
        actor.revision !== row.revision ||
        actor.unavailable
      )
        throw new Error('Figur inzwischen geändert oder im Papierkorb.');
    } else {
      const creature = readCreature(row.creatureId);
      if (!sources.some((c) => c.id === creature.id)) sources.push(creature);
      const entry = { id: randomUUID(), creatureId: creature.id, count: 1, grouped: false },
        temp: PreparedGroup = {
          ...g,
          title: d.title,
          notes: d.notes,
          plan: { ...g.plan, entries: [entry], sources: [creature] },
          actors: [],
        };
      materialize(db, cam, temp);
      actor = temp.actors[0]!;
    }
    const profile = db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(cam, actor.id);
    if (hash(profile.payload) !== profile.checksum) throw new Error('NPC-Profil beschädigt.');
    const note = worldNoteDocument(JSON.parse(profile.payload));
    if (row.id && note.revision !== row.profileRevision)
      throw new Error('NPC-Notizen inzwischen geändert.');
    if (note.title !== row.name) renames.set(actor.id, { before: note.title, after: row.name });
    if (
      note.title !== row.name ||
      note.gmNotes !== row.gmNotes ||
      note.readAloud !== row.readAloud
    ) {
      const next = worldNoteDocument({
          ...note,
          title: row.name,
          gmNotes: row.gmNotes,
          readAloud: row.readAloud,
          revision: note.revision + 1,
        }),
        payload = JSON.stringify(next);
      db.prepare(
        'UPDATE world_note SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
      ).run(next.revision, payload, hash(payload), cam, actor.id);
      db.prepare('UPDATE note_search SET title=?,body=? WHERE campaign_id=? AND note_id=?').run(
        next.title,
        next.readAloud + '\n' + next.gmNotes,
        cam,
        actor.id,
      );
    }
    if (
      JSON.stringify({
        hp: actor.hp,
        maxHp: actor.maxHp,
        tempHp: actor.tempHp,
        conditions: actor.conditions,
        concentrating: actor.concentrating,
      }) !== JSON.stringify(health)
    )
      actor = writeWorldActorHealth(db, cam, actor.id, actor.revision, health);
    actor = {
      ...actor,
      entryId: g.actors.find((a) => a.id === actor.id)?.entryId ?? actor.entryId,
      name: row.name,
    };
    actors.push(actor);
    let entry = entries.find((e) => e.id === actor.entryId);
    if (entry) {
      entry.count++;
      if (g.plan.entries.some((e) => e.worldActorIds?.includes(actor.id))) {
        (entry.worldActorIds ??= []).push(actor.id);
        (entry.actorNames ??= []).push(actor.name);
      }
    } else
      entries.push({
        id: actor.entryId,
        creatureId: actor.creatureId,
        count: 1,
        grouped: g.plan.entries.find((e) => e.id === actor.entryId)?.grouped ?? false,
        ...(g.plan.entries.find((e) => e.id === actor.entryId)?.allowAnonymous
          ? { allowAnonymous: true }
          : {}),
        ...(g.plan.entries.some((e) => e.worldActorIds?.includes(actor.id))
          ? { worldActorIds: [actor.id], actorNames: [actor.name] }
          : {}),
      });
  }
  g.actors = actors;
  g.title = d.title;
  g.notes = d.notes;
  g.locationId = d.locationId;
  g.plan = {
    ...g.plan,
    name: d.title,
    notes: d.notes,
    entries,
    sources: sources.filter((c) => entries.some((e) => e.creatureId === c.id)),
  };
  g.revision++;
  // Explicitly accepting this group makes it independent of any old planning draft.
  saveGroup(db, cam, g, null, null);
  const previousIds = new Set(before.actors.map((a) => a.id));
  const relocated =
    before.locationId !== d.locationId
      ? actors
      : actors.filter((a) => d.locationId !== null && !previousIds.has(a.id));
  if (d.locationId)
    placeNpcGroup(
      db,
      cam,
      relocated.map((a) => a.id),
      d.locationId,
    );
  else
    for (const actor of relocated) {
      const pos = npcPosition(db, cam, actor.id);
      if (pos.locationId === null && pos.revision !== null && !pos.dungeon) continue;
      db.prepare('DELETE FROM npc_dungeon_position WHERE campaign_id=? AND actor_id=?').run(
        cam,
        actor.id,
      );
      db.prepare(
        'INSERT INTO npc_position VALUES(?,?,?,?) ON CONFLICT(campaign_id,actor_id) DO UPDATE SET location_id=excluded.location_id,revision=excluded.revision',
      ).run(cam, actor.id, null, (pos.revision ?? 0) + 1);
    }
  syncOpenMaskHealth(db, cam, undefined, renames);
  db.prepare('DELETE FROM group_draft WHERE campaign_id=? AND group_id=?').run(cam, g.id);
  event(db, cam, null, 'group-edited', { groupId: g.id, before, after: g });
  return g.id;
}
