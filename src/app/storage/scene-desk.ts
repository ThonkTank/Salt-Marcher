import { checkedWorldNoteRow } from './world-note-row';
import { searchNoteChoices } from './note-choice-search';
import type { PreparationCommand } from '../campaign/preparation-contracts';
import { saveNarrative, validateNarrativeState } from './narrative';
import { documentReferences } from '../campaign/text-references';
import { searchTextReferences, referenceEntry } from './text-references';
import { createHash } from 'node:crypto';
import type {
  DeskRef,
  DeskEntry,
  DeskContent,
  SceneDesk,
  SceneCreationDraft,
} from '../runtime/scene-desk-contracts';
import { readLiveScene } from './live';
import { worldNoteDocument } from '../../features/world/world-notes';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { readCreature, searchCreatures, readEncounterPlan } from './encounters';
import { readItemDefinition, readItemDefinitions } from './item-definitions';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installSceneDesk(db: any) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS scene_creation_draft(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS scene_desk(campaign_id TEXT NOT NULL,scene_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,scene_id),FOREIGN KEY(campaign_id,scene_id) REFERENCES live_scene(campaign_id,id)) STRICT;`,
  );
}
function decoded(r: any) {
  if (!r || hash(r.payload) !== r.checksum) throw new Error('Inhalt fehlt oder ist beschädigt.');
  return JSON.parse(r.payload);
}
function checkedRef(ref: DeskRef) {
  if (
    !ref ||
    !['note', 'location', 'creature', 'item', 'encounter'].includes(ref.kind) ||
    typeof ref.id !== 'string' ||
    !ref.id ||
    ref.id.length > 1000
  )
    throw new Error('Inhaltsverweis ungültig.');
  return ref;
}
const proseLinks = (db: any, cam: string, doc: any) => {
  const refs = documentReferences(doc),
    entries = new Map<string, ReturnType<typeof referenceEntry>>();
  const entry = (ref: DeskRef) => {
    const key = ref.kind + ':' + ref.id;
    let value = entries.get(key);
    if (!value) {
      value = referenceEntry(db, cam, ref);
      entries.set(key, value);
    }
    return { ...value, ref: { ...value.ref } };
  };
  return {
    links: refs
      .slice(0, 200)
      .map((r) => ({ label: r.field + ' · ' + r.label, entry: entry(r.ref) })),
    ...(refs.length > 200
      ? {
          referenceNotice:
            'Hier wird nur ein Teil der Textverweise als Schaltfläche dargestellt. Weitere Ziele über Verknüpfte Begriffe suchen oder den Originaltext bearbeiten.',
        }
      : {}),
  };
};
export function deskContent(db: any, cam: string, ref: DeskRef): DeskContent {
  checkedRef(ref);
  if (ref.kind === 'note') {
    const row = db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, ref.id),
      note = checkedWorldNoteRow(row, 'Inhalt fehlt oder ist beschädigt.');
    const prose = proseLinks(db, cam, note);
    return {
      ref,
      title: note.title,
      label: {
        note: 'Notiz',
        npc: 'NPC',
        faction: 'Fraktion',
        quest: 'Quest',
        rumor: 'Gerücht',
        rule: 'Regel',
      }[note.kind],
      revision: note.revision,
      note,
      ...prose,
      links: [
        ...prose.links,
        ...note.relations.map((relation) => {
          const target = db
            .prepare(
              "SELECT id,trashed,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.title') END AS title FROM world_note WHERE campaign_id=? AND id=?",
            )
            .get(cam, relation.targetId);
          return {
            label: relation.label,
            entry: {
              ref: { kind: 'note' as const, id: relation.targetId },
              title: target?.title ?? 'Nicht verfügbarer Weltinhalt',
              label: 'Weltverweis',
              unavailable: !target || !!target.trashed,
            },
          };
        }),
      ],
      unavailable: !!row.trashed,
    };
  }
  if (ref.kind === 'location') {
    const row = db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(cam, ref.id),
      location = checkedLocationDocument(decoded(row));
    if (location.id !== row.id || !Number.isSafeInteger(row.revision) || row.revision < 1)
      throw new Error('Ortszuordnung widersprüchlich.');
    return {
      ref,
      title: location.name,
      label: 'Ort',
      revision: row.revision,
      location,
      ...proseLinks(db, cam, location),
      unavailable: !!row.trashed,
    };
  }
  if (ref.kind === 'item') {
    const item = readItemDefinition(db, ref.id);
    return {
      ref,
      title: item.name,
      label: 'Gegenstand',
      revision: item.revision,
      item,
      unavailable: item.trashed,
    };
  }
  if (ref.kind === 'creature') {
    const creature = readCreature(ref.id);
    return {
      ref,
      title: creature.name,
      label: 'Kreatur',
      revision: 1,
      creature,
    };
  }
  const encounter = readEncounterPlan(db, cam, ref.id);
  return {
    ref,
    title: encounter.name,
    label: 'Encounter',
    revision: encounter.revision,
    encounter,
  };
}
function state(db: any, cam: string, sceneId: string) {
  const row = db
    .prepare('SELECT * FROM scene_desk WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  return checkedState(row);
}
function checkedState(row: any) {
  if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1))
    throw new Error('Szenentischrevision beschädigt.');
  const refs: DeskRef[] = row ? decoded(row) : [];
  if (
    !Array.isArray(refs) ||
    refs.length > 100 ||
    new Set(refs.map((r) => r?.kind + ':' + r?.id)).size !== refs.length
  )
    throw new Error('Szenentisch beschädigt.');
  refs.forEach(checkedRef);
  return { revision: row?.revision ?? 0, refs };
}
export function validateSceneDesk(db: any) {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='scene_desk'").get()) {
    if (db.pragma('user_version', { simple: true }) < 38) return;
    throw new Error('Szenentischspeicher fehlt.');
  }
  for (const row of db.prepare('SELECT * FROM scene_desk').iterate()) checkedState(row);
  if (db.prepare("SELECT 1 FROM sqlite_schema WHERE name='scene_creation_draft'").get())
    for (const row of db.prepare('SELECT * FROM scene_creation_draft').iterate())
      checkedCreationDraft(decoded(row), row.campaign_id, row.scene_id);
}
export function readSceneDesk(db: any, cam: string, sceneId: string): SceneDesk {
  const scene = readLiveScene(db, cam, sceneId),
    s = state(db, cam, sceneId);
  const entry = (ref: DeskRef): DeskEntry => {
    try {
      const c = deskContent(db, cam, ref);
      return {
        ref,
        title: c.title,
        label: c.label,
        unavailable: c.unavailable,
      };
    } catch {
      return {
        ref,
        title: 'Inhalt nicht verfügbar',
        label: ref.kind,
        unavailable: true,
      };
    }
  };
  return {
    sceneId,
    revision: s.revision,
    pins: s.refs.map(entry),
    place: scene.locationId ? entry({ kind: 'location', id: scene.locationId }) : null,
  };
}
export function pinSceneDesk(
  db: any,
  cam: string,
  sceneId: string,
  revision: number,
  ref: DeskRef,
  pin: boolean,
) {
  return db
    .transaction(() => {
      checkedRef(ref);
      const scene = readLiveScene(db, cam, sceneId),
        s = state(db, cam, sceneId);
      if (scene.retired || s.revision !== revision || typeof pin !== 'boolean')
        throw new Error('Szenentisch inzwischen geändert. Bitte aktualisieren.');
      const found = s.refs.some((r) => r.kind === ref.kind && r.id === ref.id);
      if (found === pin) return readSceneDesk(db, cam, sceneId);
      if (pin) {
        const c = deskContent(db, cam, ref);
        if (c.unavailable || s.refs.length >= 100)
          throw new Error('Inhalt nicht verfügbar oder Szenentisch voll.');
        s.refs.push(ref);
      } else s.refs = s.refs.filter((r) => r.kind !== ref.kind || r.id !== ref.id);
      const payload = JSON.stringify(s.refs);
      db.prepare(
        'INSERT INTO scene_desk VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, sceneId, s.revision + 1, payload, hash(payload));
      return readSceneDesk(db, cam, sceneId);
    })
    .immediate();
}
/** Only authored, readable prose is shown; never JSON metadata or hidden IDs. */
function searchPreview(
  search: string,
  fields: { label: string; text: string }[],
): DeskEntry['preview'] {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return undefined;
  for (const field of fields) {
    const text = field.text.replace(/\s+/gu, ' ').trim(),
      index = text.toLocaleLowerCase().indexOf(needle);
    if (index < 0) continue;
    let from = Math.max(0, index - 56);
    if (from && /[\uDC00-\uDFFF]/u.test(text[from]!)) from--;
    const excerpt = Array.from(text.slice(from, from + 402))
      .slice(0, 200)
      .join('');
    return {
      label: field.label,
      text: (from ? '… ' : '') + excerpt + (from + excerpt.length < text.length ? ' …' : ''),
    };
  }
  return undefined;
}
function authoredPreview(row: any, search: string): DeskEntry['preview'] {
  if (!search.trim()) return undefined;
  try {
    const raw = decoded(row);
    if (row.kind === 'note') {
      const note = worldNoteDocument(raw);
      if (note.id !== row.id || note.revision !== row.revision) return undefined;
      return searchPreview(search, [
        { label: 'GM-Notiz', text: note.gmNotes },
        { label: 'Vorlesetext', text: note.readAloud },
      ]);
    }
    if (row.kind === 'location') {
      const location = checkedLocationDocument(raw);
      if (location.id !== row.id) return undefined;
      return searchPreview(
        search,
        location.sections.map((s) => ({ label: s.title, text: s.markdown })),
      );
    }
    if (raw.id !== row.id || raw.revision !== row.revision) return undefined;
    return searchPreview(search, [
      { label: 'Encounter-Notiz', text: typeof raw.notes === 'string' ? raw.notes : '' },
    ]);
  } catch {
    return undefined;
  }
}
export function searchDesk(db: any, cam: string, kind: string, search: string, offset: number) {
  if (
    typeof search !== 'string' ||
    search.length > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1000000
  )
    throw new Error('Suchanfrage ungültig.');
  if (kind === 'note' || kind === 'rule')
    return searchNoteChoices(db, cam, search, offset, kind === 'rule');
  if (kind === 'reference') return searchTextReferences(db, cam, search, offset);
  if (kind === 'creature') {
    const p = searchCreatures({ text: search, offset, limit: 40 });
    return {
      entries: p.rows.map((c) => ({
        ref: { kind: 'creature', id: c.id },
        title: c.name,
        label: 'Kreatur · HG ' + c.challengeRating,
      })),
      next: offset + p.rows.length < p.total ? offset + p.rows.length : null,
    };
  }
  if (kind === 'item') {
    const p = readItemDefinitions(db, {
      search,
      category: '',
      magic: '',
      rarity: '',
      attunement: '',
      sort: 'name',
      direction: 'asc',
      after: offset,
      includeTrashed: false,
    });
    return {
      entries: p.items.map((i) => ({
        ref: { kind: 'item', id: i.id },
        title: i.name,
        label: 'Gegenstand',
      })),
      next: p.next,
      notice: p.sourceStatus.message,
    };
  }
  if (!['world', 'encounter'].includes(kind)) throw new Error('Suchbereich ungültig.');
  const sql =
    kind === 'encounter'
      ? `SELECT 'encounter' kind,id,name title,'Encounter' label,payload,checksum,revision FROM encounter_plan WHERE campaign_id=@cam AND instr(lower(name||' '||payload),lower(@search))>0 ORDER BY title,id LIMIT 41 OFFSET @offset`
      : `SELECT 'note' kind,id,json_extract(payload,'$.title') title,json_extract(payload,'$.kind') label,payload,checksum,revision FROM world_note WHERE campaign_id=@cam AND trashed=0 AND json_valid(payload) AND instr(lower(json_extract(payload,'$.title')||' '||json_extract(payload,'$.readAloud')||' '||json_extract(payload,'$.gmNotes')),lower(@search))>0 UNION ALL SELECT 'location' kind,id,json_extract(payload,'$.name') title,'Ort' label,payload,checksum,revision FROM location WHERE campaign_id=@cam AND trashed=0 AND json_valid(payload) AND instr(lower(payload),lower(@search))>0 ORDER BY title,id LIMIT 41 OFFSET @offset`;
  const rows = db.prepare(sql).all({ cam, search, offset });
  return {
    entries: rows.slice(0, 40).map((r: any) => ({
      ref: { kind: r.kind, id: r.id },
      title: r.title,
      preview: authoredPreview(r, search),
      label:
        (
          {
            note: 'Notiz',
            npc: 'NPC',
            faction: 'Fraktion',
            quest: 'Quest',
            rumor: 'Gerücht',
            rule: 'Regel',
          } as Record<string, string>
        )[r.label] ?? r.label,
    })),
    next: rows.length > 40 ? offset + 40 : null,
  };
}

/** Runs inside the existing preparation transaction and receipt. */
export function applySceneCreation(db: any, cam: string, command: PreparationCommand) {
  const c = command.sceneCreation;
  if (c === undefined) return;
  const change = command.change;
  if (
    !c ||
    typeof c.sceneId !== 'string' ||
    !c.sceneId ||
    !Number.isSafeInteger(c.expectedSceneRevision) ||
    c.expectedSceneRevision < 0 ||
    !Number.isSafeInteger(c.expectedMembershipRevision) ||
    c.expectedMembershipRevision < 0 ||
    !Number.isSafeInteger(c.expectedDeskRevision) ||
    c.expectedDeskRevision < 0 ||
    typeof c.pin !== 'boolean' ||
    !Array.isArray(c.contributors) ||
    c.contributors.some((id) => typeof id !== 'string' || !id) ||
    new Set(c.contributors).size !== c.contributors.length ||
    command.draftWriteId !== undefined ||
    !['note', 'location'].includes(change.kind) ||
    change.expectedRevision !== null
  )
    throw new Error('Szenenanlage benötigt einen neuen Inhalt und einen gültigen Szenenkontext.');
  const scene = readLiveScene(db, cam, c.sceneId);
  if (
    scene.retired ||
    scene.revision !== c.expectedSceneRevision ||
    scene.membershipRevision !== c.expectedMembershipRevision ||
    c.contributors.some((id) => !scene.members.includes(id))
  )
    throw new Error('Gruppe inzwischen geändert. Eingabe prüfen und erneut anlegen.');
  if (change.kind === 'note') {
    if (!['npc', 'faction', 'quest', 'rumor'].includes(change.note.kind))
      throw new Error('Diese Inhaltsart wird außerhalb der Szene angelegt.');
    if (change.note.kind !== 'quest' && c.contributors.length)
      throw new Error('Mitwirkende gehören zu einer Quest.');
    if (change.note.kind === 'quest' || change.note.kind === 'rumor') {
      const state = {
        noteId: change.note.id,
        revision: 1,
        status: 'open' as const,
        locationId: c.pin ? scene.locationId : null,
        contributors: c.contributors,
        poolXp: 0,
        items: [],
        awardId: null,
      };
      validateNarrativeState(db, cam, state);
      saveNarrative(db, cam, state);
    }
  } else if (c.contributors.length) throw new Error('Mitwirkende gehören zu einer Quest.');
  if (c.pin)
    pinSceneDesk(
      db,
      cam,
      c.sceneId,
      c.expectedDeskRevision,
      {
        kind: change.kind === 'note' ? 'note' : 'location',
        id:
          change.kind === 'note'
            ? change.note.id
            : change.kind === 'location'
              ? change.document.id
              : '',
      },
      true,
    );
}

function checkedCreationDraft(d: SceneCreationDraft, cam: string, sceneId: string) {
  const i = d?.input,
    c = d?.command;
  if (
    !d ||
    typeof d.writeId !== 'string' ||
    !d.writeId ||
    !i ||
    !['npc', 'faction', 'quest', 'rumor', 'location'].includes(i.kind) ||
    typeof i.name !== 'string' ||
    i.name.length > 1000 ||
    typeof i.notes !== 'string' ||
    i.notes.length > 2000000 ||
    typeof i.pin !== 'boolean' ||
    typeof i.contributors !== 'boolean' ||
    (c !== null &&
      (!c ||
        c.campaignId !== cam ||
        c.sceneCreation?.sceneId !== sceneId ||
        typeof c.commandId !== 'string' ||
        !c.commandId ||
        !['note', 'location'].includes(c.change?.kind) ||
        c.change.expectedRevision !== null))
  )
    throw new Error('Schnellanlage-Eingabe beschädigt oder falsch zugeordnet.');
  return d;
}
export function readSceneCreationDraft(
  db: any,
  cam: string,
  sceneId: string,
): SceneCreationDraft | null {
  readLiveScene(db, cam, sceneId);
  const row = db
    .prepare('SELECT * FROM scene_creation_draft WHERE campaign_id=? AND scene_id=?')
    .get(cam, sceneId);
  return row ? checkedCreationDraft(decoded(row), cam, sceneId) : null;
}
export function keepSceneCreationDraft(
  db: any,
  cam: string,
  sceneId: string,
  draft: SceneCreationDraft | null,
  expected: string | null,
) {
  return db
    .transaction(() => {
      const scene = readLiveScene(db, cam, sceneId),
        old = readSceneCreationDraft(db, cam, sceneId);
      if (!draft && !old) return;
      if (scene.retired || (old?.writeId ?? null) !== expected)
        throw new Error('Schnellanlage-Eingabe inzwischen verändert. Eigene Eingabe bleibt offen.');
      if (draft) {
        checkedCreationDraft(draft, cam, sceneId);
        const payload = JSON.stringify(draft);
        db.prepare(
          'INSERT INTO scene_creation_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,scene_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
        ).run(cam, sceneId, payload, hash(payload));
      } else
        db.prepare('DELETE FROM scene_creation_draft WHERE campaign_id=? AND scene_id=?').run(
          cam,
          sceneId,
        );
    })
    .immediate();
}
