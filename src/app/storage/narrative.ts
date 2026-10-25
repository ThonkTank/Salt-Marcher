import { worldNoteDocument } from '../../features/world/world-notes';
import { createHash } from 'node:crypto';
import type {
  NarrativeState,
  NarrativeAward,
  NarrativeView,
  NarrativeDraft,
} from '../runtime/narrative-contracts';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const id = (value: unknown) => typeof value === 'string' && !!value && value.length <= 1000;
const nullableId = (value: unknown) => value === null || id(value);
const optionalNullableId = (value: unknown) => value === undefined || nullableId(value);
const gold = (value: unknown) =>
  typeof value === 'string' && /^(0|[1-9][0-9]{0,14})([.,][0-9]{1,2})?$/.test(value.trim());
const categories = ['coins', 'equipment', 'trade-goods', 'magic', 'other'];

export function installNarrative(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS narrative_state(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE TABLE IF NOT EXISTS narrative_award(campaign_id TEXT NOT NULL,id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS narrative_award_note ON narrative_award(campaign_id,note_id);
CREATE TABLE IF NOT EXISTS narrative_draft(campaign_id TEXT NOT NULL,note_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,note_id),FOREIGN KEY(campaign_id,note_id) REFERENCES world_note(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS ledger_parent_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.parentId') END);
CREATE INDEX IF NOT EXISTS ledger_credit_lookup ON character_ledger(campaign_id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.rewardCreditId') END);`);
}

function parsed<T>(row: any): T {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Narrative Belohnung beschädigt.');
  return JSON.parse(row.payload);
}
function narrativeDocument(db: any, cam: string, noteId: string, retained = false) {
  const row = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, noteId);
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Narrative Notiz nicht verfügbar.');
  const note = worldNoteDocument(JSON.parse(row.payload));
  if (note.id !== row.id || note.revision !== row.revision)
    throw new Error('Narrative Notizzuordnung widersprüchlich.');
  if (!retained && !['quest', 'rumor'].includes(note.kind))
    throw new Error('Quest oder Gerücht auswählen.');
  return { row, note };
}

export function narrativeNote(db: any, cam: string, noteId: string, retained = false) {
  const { row, note } = narrativeDocument(db, cam, noteId, retained);
  if (!retained && row.trashed) throw new Error('Narrative Notiz nicht verfügbar.');
  return note;
}

export function checkedNarrativeState(value: unknown): NarrativeState {
  const state = value as NarrativeState;
  if (
    !state ||
    !id(state.noteId) ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !['open', 'closed'].includes(state.status) ||
    !optionalNullableId(state.locationId) ||
    !Array.isArray(state.contributors) ||
    state.contributors.length > 1000 ||
    state.contributors.some((value) => !id(value)) ||
    new Set(state.contributors).size !== state.contributors.length ||
    !Number.isSafeInteger(state.poolXp) ||
    state.poolXp < 0 ||
    !Array.isArray(state.items) ||
    state.items.length > 100 ||
    !nullableId(state.awardId)
  )
    throw new Error('Status, Mitwirkende und Belohnung prüfen.');
  for (const item of state.items) {
    const reference = item?.reference;
    if (
      !item ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 1000 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1000000 ||
      !categories.includes(item.category) ||
      !gold(item.valueGold) ||
      (reference !== undefined &&
        (reference.kind !== 'authored' ||
          !id(reference.definitionId) ||
          !Number.isSafeInteger(reference.revision) ||
          reference.revision < 1 ||
          (reference.historicalDefinitionId !== undefined &&
            !id(reference.historicalDefinitionId))))
    )
      throw new Error('Belohnungsgegenstand prüfen.');
  }
  return state;
}

export function checkedNarrativeAward(value: unknown): NarrativeAward {
  const award = value as NarrativeAward;
  if (
    !award ||
    !id(award.id) ||
    !id(award.noteId) ||
    typeof award.title !== 'string' ||
    !award.title.trim() ||
    award.title.length > 1000 ||
    !nullableId(award.sceneId) ||
    !Number.isSafeInteger(award.poolXp) ||
    award.poolXp < 0 ||
    !Number.isSafeInteger(award.shareXp) ||
    award.shareXp < 0 ||
    !Array.isArray(award.recipientIds) ||
    award.recipientIds.length > 1000 ||
    award.recipientIds.some((value) => !id(value)) ||
    new Set(award.recipientIds).size !== award.recipientIds.length ||
    !nullableId(award.treasureId) ||
    typeof award.outcome !== 'string' ||
    !award.outcome.trim() ||
    award.outcome.length > 10000 ||
    typeof award.recordedAt !== 'string' ||
    !Number.isFinite(Date.parse(award.recordedAt))
  )
    throw new Error('Narrativer Belohnungsbeleg beschädigt.');
  const share = award.recipientIds.length
    ? Number(
        (BigInt(award.poolXp) + BigInt(award.recipientIds.length) - 1n) /
          BigInt(award.recipientIds.length),
      )
    : 0;
  if (award.shareXp !== share) throw new Error('Narrativer XP-Beleg widersprüchlich.');
  return award;
}

function checkedAward(db: any, cam: string, row: any): NarrativeAward {
  const award = checkedNarrativeAward(parsed(row));
  if (row.id !== award.id || row.note_id !== award.noteId)
    throw new Error('Narrativer Belohnungsbeleg ist falsch zugeordnet.');
  narrativeDocument(db, cam, row.note_id, true);
  for (const recipient of award.recipientIds)
    if (!db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam, recipient))
      throw new Error('Narrativer Belohnungsbeleg verweist auf eine fehlende Figur.');
  if (
    award.sceneId &&
    !db.prepare('SELECT 1 FROM live_scene WHERE campaign_id=? AND id=?').get(cam, award.sceneId)
  )
    throw new Error('Narrativer Belohnungsbeleg verweist auf eine fehlende Szene.');
  if (award.treasureId) {
    const treasureRow = db
        .prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?')
        .get(cam, award.treasureId),
      treasure = parsed<any>(treasureRow);
    if (
      treasure.id !== award.treasureId ||
      treasure.sourceNoteId !== award.noteId ||
      treasure.awardId !== award.id
    )
      throw new Error('Narrative Beute ist falsch zugeordnet.');
  }
  return award;
}

export function readNarrative(
  db: any,
  cam: string,
  noteId: string,
  retained = false,
): NarrativeView {
  const note = narrativeNote(db, cam, noteId, retained),
    row = db
      .prepare('SELECT * FROM narrative_state WHERE campaign_id=? AND note_id=?')
      .get(cam, noteId);
  const state: NarrativeState = row
    ? checkedNarrativeState(parsed(row))
    : {
        noteId,
        revision: 0,
        status: 'open',
        locationId: null,
        contributors: [],
        poolXp: 0,
        items: [],
        awardId: null,
      };
  const paid = db
    .prepare('SELECT * FROM narrative_award WHERE campaign_id=? AND note_id=? LIMIT 2')
    .all(cam, noteId);
  if (
    paid.length > 1 ||
    paid.length !== Number(state.awardId !== null) ||
    (paid.length === 1 && paid[0].id !== state.awardId)
  )
    throw new Error('Narrativer Belohnungsbeleg ist falsch zugeordnet.');
  if (
    row &&
    (row.note_id !== state.noteId || row.revision !== state.revision || state.revision < 1)
  )
    throw new Error('Narrativer Status widerspricht seinem Datensatz.');
  if (row) validateNarrativeState(db, cam, state, true);
  const award = paid.length ? checkedAward(db, cam, paid[0]) : null;
  return { state, award, noteRevision: note.revision, draft: readNarrativeDraft(db, cam, noteId) };
}

export function saveNarrative(db: any, cam: string, state: NarrativeState) {
  checkedNarrativeState(state);
  const payload = JSON.stringify(state);
  db.prepare(
    'INSERT INTO narrative_state VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, state.noteId, state.revision, payload, hash(payload));
}
export function saveNarrativeAward(db: any, cam: string, award: NarrativeAward) {
  checkedNarrativeAward(award);
  const payload = JSON.stringify(award);
  db.prepare('INSERT INTO narrative_award VALUES(?,?,?,?,?)').run(
    cam,
    award.id,
    award.noteId,
    payload,
    hash(payload),
  );
}

export function validateNarrativeState(
  db: any,
  cam: string,
  state: NarrativeState,
  retained = false,
) {
  checkedNarrativeState(state);
  if (
    state.locationId &&
    !db
      .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND (? OR trashed=0)')
      .get(cam, state.locationId, Number(retained))
  )
    throw new Error('Verknüpfter Ort nicht verfügbar.');
  for (const contributor of state.contributors)
    if (
      !db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam, contributor)
    )
      throw new Error('Mitwirkende Figur fehlt.');
}

export function validateNarrativeBackup(db: any) {
  const tables = new Set(
    db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('narrative_state','narrative_award','narrative_draft')",
      )
      .all()
      .map((row: any) => row.name),
  );
  if (!tables.size && db.pragma('user_version', { simple: true }) < 35) return;
  if (!tables.has('narrative_state') || !tables.has('narrative_award'))
    throw new Error('Narrativer Speicherstand ist unvollständig.');
  const states = new Map<string, NarrativeState>(),
    awards = new Set<string>();
  for (const row of db.prepare('SELECT * FROM narrative_state').iterate()) {
    const state = checkedNarrativeState(parsed(row)),
      key = row.campaign_id + '\0' + row.note_id;
    if (row.note_id !== state.noteId || row.revision !== state.revision || state.revision < 1)
      throw new Error('Narrativer Status widerspricht seinem Datensatz.');
    narrativeDocument(db, row.campaign_id, row.note_id, true);
    if (
      state.locationId &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?')
        .get(row.campaign_id, state.locationId)
    )
      throw new Error('Narrativer Status verweist auf einen fehlenden Ort.');
    for (const contributor of state.contributors)
      if (
        !db
          .prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?')
          .get(row.campaign_id, contributor)
      )
        throw new Error('Narrativer Status verweist auf eine fehlende Figur.');
    for (const item of state.items)
      if (
        item.reference &&
        !db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(item.reference.definitionId)
      )
        throw new Error('Narrative Belohnung verweist auf einen fehlenden Gegenstand.');
    states.set(key, state);
  }
  for (const row of db.prepare('SELECT * FROM narrative_award').iterate()) {
    const award = checkedAward(db, row.campaign_id, row),
      key = row.campaign_id + '\0' + row.note_id,
      state = states.get(key);
    if (state?.awardId !== award.id)
      throw new Error('Narrativer Belohnungsbeleg ist falsch zugeordnet.');
    awards.add(row.campaign_id + '\0' + award.id);
  }
  for (const [key, state] of states)
    if (state.awardId && !awards.has(key.slice(0, key.indexOf('\0')) + '\0' + state.awardId))
      throw new Error('Narrativer Status verweist auf einen fehlenden Belohnungsbeleg.');
  if (tables.has('narrative_draft'))
    for (const row of db.prepare('SELECT * FROM narrative_draft').iterate()) {
      const d = checkedNarrativeDraft(parsed(row));
      if (d.noteId !== row.note_id) throw new Error('Narrativer Entwurf ist falsch zugeordnet.');
      narrativeDocument(db, row.campaign_id, row.note_id, true);
      validateDraftOwners(db, row.campaign_id, d);
    }
  else if (db.pragma('user_version', { simple: true }) >= 36)
    throw new Error('Narrativer Entwurfsspeicher ist unvollständig.');
}

function checkedNarrativeDraft(value: unknown): NarrativeDraft {
  const d = value as NarrativeDraft,
    text = (v: unknown) => typeof v === 'string' && v.length <= 1000;
  if (
    !d ||
    (d.noteRevision !== undefined &&
      (!Number.isSafeInteger(d.noteRevision) || d.noteRevision < 1)) ||
    !id(d.noteId) ||
    !id(d.writeId) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 0 ||
    !['open', 'closed'].includes(d.status) ||
    !nullableId(d.locationId) ||
    !text(d.poolXp) ||
    !Array.isArray(d.contributors) ||
    d.contributors.length > 1000 ||
    d.contributors.some((v) => !id(v)) ||
    new Set(d.contributors).size !== d.contributors.length ||
    !Array.isArray(d.items) ||
    d.items.length > 100 ||
    Buffer.byteLength(JSON.stringify(d)) > 256000
  )
    throw new Error('Narrative Eingabe ist zu groß oder ungültig.');
  for (const item of d.items) {
    const ref = item?.reference;
    if (
      !item ||
      !text(item.name) ||
      !text(item.quantity) ||
      !text(item.valueGold) ||
      !categories.includes(item.category) ||
      (ref !== undefined &&
        (ref.kind !== 'authored' ||
          !id(ref.definitionId) ||
          !Number.isSafeInteger(ref.revision) ||
          ref.revision < 1 ||
          (ref.historicalDefinitionId !== undefined && !id(ref.historicalDefinitionId))))
    )
      throw new Error('Narrative Eingabe ist zu groß oder ungültig.');
  }
  return d;
}
function validateDraftOwners(db: any, cam: string, d: NarrativeDraft) {
  if (
    d.locationId &&
    !db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam, d.locationId)
  )
    throw new Error('Narrativer Entwurf verweist auf einen fehlenden Ort.');
  for (const contributor of d.contributors)
    if (
      !db.prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?').get(cam, contributor)
    )
      throw new Error('Narrativer Entwurf verweist auf eine fehlende Figur.');
  for (const item of d.items)
    if (
      item.reference &&
      !db.prepare('SELECT 1 FROM authored_item WHERE id=?').get(item.reference.definitionId)
    )
      throw new Error('Narrativer Entwurf verweist auf einen fehlenden Gegenstand.');
}
export function readNarrativeDraft(db: any, cam: string, id: string): NarrativeDraft | null {
  const r = db
    .prepare('SELECT * FROM narrative_draft WHERE campaign_id=? AND note_id=?')
    .get(cam, id);
  if (!r) return null;
  const d = checkedNarrativeDraft(parsed(r));
  if (d.noteId !== r.note_id) throw new Error('Narrativer Entwurf ist falsch zugeordnet.');
  validateDraftOwners(db, cam, d);
  return d;
}
export function keepNarrativeDraft(
  db: any,
  cam: string,
  d: NarrativeDraft,
  expected: string | null,
) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, d.noteId);
      checkedNarrativeDraft(d);
      validateDraftOwners(db, cam, d);
      const old = readNarrativeDraft(db, cam, d.noteId),
        payload = JSON.stringify(d);
      if (old?.writeId === d.writeId && JSON.stringify(old) === payload) return;
      if ((old?.writeId ?? null) !== expected)
        throw new Error('Narrativer Entwurf inzwischen geändert.');
      db.prepare(
        'INSERT INTO narrative_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,note_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
      ).run(cam, d.noteId, payload, hash(payload));
    })
    .immediate();
}
export function discardNarrativeDraft(db: any, cam: string, id: string, writeId: string) {
  return db
    .transaction(() => {
      narrativeNote(db, cam, id);
      consumeNarrativeDraft(db, cam, id, writeId);
    })
    .immediate();
}
export function consumeNarrativeDraft(
  db: any,
  cam: string,
  id: string,
  writeId?: string,
  basis?: { revision: number; noteRevision: number },
) {
  const d = readNarrativeDraft(db, cam, id);
  if (d && d.writeId !== writeId)
    throw new Error('Offene narrative Eingabe zuerst speichern oder verwerfen.');
  if (d && basis && (d.revision !== basis.revision || d.noteRevision !== basis.noteRevision))
    throw new Error(
      'Gesicherter narrativer Entwurf hat eine andere oder unbekannte Notiz-/Statusbasis. Entwurf erneut prüfen.',
    );
  if (d) db.prepare('DELETE FROM narrative_draft WHERE campaign_id=? AND note_id=?').run(cam, id);
}
