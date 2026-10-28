import { treasureAnchor, treasureAnchorLabel } from './treasure-anchors';
import { createHash, randomUUID } from 'node:crypto';
import type { TreasuryDraft, TreasuryAction } from '../runtime/treasury-contracts';
import type { TreasureOrigin } from '../runtime/treasure-origin-contracts';
import type { Treasure } from '../runtime/treasure-contracts';
import {
  readTreasure,
  checkedTreasureRow,
  saveTreasure,
  checkedItem,
  event,
} from './progression-records';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installTreasury(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS treasury_draft(campaign_id TEXT NOT NULL,treasure_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,treasure_id),FOREIGN KEY(campaign_id,treasure_id) REFERENCES treasure(campaign_id,id)) STRICT;`,
  );
}
function checkedDraft(d: TreasuryDraft): TreasuryDraft {
  const text = (v: unknown, n = 1000) => typeof v === 'string' && v.length <= n;
  const id = (v: unknown) => text(v) && !!(v as string).trim();
  if (
    !d ||
    !id(d.writeId) ||
    !id(d.treasureId) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1 ||
    !text(d.title) ||
    (d.locationId !== null && !id(d.locationId)) ||
    !text(d.reason, 10000) ||
    !Array.isArray(d.items) ||
    d.items.length > 100 ||
    d.items.some(
      (i) =>
        !i ||
        !text(i.name) ||
        !text(i.quantity) ||
        !text(i.valueGold) ||
        !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(i.category) ||
        (i.lotId !== undefined && i.lotId !== null && !id(i.lotId)) ||
        (i.reference !== undefined &&
          (!i.reference ||
            i.reference.kind !== 'authored' ||
            !id(i.reference.definitionId) ||
            !Number.isSafeInteger(i.reference.revision) ||
            i.reference.revision < 1 ||
            (i.reference.historicalDefinitionId !== undefined &&
              !id(i.reference.historicalDefinitionId)))),
    ) ||
    Buffer.byteLength(JSON.stringify(d)) > 256000
  )
    throw new Error('Schatzentwurf ungültig oder zu groß.');
  return d;
}
function validateDraft(db: any, cam: string, d: TreasuryDraft) {
  const t = checkedTreasureRow(
    db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, d.treasureId),
  );
  if (d.revision > t.revision) throw new Error('Schatzentwurf aus neuerem Stand.');
  // Archived owners remain valid for unfinished input; applying uses current availability.
  if (
    d.locationId !== null &&
    !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, d.locationId)
  )
    throw new Error('Schatzentwurfsort gehört nicht zur Kampagne.');
  for (const item of d.items)
    if (
      item.reference &&
      !db
        .prepare(
          'SELECT 1 FROM item_definition WHERE id=? UNION ALL SELECT 1 FROM authored_item WHERE id=?',
        )
        .get(item.reference.definitionId, item.reference.definitionId)
    )
      throw new Error('Schatzentwurfsgegenstand fehlt.');
}
function checkedRow(db: any, row: any): TreasuryDraft {
  if (hash(row.payload) !== row.checksum) throw new Error('Schatzentwurf beschädigt.');
  const d = checkedDraft(JSON.parse(row.payload));
  if (d.treasureId !== row.treasure_id) throw new Error('Schatzentwurf falsch zugeordnet.');
  validateDraft(db, row.campaign_id, d);
  return d;
}
function draft(db: any, cam: string, id: string): TreasuryDraft | null {
  const row = db
    .prepare('SELECT * FROM treasury_draft WHERE campaign_id=? AND treasure_id=?')
    .get(cam, id);
  return row ? checkedRow(db, row) : null;
}
export function validateTreasuryDrafts(db: any) {
  if (
    !db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='treasury_draft'").get()
  ) {
    if (db.pragma('user_version', { simple: true }) < 39) return;
    throw new Error('Schatzentwurfsspeicher fehlt.');
  }
  for (const row of db.prepare('SELECT * FROM treasury_draft').iterate()) checkedRow(db, row);
}
export function readTreasuryDraft(db: any, cam: string, id: string) {
  readTreasure(db, cam, id);
  return draft(db, cam, id);
}
export function keepTreasuryDraft(db: any, cam: string, d: TreasuryDraft, expected: string | null) {
  return db
    .transaction(() => {
      checkedDraft(d);
      validateDraft(db, cam, d);
      const old = draft(db, cam, d.treasureId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if ((old?.writeId ?? null) !== expected)
        throw new Error('Schatzentwurf inzwischen geändert.');
      db.prepare(
        'INSERT INTO treasury_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,treasure_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.treasureId, payload, hash(payload));
    })
    .immediate();
}
export function discardTreasuryDraft(db: any, cam: string, id: string, writeId: string) {
  return db
    .transaction(() => {
      const d = draft(db, cam, id);
      if (!d) return;
      if (d.writeId !== writeId) throw new Error('Schatzentwurf inzwischen geändert.');
      db.prepare('DELETE FROM treasury_draft WHERE campaign_id=? AND treasure_id=?').run(cam, id);
    })
    .immediate();
}
function place(db: any, cam: string, id: string | null) {
  if (
    id !== null &&
    (typeof id !== 'string' ||
      !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0').get(cam, id))
  )
    throw new Error('Ort nicht verfügbar.');
}
function origin(t: Treasure, itemId: string): TreasureOrigin {
  return {
    treasureId: t.id,
    itemId,
    combatId: t.combatId,
    sceneId: t.sceneId,
    locationId: t.locationId,
    sourceNoteId: t.sourceNoteId,
    awardId: t.awardId,
  };
}
export function editTreasury(db: any, cam: string, a: TreasuryAction): string {
  if (a.kind === 'treasure-create') {
    place(db, cam, a.locationId);
    if (typeof a.title !== 'string' || !a.title.trim() || a.title.length > 1000)
      throw new Error('Schatz benötigt einen Titel.');
    const t: Treasure = {
      id: randomUUID(),
      revision: 1,
      title: a.title,
      locationId: a.locationId,
      sceneId: null,
      combatId: null,
      items: [],
    };
    saveTreasure(db, cam, t);
    event(db, cam, null, 'treasure-created', { treasure: t });
    return t.id;
  }
  const t = readTreasure(db, cam, a.treasureId),
    before = structuredClone(t);
  if (
    t.revision !== a.expectedRevision ||
    typeof a.reason !== 'string' ||
    !a.reason.trim() ||
    a.reason.length > 10000
  )
    throw new Error('Schatz geändert oder Änderungsgrund fehlt.');
  if (a.kind === 'treasure-anchor') {
    if (draft(db, cam, t.id))
      throw new Error('Offene Schatzangaben zuerst übernehmen oder verwerfen.');
    const anchor = a.anchor;
    if (
      !anchor ||
      !['unplaced', 'scene', 'location'].includes(anchor.kind) ||
      (anchor.kind !== 'unplaced' &&
        (typeof anchor.id !== 'string' || !anchor.id || anchor.id.length > 1000))
    )
      throw new Error('Schatzzuordnung prüfen.');
    const target = treasureAnchorLabel(db, cam, anchor);
    if (anchor.kind !== 'unplaced' && !target.available)
      throw new Error('Zielgruppe oder Zielort nicht verfügbar.');
    // The anchor moves the same instance. Preserve its original award source for future allocations.
    for (const item of t.items) item.origin ??= origin(t, item.id);
    t.sceneId = anchor.kind === 'scene' ? anchor.id : null;
    t.locationId = anchor.kind === 'location' ? anchor.id : null;
    t.revision++;
    saveTreasure(db, cam, t);
    event(db, cam, null, 'treasure-anchored', {
      treasureId: t.id,
      from: treasureAnchor(before),
      to: anchor,
      targetName: target.name,
      before,
      after: t,
      reason: a.reason,
    });
    return t.id;
  }
  if (a.kind === 'treasure-edit') {
    place(db, cam, a.locationId);
    if (
      typeof a.title !== 'string' ||
      !a.title.trim() ||
      a.title.length > 1000 ||
      !Array.isArray(a.items) ||
      a.items.length > 100
    )
      throw new Error('Titel und unverteilte Gegenstände prüfen.');
    const raw = draft(db, cam, t.id);
    if (
      raw
        ? raw.writeId !== a.draftWriteId || raw.revision !== a.expectedRevision
        : a.draftWriteId !== undefined
    )
      throw new Error('Schatzentwurf inzwischen geändert.');
    const seen = new Set<string>(),
      next: Treasure['items'] = t.items
        .filter((i) => i.allocated > 0)
        .map((i) => ({ ...i, quantity: i.allocated }));
    for (const row of a.items) {
      let old = row.lotId ? t.items.find((i) => i.id === row.lotId) : undefined;
      if (row.lotId && (!old || seen.has(row.lotId)))
        throw new Error('Gegenstandslos geändert oder doppelt.');
      if (row.lotId) seen.add(row.lotId);
      if (
        !Number.isSafeInteger(row.item.quantity) ||
        row.item.quantity < 0 ||
        row.item.quantity > 1000000
      )
        throw new Error('Unverteilte Menge prüfen.');
      if (!row.item.quantity) continue;
      const item = checkedItem(db, row.item);
      if (old && row.item.reference?.definitionId === old.reference.definitionId) {
        const kept = next.find((i) => i.id === old!.id);
        if (kept) kept.quantity += item.quantity;
        else next.push({ ...old, quantity: item.quantity, allocated: 0 });
      } else
        next.push({
          ...item,
          ...(old ? { origin: old.origin ?? origin(t, old.id) } : {}),
        });
    }
    t.title = a.title;
    t.locationId = a.locationId;
    t.items = next;
    t.revision++;
    saveTreasure(db, cam, t);
    if (raw) discardTreasuryDraft(db, cam, t.id, raw.writeId);
    event(db, cam, null, 'treasure-edited', {
      treasureId: t.id,
      before,
      after: t,
      reason: a.reason,
    });
    return t.id;
  }
  if (draft(db, cam, t.id))
    throw new Error('Offene Schatzangaben zuerst übernehmen oder verwerfen.');
  const item = t.items.find((i) => i.id === a.itemId);
  if (
    !item ||
    !Number.isSafeInteger(a.quantity) ||
    a.quantity < 1 ||
    a.quantity > item.quantity - item.allocated
  )
    throw new Error('Verfügbare Teilmenge auswählen.');
  let target: Treasure;
  if ('id' in a.target) {
    if (a.target.id === t.id) throw new Error('Anderen Zielschatz auswählen.');
    target = readTreasure(db, cam, a.target.id);
    if (target.revision !== a.target.expectedRevision || draft(db, cam, target.id))
      throw new Error('Zielschatz geändert oder mit offenem Entwurf.');
  } else {
    place(db, cam, a.target.locationId);
    if (
      typeof a.target.title !== 'string' ||
      !a.target.title.trim() ||
      a.target.title.length > 1000
    )
      throw new Error('Neuer Zielschatz benötigt einen Titel.');
    target = {
      id: randomUUID(),
      revision: 0,
      title: a.target.title,
      locationId: a.target.locationId,
      sceneId: null,
      combatId: null,
      items: [],
    };
  }
  if (target.items.filter((i) => i.quantity > i.allocated).length >= 100)
    throw new Error('Zielschatz enthält bereits 100 unverteilte Lose.');
  const targetBefore = structuredClone(target),
    moved = {
      ...item,
      id: randomUUID(),
      quantity: a.quantity,
      allocated: 0,
      origin: item.origin ?? origin(t, item.id),
    };
  delete moved.currentDefinition;
  item.quantity -= a.quantity;
  target.items.push(moved);
  t.revision++;
  target.revision++;
  saveTreasure(db, cam, t);
  saveTreasure(db, cam, target);
  event(db, cam, null, 'treasure-moved', {
    treasureId: t.id,
    targetTreasureId: target.id,
    before,
    after: t,
    targetBefore,
    targetAfter: target,
    quantity: a.quantity,
    itemId: item.id,
    reason: a.reason,
  });
  return target.id;
}
export function treasureHistory(db: any, cam: string, id: string, after: string | null) {
  readTreasure(db, cam, id);
  if (after !== null && !/^[1-9][0-9]{0,15}$/.test(after))
    throw new Error('Verlaufseite ungültig.');
  const rows = db
    .prepare(
      "SELECT rowid cursor,* FROM progress_event WHERE campaign_id=? AND (? IS NULL OR rowid<?) AND (json_extract(payload,'$.treasureId')=? OR json_extract(payload,'$.targetTreasureId')=? OR json_extract(payload,'$.treasure.id')=?) ORDER BY rowid DESC LIMIT 26",
    )
    .all(cam, after, after, id, id, id);
  return {
    items: rows.slice(0, 25).map((r: any) => {
      if (hash(r.payload) !== r.checksum) throw new Error('Schatzverlauf beschädigt.');
      return { id: r.id, kind: r.kind, facts: JSON.parse(r.payload) };
    }),
    next: rows.length > 25 ? String(rows[24].cursor) : null,
  };
}
