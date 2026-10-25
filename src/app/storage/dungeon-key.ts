import { copyKeyPatch, keyCopyDependencies } from '../key-copy-model';
import { validateSurfaceGeometry } from './surfaces';
import { createHash, randomUUID } from 'node:crypto';
import type { KeyContent, KeyAction } from '../key-contracts';
import { emptyKey, validateKeyContent } from '../key-contracts';
import { editKeyText, expandedKeyBlocks, templateBlockId } from '../key-model';
import { validateRoom, type Room } from '../contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installDungeonKey(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS dungeon_key_content(campaign_id TEXT NOT NULL,id TEXT NOT NULL,scope_id TEXT NOT NULL,kind TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS dungeon_key_discovery(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,subject_id TEXT NOT NULL,known INTEGER NOT NULL,PRIMARY KEY(campaign_id,character_id,subject_id)) STRICT;`);
}
export function checkedKeyRow(row: any): KeyContent {
  if (!row || hash(row.payload) !== row.checksum) throw new Error('Dungeon-Key beschädigt.');
  const value = JSON.parse(row.payload);
  validateKeyContent(value);
  if (
    value.id !== row.id ||
    value.scopeId !== row.scope_id ||
    value.kind !== row.kind ||
    value.revision !== row.revision
  )
    throw new Error('Dungeon-Key-Metadaten widersprüchlich.');
  return value;
}
function recordKeyBlocks(owners: Map<string, string>, c: KeyContent) {
  for (const block of c.blocks) {
    if (owners.has(block.id)) throw new Error('Beschreibungsblock ist mehreren Keys zugeordnet.');
    owners.set(block.id, c.id);
  }
}
// Discovery is campaign-wide: a derived template identity must never alias an authored block.
function validateResolvedKeyBlocks(records: KeyContent[]) {
  const authored = new Set(records.flatMap((c) => c.blocks.map((b) => b.id))),
    derived = new Set<string>(),
    templates = new Map(records.filter((c) => c.kind === 'template').map((c) => [c.id, c]));
  for (const c of records)
    for (const link of c.blocks) {
      if (link.kind !== 'template') continue;
      const template = templates.get(link.templateId!);
      if (!template || template.scopeId !== c.scopeId) continue;
      for (const child of template.blocks) {
        const id = templateBlockId(link.id, child.id);
        if (authored.has(id) || derived.has(id))
          throw new Error('Vorlagenabschnitt ist mehreren Beschreibungsblöcken zugeordnet.');
        derived.add(id);
      }
    }
}
export function readDungeonKeys(db: any, cam: string): KeyContent[] {
  const records: KeyContent[] = [],
    owners = new Map<string, string>();
  for (const row of db
    .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? ORDER BY rowid')
    .iterate(cam)) {
    const value = checkedKeyRow(row);
    recordKeyBlocks(owners, value);
    records.push(value);
  }
  validateResolvedKeyBlocks(records);
  return records;
}
export function validateDungeonKeys(db: any) {
  const campaigns = new Map<string, Map<string, string>>(),
    records = new Map<string, KeyContent[]>();
  for (const row of db.prepare('SELECT * FROM dungeon_key_content').iterate()) {
    let owners = campaigns.get(row.campaign_id);
    if (!owners) {
      owners = new Map();
      campaigns.set(row.campaign_id, owners);
    }
    const value = checkedKeyRow(row);
    recordKeyBlocks(owners, value);
    const list = records.get(row.campaign_id) ?? [];
    list.push(value);
    records.set(row.campaign_id, list);
  }
  for (const list of records.values()) validateResolvedKeyBlocks(list);
}
export function validateKeyHistoryRow(row: any) {
  checkedKeyRow(row);
}
export function keyDiscoveries(db: any, cam: string, characters: string[]) {
  if (!characters.length) return new Set<string>();
  const rows = db
    .prepare(
      'SELECT character_id,subject_id FROM dungeon_key_discovery WHERE campaign_id=? AND known=1',
    )
    .all(cam);
  return new Set<string>(
    rows
      .filter((r: any) => characters.some((c) => c === r.character_id))
      .map((r: any) => r.subject_id),
  );
}
function validateKeyReferences(c: KeyContent, records: KeyContent[]) {
  validateKeyContent(c);
  const local = records.filter((r) => r.scopeId === c.scopeId && r.id !== c.id),
    level = c.levelId ? local.find((r) => r.id === c.levelId && r.kind === 'level') : null,
    group = c.groupId ? local.find((r) => r.id === c.groupId && r.kind === 'group') : null;
  if ((c.levelId && !level) || (c.groupId && !group) || (group && group.levelId !== c.levelId))
    throw new Error('Vererbung: Dungeon, optional Level, optional Gruppe, Raum.');
  if (
    c.kind === 'level' &&
    local.some((r) => r.kind === 'level' && r.zSteps.some((z) => c.zSteps.includes(z)))
  )
    throw new Error('Konzeptuelle Level dürfen keine gemeinsamen Höhenschritte besitzen.');
  for (const b of c.blocks)
    if (b.kind === 'template' && !local.some((r) => r.kind === 'template' && r.id === b.templateId))
      throw new Error('Vorlagenverknüpfung prüfen.');
}
interface Owner {
  apply: (key: { table: string; id: string }, value: any) => void;
  room: (id: string) => Room;
  roomRow: (cam: string, r: Room) => any;
}
function row(cam: string, c: KeyContent) {
  const payload = JSON.stringify(c);
  return {
    campaign_id: cam,
    id: c.id,
    scope_id: c.scopeId,
    kind: c.kind,
    revision: c.revision,
    payload,
    checksum: hash(payload),
  };
}
export function executeKeyAction(db: any, cam: string, a: KeyAction, owner: Owner) {
  if (a.kind === 'key-copy') {
    const records = readDungeonKeys(db, cam),
      source = owner.room(a.source.id),
      key = records.find((k) => k.id === source.id && k.kind === 'room');
    if (
      source.revision !== a.source.expectedRevision ||
      (key?.revision ?? null) !== a.source.keyRevision
    )
      throw new Error('Quellraum geändert. Kopiervorschau neu erstellen.');
    if (
      JSON.stringify(keyCopyDependencies(source, records, a.options)) !==
      JSON.stringify(a.dependencies)
    )
      throw new Error('Quellvorlage oder geerbte Werte geändert. Kopiervorschau neu erstellen.');
    if (
      !Array.isArray(a.rooms) ||
      !a.rooms.length ||
      a.rooms.length > 100 ||
      new Set(a.rooms.map((r) => r.id)).size !== a.rooms.length
    )
      throw new Error('1–100 verschiedene Zielräume wählen.');
    const patches = a.rooms.map((guard) => ({
      guard,
      patch: copyKeyPatch(source, owner.room(guard.id), records, a.options, randomUUID),
    }));
    for (const { guard, patch } of patches)
      executeKeyAction(db, cam, { kind: 'key-batch', rooms: [guard], patch }, owner);
    return;
  }
  if (a.kind === 'key-batch' && a.patch.sectionEdits !== undefined) {
    const edits = a.patch.sectionEdits;
    if (
      a.rooms.length !== 1 ||
      !Array.isArray(edits) ||
      edits.length > 10000 ||
      new Set(edits.map((e) => e?.id)).size !== edits.length ||
      edits.some(
        (e) =>
          !e ||
          typeof e.id !== 'string' ||
          !e.id ||
          typeof e.markdown !== 'string' ||
          e.markdown.length > 2000000,
      )
    )
      throw new Error('Ursprüngliche Raumabschnitte einzeln und eindeutig bearbeiten.');
  }
  const records = readDungeonKeys(db, cam),
    blockOwners = new Map(records.flatMap((c) => c.blocks.map((b) => [b.id, c.id] as const))),
    byId = new Map(records.map((c) => [c.id, c])),
    positions = new Map(records.map((c, i) => [c.id, i])),
    numberRows = new Map<string, { id: string; number: string }[]>(),
    numberById = new Map<string, { id: string; number: string }>(),
    roomKey = (id: string) => {
      const c = byId.get(id);
      return c?.kind === 'room' ? c : undefined;
    },
    otherNumbers = (room: Room) => {
      let rows = numberRows.get(room.scopeId);
      if (!rows) {
        rows = db
          .prepare('SELECT id,number FROM room WHERE campaign_id=? AND scope_id=?')
          .all(cam, room.scopeId) as { id: string; number: string }[];
        numberRows.set(room.scopeId, rows);
        for (const row of rows) numberById.set(row.id, row);
      }
      return rows.filter((r) => r.id !== room.id);
    },
    save = (c: KeyContent, expected: number | null) => {
      const old = byId.get(c.id);
      if (old && (old.kind !== c.kind || old.scopeId !== c.scopeId))
        throw new Error('Inhaltsidentität gehört zu einem anderen Keybereich.');
      if ((old?.revision ?? null) !== expected) throw new Error('Dungeon-Key geändert.');
      validateKeyReferences(c, records);
      validateSurfaceGeometry(db, cam, c);
      for (const b of c.blocks) {
        const ownerId = blockOwners.get(b.id);
        if (ownerId !== undefined && ownerId !== c.id)
          throw new Error('Beschreibungsblock ist mehreren Keys zugeordnet.');
      }
      if (c.kind === 'room' && owner.room(c.id).scopeId !== c.scopeId)
        throw new Error('Key gehört zu einer anderen Zeichnung.');
      if (c.kind === 'dungeon' && c.id !== c.scopeId)
        throw new Error('Dungeonwerte gehören zur Zeichnung.');
      owner.apply({ table: 'dungeon_key_content', id: c.id }, row(cam, c));
      const at = positions.get(c.id);
      if (at !== undefined) records[at] = c;
      else {
        positions.set(c.id, records.length);
        records.push(c);
      }
      for (const b of old?.blocks ?? []) blockOwners.delete(b.id);
      for (const b of c.blocks) blockOwners.set(b.id, c.id);
      byId.set(c.id, c);
    };
  if (a.kind === 'key-content') {
    const old = byId.get(a.content.id);
    save(a.content, a.expectedRevision);
    if (a.content.kind === 'group' && old?.levelId !== a.content.levelId) {
      const children = records
        .filter((r) => r.kind === 'room' && r.groupId === a.content.id)
        .map((r) => ({
          id: r.id,
          expectedRevision: owner.room(r.id).revision,
          keyRevision: r.revision,
        }));
      if (children.length)
        executeKeyAction(
          db,
          cam,
          { kind: 'key-batch', rooms: children, patch: { levelId: a.content.levelId } },
          owner,
        );
    }
    validateResolvedKeyBlocks(records);
    return;
  }
  if (!a.rooms.length || new Set(a.rooms.map((r) => r.id)).size !== a.rooms.length)
    throw new Error('Mindestens einen Raum auswählen; keine doppelten Raum-IDs.');
  if (
    a.patch.renumberStart !== undefined &&
    (!Number.isSafeInteger(a.patch.renumberStart) || a.patch.renumberStart < 1)
  )
    throw new Error('Erste Anzeigezahl muss eine positive ganze Zahl sein.');
  for (const [index, target] of a.rooms.entries()) {
    const room = owner.room(target.id);
    if (room.revision !== target.expectedRevision) throw new Error('Ausgewählter Raum geändert.');
    const old = roomKey(room.id),
      c = old ? structuredClone(old) : emptyKey(room),
      p = a.patch,
      explicitNumber = p.number !== undefined && p.number !== room.number;
    if (p.name) room.name = editKeyText(room.name, p.name);
    if (p.number !== undefined) room.number = p.number;
    if (p.renumberStart !== undefined) room.number = String(p.renumberStart + index);
    if (p.levelId !== undefined) c.levelId = p.levelId;
    if (p.groupId !== undefined) {
      c.groupId = p.groupId;
      if (c.groupId)
        c.levelId = byId.get(c.groupId)?.kind === 'group' ? byId.get(c.groupId)!.levelId : null;
    }
    if (p.attributes)
      c.attributes =
        p.attributeMode === 'replace'
          ? structuredClone(p.attributes)
          : { ...c.attributes, ...p.attributes };
    for (const field of ['tags', 'secret', 'status', 'references', 'blocks'] as const)
      if (p[field] !== undefined)
        Object.assign(c, {
          [field]:
            field === 'blocks' && a.rooms.length > 1
              ? p.blocks!.map((b) => ({ ...structuredClone(b), id: randomUUID() }))
              : structuredClone(p[field]),
        });
    for (const [field, visibility] of [
      ['readAloud', 'public'],
      ['gmNotes', 'gm'],
    ] as const) {
      const edit = p[field];
      if (!edit) continue;
      let block = c.blocks.find((b) => b.kind === 'text' && b.visibility === visibility);
      if (!block) {
        block = {
          id: randomUUID(),
          kind: 'text',
          visibility,
          text: '',
          templateId: null,
          suppressed: [],
          dc: null,
          searchMethod: '',
          discoveryNotes: '',
          revealedText: '',
        };
        c.blocks.unshift(block);
      }
      block.text = editKeyText(block.text, edit);
    }
    if (p.linkTemplate !== undefined) {
      const link = p.linkTemplate,
        template = link && byId.get(link.id);
      if (
        !link ||
        typeof link.id !== 'string' ||
        !Number.isSafeInteger(link.revision) ||
        !template ||
        template.kind !== 'template' ||
        template.scopeId !== room.scopeId ||
        template.revision !== link.revision
      )
        throw new Error('Textvorlage geändert oder nicht in diesem Raumbereich verfügbar.');
      if (p.blocks !== undefined)
        throw new Error('Vorlagenverknüpfung und Blockersetzung getrennt ausführen.');
      if (!c.blocks.some((b) => b.kind === 'template' && b.templateId === template.id))
        c.blocks.push({
          id: randomUUID(),
          kind: 'template',
          visibility: 'public',
          text: '',
          templateId: template.id,
          suppressed: [],
          dc: null,
          searchMethod: '',
          discoveryNotes: '',
          revealedText: '',
        });
    }
    if (p.legacyText) {
      const markdown = room.sections.filter((s) => s.kind === 'markdown');
      if (!markdown.length)
        room.sections.unshift({
          id: randomUUID(),
          kind: 'markdown',
          markdown: editKeyText('', p.legacyText),
        });
      else for (const s of markdown) s.markdown = editKeyText(s.markdown ?? '', p.legacyText);
    }
    if (p.sectionEdits) {
      for (const edit of p.sectionEdits) {
        const section = room.sections.find((s) => s.id === edit.id && s.kind === 'markdown');
        if (!section) throw new Error('Ursprünglicher Raumabschnitt nicht mehr verfügbar.');
        section.markdown = edit.markdown;
      }
      validateRoom(room);
    }
    if (
      !room.name.trim() ||
      room.name.length > 1000 ||
      !room.number.trim() ||
      room.number.length > 100
    )
      throw new Error('Raumname und Anzeigezahl prüfen.');
    c.name = room.name;
    const levelKey = c.levelId ?? '',
      otherRooms = otherNumbers(room),
      conflict = otherRooms.some(
        (r: any) =>
          r.number === room.number &&
          (p.renumberStart === undefined || !a.rooms.some((t) => t.id === r.id)) &&
          (roomKey(r.id)?.levelId ?? '') === levelKey,
      );
    if (conflict) {
      if (explicitNumber || p.renumberStart !== undefined)
        throw new Error('Anzeigezahl ist in diesem Level schon vergeben.');
      let next = 1;
      while (
        otherRooms.some(
          (r: any) => r.number === String(next) && (roomKey(r.id)?.levelId ?? '') === levelKey,
        )
      )
        next++;
      room.number = String(next);
    }
    save(c, target.keyRevision);
    owner.apply({ table: 'room', id: room.id }, owner.roomRow(cam, room));
    const indexed = numberById.get(room.id);
    if (indexed) indexed.number = room.number;
  }
  validateResolvedKeyBlocks(records);
}
export function revealKey(
  db: any,
  cam: string,
  roomId: string,
  subjectId: string,
  characters: string[],
  known: boolean,
) {
  const records = readDungeonKeys(db, cam),
    content = records.find(
      (c) =>
        ((c.id === roomId && c.kind === 'room') ||
          (c.kind === 'surface' &&
            (c.surface?.roomId === roomId ||
              c.surface?.fragments.some(
                (f) =>
                  !f.unbound &&
                  db
                    .prepare(
                      'SELECT 1 FROM dungeon_volume WHERE campaign_id=? AND id=? AND room_id=?',
                    )
                    .get(cam, f.volumeId, roomId),
              )))) &&
        expandedKeyBlocks(c, records).some(
          (b) =>
            b.id === subjectId &&
            (b.visibility === 'secret' ||
              (c.kind === 'surface' && c.secret && b.visibility === 'public')),
        ),
    );
  if (!content) throw new Error('Beschreibungsblock fehlt.');
  for (const id of characters)
    db.prepare(
      'INSERT INTO dungeon_key_discovery VALUES(?,?,?,?) ON CONFLICT(campaign_id,character_id,subject_id) DO UPDATE SET known=excluded.known',
    ).run(cam, id, subjectId, Number(known));
}
