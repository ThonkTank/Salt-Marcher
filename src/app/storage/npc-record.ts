import { createHash } from 'node:crypto';
import type { NpcRecord, NpcRole, NpcView, NpcDraft } from '../npc-contracts';
import { checkedDailyPlan, checkedDailyOverrides, npcPlanLocationIds } from '../npc-daily-plan';
import { checkedHealth } from '../progression';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installNpcRecords(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS npc_record(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,faction_id TEXT,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,id) REFERENCES world_note(campaign_id,id),FOREIGN KEY(campaign_id,faction_id) REFERENCES world_note(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS npc_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS npc_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);
}
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const identity = (v: any) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
const revision = (v: any) => Number.isSafeInteger(v) && v >= 0;
const reference = (v: any) => v === null || identity(v);
export function checkedNpcRecord(r: NpcRecord): NpcRecord {
  const d = r?.demographics ?? { ancestry: '', gender: '', ageYears: null };
  if (
    !object(r) ||
    !identity(r.id) ||
    !revision(r.revision) ||
    !reference(r.factionId) ||
    !Number.isSafeInteger(r.modifier) ||
    Math.abs(r.modifier) > 100 ||
    !['active', 'defeated'].includes(r.lifecycle) ||
    [r.appearance, r.behavior, r.history].some(
      (s) => typeof s !== 'string' || s.length > 2000000,
    ) ||
    !object(d) ||
    [d.ancestry, d.gender].some((s) => typeof s !== 'string' || s.length > 1000) ||
    !(
      d.ageYears === null ||
      (Number.isSafeInteger(d.ageYears) && d.ageYears >= 0 && d.ageYears <= 2000)
    )
  )
    throw new Error('NPC-Weltprofil prüfen.');
  if (r.dailyPlan !== undefined) checkedDailyPlan(r.dailyPlan);
  if (r.dailyOverrides !== undefined) checkedDailyOverrides(r.dailyOverrides);
  return { ...r, demographics: { ancestry: d.ancestry, gender: d.gender, ageYears: d.ageYears } };
}
export function checkedNpcView(v: NpcView): NpcView {
  if (
    !object(v) ||
    !identity(v.id) ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    !revision(v.noteRevision) ||
    v.noteRevision < 1 ||
    !reference(v.creatureId) ||
    !reference(v.locationId) ||
    !(v.positionRevision === null || (revision(v.positionRevision) && v.positionRevision > 0)) ||
    !(v.actorRevision === null || (revision(v.actorRevision) && v.actorRevision > 0)) ||
    [v.readAloud, v.gmNotes].some((s) => typeof s !== 'string' || s.length > 2000000) ||
    !Number.isSafeInteger(v.disposition) ||
    Math.abs(v.disposition) > 100 ||
    v.role !== (v.disposition > 0 ? 'friendly' : v.disposition < 0 ? 'hostile' : 'neutral')
  )
    throw new Error('NPC-Stand beschädigt.');
  const record = checkedNpcRecord(v.record);
  if (
    record.id !== v.id ||
    (v.actorRevision === null) !== (v.health === null) ||
    (v.actorRevision !== null && !v.creatureId)
  )
    throw new Error('NPC-Stand gehört zu einer anderen Figur.');
  if (v.health !== null) checkedHealth(v.health);
  return { ...v, record };
}
export function checkedNpcDraft(d: NpcDraft): NpcDraft {
  if (
    !object(d) ||
    !identity(d.id) ||
    !identity(d.writeId) ||
    typeof d.concentrating !== 'boolean' ||
    !object(d.fields) ||
    Object.values(d.fields).some((v) => typeof v !== 'string') ||
    Buffer.byteLength(
      JSON.stringify({ ...d, pendingCommand: undefined, rejectedCommand: undefined }),
    ) > 4000000 ||
    Buffer.byteLength(JSON.stringify(d)) > 12000000
  )
    throw new Error('NPC-Entwurf prüfen.');
  for (const field of [
    'name',
    'creature',
    'faction',
    'location',
    'modifier',
    'lifecycle',
    'appearance',
    'behavior',
    'history',
    'readAloud',
    'gmNotes',
    'hp',
    'maxHp',
    'tempHp',
    'conditions',
  ])
    if (typeof d.fields[field] !== 'string') throw new Error('NPC-Entwurf hat fehlende Rohfelder.');
  if (d.basis !== null && checkedNpcView(d.basis).id !== d.id)
    throw new Error('NPC-Entwurf gehört zu einer anderen Figur.');
  return d;
}
function belongs(db: any, cam: string, id: string, kind: string) {
  return !!db
    .prepare(
      "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')=?",
    )
    .get(cam, id, kind);
}
function recordRow(db: any, row: any): NpcRecord {
  if (hash(row.payload) !== row.checksum) throw new Error('NPC-Weltprofil beschädigt.');
  const r = checkedNpcRecord(JSON.parse(row.payload));
  if (
    r.id !== row.id ||
    r.revision !== row.revision ||
    r.revision < 1 ||
    r.factionId !== row.faction_id ||
    !belongs(db, row.campaign_id, r.id, 'npc') ||
    (r.factionId && !belongs(db, row.campaign_id, r.factionId, 'faction'))
  )
    throw new Error('NPC-Weltprofil hat ungültige Referenzen.');
  for (const id of npcPlanLocationIds(r))
    if (!db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(row.campaign_id, id))
      throw new Error('Tagesplanziel gehört nicht zur Kampagne.');
  return r;
}
export function npcRecord(db: any, cam: string, id: string): NpcRecord {
  const row = db.prepare("SELECT 1 FROM sqlite_schema WHERE name='npc_record'").get()
    ? db.prepare('SELECT * FROM npc_record WHERE campaign_id=? AND id=?').get(cam, id)
    : null;
  if (row) return recordRow(db, row);
  return {
    id,
    revision: 0,
    factionId: null,
    modifier: db.prepare('SELECT 1 FROM world_actor WHERE campaign_id=? AND id=?').get(cam, id)
      ? -1
      : 0,
    lifecycle: 'active',
    appearance: '',
    behavior: '',
    history: '',
    demographics: { ancestry: '', gender: '', ageYears: null },
  };
}
export function readNpcDraftRow(db: any, row: any): NpcDraft {
  if (hash(row.payload) !== row.checksum) throw new Error('NPC-Entwurf beschädigt.');
  const d = checkedNpcDraft(JSON.parse(row.payload)),
    cam = row.campaign_id;
  if (d.id !== row.id) throw new Error('NPC-Entwurf gehört zu einer anderen Figur.');
  if (d.basis) {
    const n = db
        .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, d.id),
      a = db
        .prepare('SELECT revision FROM world_actor WHERE campaign_id=? AND id=?')
        .get(cam, d.id),
      p = db
        .prepare('SELECT revision FROM npc_position WHERE campaign_id=? AND actor_id=?')
        .get(cam, d.id);
    if (
      !belongs(db, cam, d.id, 'npc') ||
      d.basis.noteRevision > n.revision ||
      d.basis.record.revision > npcRecord(db, cam, d.id).revision ||
      (d.basis.actorRevision !== null && (!a || d.basis.actorRevision > a.revision)) ||
      (d.basis.positionRevision !== null && (!p || d.basis.positionRevision > p.revision))
    )
      throw new Error('NPC-Entwurf hat einen ungültigen Ausgangsstand.');
  }
  for (const id of [d.fields.faction, d.basis?.record.factionId])
    if (id && !belongs(db, cam, id, 'faction'))
      throw new Error('NPC-Fraktion gehört nicht zur Kampagne.');
  for (const id of [d.fields.location, d.basis?.locationId])
    if (id && !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, id))
      throw new Error('NPC-Ort gehört nicht zur Kampagne.');
  for (const field of ['dailyPlan', 'dailyOverrides']) {
    let raw: any;
    try {
      raw = JSON.parse(d.fields[field] || '[]');
    } catch {
      continue;
    }
    if (!Array.isArray(raw)) continue;
    for (const s of field === 'dailyPlan'
      ? raw
      : raw.flatMap((o) => (Array.isArray(o?.slots) ? o.slots : [])))
      if (
        s?.place === 'location' &&
        typeof s.locationId === 'string' &&
        s.locationId &&
        !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, s.locationId)
      )
        throw new Error('Tagesplanziel im Entwurf gehört nicht zur Kampagne.');
  }
  return d;
}
export function validateNpcRecords(db: any) {
  const tables = ['npc_record', 'npc_draft', 'npc_receipt'],
    present = tables.filter((name) =>
      db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(name),
    );
  if (!present.length && db.pragma('user_version', { simple: true }) < 43) return;
  if (present.length !== tables.length) throw new Error('NPC-Speicher fehlt.');
  for (const row of db.prepare('SELECT * FROM npc_record').iterate()) recordRow(db, row);
  for (const row of db.prepare('SELECT * FROM npc_draft').iterate()) readNpcDraftRow(db, row);
  for (const row of db.prepare('SELECT * FROM npc_receipt').iterate()) {
    if (hash(row.payload) !== row.checksum) throw new Error('NPC-Auftragsbeleg beschädigt.');
    const v = checkedNpcView(JSON.parse(row.payload));
    if (!belongs(db, row.campaign_id, v.id, 'npc'))
      throw new Error('NPC-Auftragsbeleg gehört nicht zur Kampagne.');
  }
}
export function npcDisposition(
  db: any,
  cam: string,
  record: NpcRecord,
): { disposition: number; role: NpcRole } {
  let base = 0;
  if (
    record.factionId &&
    db
      .prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0')
      .get(cam, record.factionId)
  ) {
    const row = db
      .prepare(
        "SELECT payload,checksum FROM world_source WHERE campaign_id=? AND kind='faction' AND id=?",
      )
      .get(cam, record.factionId);
    if (row) {
      if (hash(row.payload) !== row.checksum) throw new Error('Fraktionsquelle beschädigt.');
      base = JSON.parse(row.payload).disposition ?? 0;
      if (!Number.isSafeInteger(base) || Math.abs(base) > 100)
        throw new Error('Fraktionshaltung beschädigt.');
    }
  }
  const disposition = Math.max(-100, Math.min(100, base + record.modifier));
  return {
    disposition,
    role: disposition > 0 ? 'friendly' : disposition < 0 ? 'hostile' : 'neutral',
  };
}
