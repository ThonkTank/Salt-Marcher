import { treasureAnchor, treasureAnchorLabel } from './treasure-anchors';
import type { TreasureQuery } from '../runtime/treasury-contracts';
import { changeCharacterXp, partyAwardShares } from '../runtime/party-xp-model';
import { syncOpenMaskHealth } from './mask-health';
import { editGroup } from './groups';
import { editTreasury } from './treasury';
import { consumeFinishDraft } from './finish-drafts';
import {
  consumeNarrativeDraft,
  narrativeNote,
  readNarrative,
  saveNarrative,
  saveNarrativeAward,
  validateNarrativeState,
} from './narrative';
import { createHash, randomUUID } from 'node:crypto';
import {
  applyDeathSave,
  applyHealthDamage,
  applyHealthHealing,
  checkedHealth,
  checkedHealthStatus,
  copper,
  ledgerCopper,
  ledgerDefinitionId,
  ledgerStacksMatch,
  lootBalanceSuggestions,
  partitionLedgerPaidPrice,
  restAfter,
  xpLevel,
  xpShare,
  type CombatReward,
  type FinishRewards,
  type ItemInput,
  type LedgerInventoryPage,
  type LedgerInventoryQuery,
  type LedgerItem,
  type LedgerPage,
  type LedgerQuery,
  type Progress,
  type ProgressAck,
  type ProgressAction,
  type ProgressCommand,
  type ProgressView,
  type Treasure,
  type TreasurePage,
} from '../runtime/progression';
import { checkedCombat, type CombatState } from '../runtime/combat-contracts';
import { readLive, readLiveScene, readRoster } from './live';
import { readItemDefinition, recordItemDefinitionVersion } from './item-definitions';
const json = (v: unknown) => JSON.stringify(v),
  hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function installProgressSchema(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS character_progress(campaign_id TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,id) REFERENCES roster_member(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS progress_event(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, character_id TEXT, kind TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS progress_notice(campaign_id TEXT NOT NULL, id TEXT NOT NULL, character_id TEXT NOT NULL, text TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS authored_item(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, unit_copper TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS treasure(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS character_ledger(campaign_id TEXT NOT NULL, id TEXT NOT NULL, character_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;
    CREATE TABLE IF NOT EXISTS progress_receipt(command_id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaign(id), fingerprint TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS combat_award(campaign_id TEXT NOT NULL, combat_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,combat_id), FOREIGN KEY(campaign_id,combat_id) REFERENCES combat(campaign_id,id)) STRICT;
    CREATE INDEX IF NOT EXISTS ledger_character ON character_ledger(campaign_id,character_id);
    CREATE INDEX IF NOT EXISTS progress_event_character_kind ON progress_event(campaign_id,character_id,kind);`);
}
export function createProgress(db: any, cam: string, id: string, known = true) {
  const p: Progress = {
    characterId: id,
    revision: 0,
    xp: null,
    rest: { known, longXp: 0, shortXp: 0, baseline: 0, sections: 0 },
    health: null,
  };
  const payload = json(p);
  db.prepare('INSERT OR IGNORE INTO character_progress VALUES(?,?,?,?,?)').run(
    cam,
    id,
    0,
    payload,
    hash(payload),
  );
}
function decoded<T>(row: any): T {
  if (!row || hash(row.payload) !== row.checksum)
    throw new Error('Fortschritts- oder Beutedaten nicht verfügbar.');
  const state = JSON.parse(row.payload);
  if (!state || typeof state !== 'object' || Array.isArray(state))
    throw new Error('Fortschritts- oder Beutepayload hat ein ungültiges Format.');
  if (state.revision !== undefined && state.revision !== row.revision)
    throw new Error('Fortschrittsrevision widersprüchlich.');
  return state;
}
export function validateProgressBackup(db: any) {
  for (const row of db.prepare('SELECT campaign_id,id FROM character_progress').iterate())
    readProgressCharacter(db, row.campaign_id, row.id);
  for (const table of [
    'progress_event',
    'treasure',
    'character_ledger',
    'progress_receipt',
    'combat_award',
  ]) {
    for (const row of db.prepare(`SELECT * FROM ${table}`).iterate()) {
      if (table === 'character_ledger') checkedLedgerRow(row);
      else if (table === 'treasure') {
        const treasure = checkedTreasureRow(row);
        for (const item of treasure.items) readItemDefinition(db, item.reference.definitionId);
      } else decoded(row);
    }
  }
}
export function readProgressCharacter(db: any, cam: string, id: string): Progress {
  const p = decoded<Progress>(
    db.prepare('SELECT * FROM character_progress WHERE campaign_id=? AND id=?').get(cam, id),
  );
  if (
    p.characterId !== id ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    (p.xp !== null && (!Number.isSafeInteger(p.xp) || p.xp < 0))
  )
    throw new Error('XP-Stand ungültig.');
  if (
    !p.rest ||
    typeof p.rest !== 'object' ||
    Array.isArray(p.rest) ||
    typeof p.rest.known !== 'boolean'
  )
    throw new Error('Raststand ungültig.');
  for (const value of [p.rest.longXp, p.rest.shortXp, p.rest.baseline, p.rest.sections])
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Raststand ungültig.');
  if (p.rest.sections > 2 || p.rest.baseline > p.rest.longXp || p.rest.shortXp > p.rest.longXp)
    throw new Error('Rastabschnitte widersprüchlich.');
  if (p.health !== null) {
    const h = p.health;
    if (
      !h ||
      typeof h.conditions !== 'string' ||
      h.conditions.length > 4000 ||
      typeof h.concentrating !== 'boolean' ||
      ![h.hp, h.maxHp, h.tempHp].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000) ||
      h.maxHp < 1 ||
      h.hp > h.maxHp
    )
      throw new Error('Gespeicherte Trefferpunkte oder Zustände ungültig.');
    checkedHealth(h);
  }
  if (p.combatStatus !== undefined) checkedHealthStatus(p.combatStatus);
  return p;
}
export function saveProgress(db: any, cam: string, p: Progress) {
  p.revision++;
  const payload = json(p);
  db.prepare(
    'UPDATE character_progress SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
  ).run(p.revision, payload, hash(payload), cam, p.characterId);
}
export function event(
  db: any,
  cam: string,
  characterId: string | null,
  kind: keyof typeof import('./progression.transfer.json').tables.progress_event.columns.payload.transfer.models,
  facts: unknown,
  id: string = randomUUID(),
) {
  const payload = json({ recordedAt: new Date().toISOString(), ...(facts as object) });
  db.prepare('INSERT INTO progress_event VALUES(?,?,?,?,?,?)').run(
    cam,
    id,
    characterId,
    kind,
    payload,
    hash(payload),
  );
  return id;
}
function notice(db: any, cam: string, characterId: string, amount: number) {
  if (
    amount &&
    !db
      .prepare('SELECT active FROM roster_member WHERE campaign_id=? AND id=?')
      .get(cam, characterId).active
  )
    db.prepare('INSERT INTO progress_notice VALUES(?,?,?,?,0)').run(
      cam,
      randomUUID(),
      characterId,
      amount + ' XP erhalten, während die Figur inaktiv war.',
    );
}
function healthFromActor(actor: NonNullable<Progress['health']>): NonNullable<Progress['health']> {
  return {
    hp: actor.hp,
    maxHp: actor.maxHp,
    tempHp: actor.tempHp,
    conditions: actor.conditions,
    concentrating: actor.concentrating,
    ...(actor.death ? { death: structuredClone(actor.death) } : {}),
  };
}
function healthStatus(
  actor: Pick<NonNullable<Progress['combatStatus']>, 'tempHp' | 'conditions' | 'concentrating'>,
) {
  return { tempHp: actor.tempHp, conditions: actor.conditions, concentrating: actor.concentrating };
}
export function detachCombatHealth(
  db: any,
  cam: string,
  state: CombatState,
  actor: CombatState['participants'][number],
  commandId: string,
) {
  if (!actor.characterId) return;
  const p = readProgressCharacter(db, cam, actor.characterId),
    before = structuredClone(p);
  if (actor.healthKnown === false) {
    p.health = null;
    p.combatStatus = checkedHealthStatus(healthStatus(actor));
  } else {
    p.health = checkedHealth(healthFromActor(actor));
    delete p.combatStatus;
  }
  saveProgress(db, cam, p);
  event(db, cam, p.characterId, 'combat-exit', {
    commandId,
    combatId: state.id,
    title: state.title,
    participant: structuredClone(actor),
    before,
    after: p,
  });
}
export function resumeCombatHealth(
  db: any,
  cam: string,
  state: CombatState,
  actor: CombatState['participants'][number],
  commandId: string,
) {
  if (!actor.characterId) return;
  const p = readProgressCharacter(db, cam, actor.characterId),
    expected = actor.healthKnown === false ? null : healthFromActor(actor);
  const actual = p.health ? healthFromActor(p.health) : null;
  if (
    json(expected) !== json(actual) ||
    (actor.healthKnown === false &&
      json(healthStatus(actor)) !==
        json(healthStatus(p.combatStatus ?? { tempHp: 0, conditions: '', concentrating: false })))
  )
    throw new Error(
      'HP oder Zustände der ausgeschiedenen Figur wurden geändert. Rückkehr nicht durchgeführt; aktuellen Figurenstand zuerst abgleichen.',
    );
  const member = db
    .prepare('SELECT active,scene_id FROM roster_member WHERE campaign_id=? AND id=?')
    .get(cam, actor.characterId);
  if (!member?.active || member.scene_id !== state.sceneId)
    throw new Error(
      'Figur gehört inzwischen zu einer anderen Gruppe oder ist inaktiv. Rückkehr nicht durchgeführt.',
    );
  event(db, cam, p.characterId, 'combat-return', {
    commandId,
    combatId: state.id,
    title: state.title,
    participant: structuredClone(actor),
  });
}
function storedCombat(row: any): CombatState {
  const state = checkedCombat(decoded<CombatState>(row));
  if (state.id !== row.id || state.sceneId !== row.scene_id || state.phase !== row.phase)
    throw new Error('Kampfzuordnung widersprüchlich.');
  return state;
}
export function latestCombatStatuses(db: any, cam: string, ids: Iterable<string>) {
  const missing = new Set(ids),
    statuses = new Map<
      string,
      Pick<NonNullable<Progress['health']>, 'tempHp' | 'conditions' | 'concentrating'>
    >();
  if (missing.size)
    for (const row of db
      .prepare(
        "SELECT * FROM combat WHERE campaign_id=? AND phase='finished' ORDER BY ordinal DESC",
      )
      .iterate(cam)) {
      for (const p of storedCombat(row).participants)
        if (p.characterId && missing.delete(p.characterId))
          statuses.set(p.characterId, {
            tempHp: p.tempHp,
            conditions: p.conditions,
            concentrating: p.concentrating,
          });
      if (!missing.size) break;
    }
  return statuses;
}
function openHealthCombats(db: any, cam: string) {
  const actors = new Map<
    string,
    { state: CombatState; actor: CombatState['participants'][number] }
  >();
  for (const row of db
    .prepare(
      "SELECT * FROM combat WHERE campaign_id=? AND phase IN('preparing','running') ORDER BY ordinal DESC",
    )
    .iterate(cam)) {
    const state = storedCombat(row);
    for (const actor of state.participants)
      if (actor.characterId) {
        if (!actors.has(actor.characterId)) actors.set(actor.characterId, { state, actor });
      }
  }
  return actors;
}
export function lastCombatPartyParticipant(
  db: any,
  cam: string,
  state: CombatState,
  characterId: string,
) {
  for (const row of db
    .prepare(
      "SELECT * FROM progress_event WHERE campaign_id=? AND character_id=? AND kind IN ('combat-exit','combat-entry','combat-return') ORDER BY rowid DESC",
    )
    .iterate(cam, characterId)) {
    const facts = decoded<{ combatId: string; participant: CombatState['participants'][number] }>(
      row,
    );
    if (facts.combatId !== state.id) continue;
    if (facts.participant?.characterId !== characterId)
      throw new Error('Gespeicherte Rückkehr gehört nicht zur Figur.');
    checkedCombat({
      ...state,
      phase: 'preparing',
      round: 0,
      turnId: null,
      participants: [facts.participant],
    });
    return facts.participant;
  }
  return undefined;
}

export function readProgress(db: any, cam: string): ProgressView {
  return db.transaction(() => {
    const rows = readRoster(db, cam).filter((c) => !c.archived);
    const progress = new Map<string, Progress>(
      rows.map((r) => [r.id, readProgressCharacter(db, cam, r.id)]),
    );
    const open = openHealthCombats(db, cam),
      statuses = latestCombatStatuses(
        db,
        cam,
        rows
          .filter((r) => progress.get(r.id)!.health === null && !progress.get(r.id)!.combatStatus)
          .map((r) => r.id),
      );
    return {
      characters: rows.map((r) => {
        const p = progress.get(r.id)!,
          active = open.get(r.id);
        return {
          ...p,
          name: r.profile.name,
          active: r.active,
          membershipRevision: r.membershipRevision,
          sceneId: r.sceneId,
          ...(active
            ? {
                health: active.actor.healthKnown === false ? null : healthFromActor(active.actor),
                healthCombat: {
                  id: active.state.id,
                  sceneId: active.state.sceneId,
                  title: active.state.title,
                },
                lastCombatStatus: {
                  tempHp: active.actor.tempHp,
                  conditions: active.actor.conditions,
                  concentrating: active.actor.concentrating,
                },
              }
            : p.health === null && p.combatStatus
              ? { lastCombatStatus: p.combatStatus }
              : statuses.has(r.id)
                ? { lastCombatStatus: statuses.get(r.id) }
                : {}),
        };
      }),
      notices: db
        .prepare(
          'SELECT n.id,n.character_id AS characterId,n.text FROM progress_notice n JOIN roster_member m ON m.campaign_id=n.campaign_id AND m.id=n.character_id WHERE n.campaign_id=? AND n.delivered=0 AND m.active=1 ORDER BY n.rowid',
        )
        .all(cam),
    };
  })();
}
function checkedCursor(after: string | null) {
  if (
    after !== null &&
    (typeof after !== 'string' ||
      !/^[1-9][0-9]{0,15}$/.test(after) ||
      !Number.isSafeInteger(Number(after)))
  )
    throw new Error('Ungültige Listenseite.');
  return after === null ? null : Number(after);
}
function checkedTreasure(t: Treasure): Treasure {
  const id = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  const reference = (r: Treasure['items'][number]['reference']) =>
    r &&
    r.kind === 'authored' &&
    id(r.definitionId) &&
    Number.isSafeInteger(r.revision) &&
    r.revision > 0 &&
    (r.historicalDefinitionId === undefined || id(r.historicalDefinitionId));
  if (
    !t ||
    !id(t.id) ||
    !Number.isSafeInteger(t.revision) ||
    t.revision < 1 ||
    typeof t.title !== 'string' ||
    t.title.length > 1000 ||
    !Array.isArray(t.items) ||
    [t.sceneId, t.locationId, t.combatId].some((v) => v !== null && !id(v)) ||
    [t.sourceNoteId, t.awardId].some((v) => v !== undefined && !id(v))
  )
    throw new Error('Schatzbeschreibung oder Zuordnung widersprüchlich.');
  const seen = new Set<string>();
  for (const i of t.items) {
    if (
      !i ||
      !id(i.id) ||
      seen.has(i.id) ||
      !reference(i.reference) ||
      typeof i.name !== 'string' ||
      i.name.length > 1000 ||
      !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(i.category) ||
      !Number.isSafeInteger(i.quantity) ||
      i.quantity < 0 ||
      !Number.isSafeInteger(i.allocated) ||
      i.allocated < 0 ||
      i.allocated > i.quantity ||
      (i.unitCopper !== null &&
        (typeof i.unitCopper !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(i.unitCopper)))
    )
      throw new Error('Schatzlos oder vergebene Menge widersprüchlich.');
    const o = i.origin;
    if (
      o !== undefined &&
      (!o ||
        !id(o.treasureId) ||
        !id(o.itemId) ||
        [o.sceneId, o.locationId, o.combatId].some((v) => v !== null && !id(v)) ||
        [o.sourceNoteId, o.awardId].some((v) => v !== undefined && !id(v)))
    )
      throw new Error('Schatzlosherkunft ungültig.');
    seen.add(i.id);
  }
  return t;
}
export function checkedTreasureRow(row: any): Treasure {
  const t = checkedTreasure(decoded<Treasure>(row));
  if (t.id !== row.id || t.revision !== row.revision)
    throw new Error('Beutezuordnung widersprüchlich.');
  return t;
}
export function readTreasure(db: any, cam: string, id: string): Treasure {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, id),
      value = checkedTreasureRow(row);
    const definitions = new Map<string, ReturnType<typeof readItemDefinition>>();
    for (const item of value.items) {
      let definition = definitions.get(item.reference.definitionId);
      if (!definition) {
        definition = readItemDefinition(db, item.reference.definitionId);
        definitions.set(definition.id, definition);
      }
      item.currentDefinition = definition;
    }
    return value;
  })();
}
export function readTreasures(
  db: any,
  cam: string,
  after: string | null,
  q: TreasureQuery = { search: '', anchor: 'all' },
): TreasurePage {
  if (
    !q ||
    typeof q.search !== 'string' ||
    q.search.length > 1000 ||
    !['all', 'inbox', 'scene', 'location'].includes(q.anchor) ||
    (q.anchorId !== undefined &&
      (typeof q.anchorId !== 'string' || !q.anchorId || q.anchorId.length > 1000)) ||
    (q.remainingOnly !== undefined && typeof q.remainingOnly !== 'boolean')
  )
    throw new Error('Schatzsuche und Zuordnungsfilter prüfen.');
  const cursor = checkedCursor(after),
    needle = q.search.toLocaleLowerCase(),
    items: TreasurePage['items'] = [];
  let last: string | null = null,
    more = false;
  const labels = new Map<string, ReturnType<typeof treasureAnchorLabel>>();
  for (const row of db
    .prepare(
      'SELECT rowid AS cursor,* FROM treasure WHERE campaign_id=? AND (? IS NULL OR rowid<?) ORDER BY rowid DESC',
    )
    .iterate(cam, cursor, cursor)) {
    const t = checkedTreasureRow(row),
      anchor = treasureAnchor(t),
      key = anchor.kind === 'unplaced' ? 'unplaced' : anchor.kind + ':' + anchor.id;
    let label = labels.get(key);
    if (!label) {
      label = treasureAnchorLabel(db, cam, anchor);
      labels.set(key, label);
    }
    const available = t.items.reduce((sum, i) => sum + i.quantity - i.allocated, 0);
    if (
      (q.anchor === 'inbox' && anchor.kind !== 'unplaced' && label.available) ||
      (['scene', 'location'].includes(q.anchor) &&
        (anchor.kind !== q.anchor ||
          (q.anchorId && ('id' in anchor ? anchor.id : null) !== q.anchorId))) ||
      (q.remainingOnly && !available) ||
      (needle && ![t.title, label.name].some((v) => v.toLocaleLowerCase().includes(needle)))
    )
      continue;
    if (items.length === 25) {
      more = true;
      break;
    }
    items.push({
      id: t.id,
      title: t.title,
      revision: t.revision,
      available,
      anchor,
      anchorLabel: label.name,
      anchorAvailable: label.available,
    });
    last = String(row.cursor);
  }
  return { items, next: more ? last : null };
}

function validateLedgerItem(l: LedgerItem) {
  const text = (v: unknown, max: number, nonempty = false) =>
    typeof v === 'string' && v.length <= max && (!nonempty || !!v.trim());
  const id = (v: unknown) => text(v, 1000, true),
    price = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(v);
  if (
    !l ||
    !id(l.id) ||
    !id(l.characterId) ||
    !Number.isSafeInteger(l.revision) ||
    l.revision < 1 ||
    !text(l.name, 1000, true) ||
    !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(l.category) ||
    !Number.isSafeInteger(l.quantity) ||
    l.quantity < 0 ||
    l.quantity > 1000000 ||
    !['award', 'purchase', 'manual', 'transfer'].includes(l.origin) ||
    !['received', 'sold', 'given'].includes(l.status) ||
    !text(l.counterparty, 10000) ||
    !text(l.recordedAt, 1000, true)
  )
    throw new Error(
      'Persönlicher Beuteeintrag hat eine ungültige Beschreibung, Menge oder Herkunft.',
    );
  if (
    !l.reference ||
    l.reference.kind !== 'authored' ||
    !id(l.reference.definitionId) ||
    !Number.isSafeInteger(l.reference.revision) ||
    l.reference.revision < 1 ||
    (l.reference.historicalDefinitionId !== undefined && !id(l.reference.historicalDefinitionId))
  )
    throw new Error('Gegenstandsreferenz im Beuteeintrag ungültig.');
  if (
    (l.unitCopper !== null && !price(l.unitCopper)) ||
    (l.actualSaleCopper !== null && !price(l.actualSaleCopper)) ||
    (l.paidCopper !== undefined && !price(l.paidCopper)) ||
    (l.status !== 'sold' && l.actualSaleCopper !== null)
  )
    throw new Error('Aufgezeichneter Beutewert oder Handelspreis ungültig.');
  for (const key of ['treasureId', 'combatId', 'sceneId', 'locationId', 'parentId'] as const)
    if (l[key] !== null && !id(l[key])) throw new Error('Beuteverknüpfung ungültig.');
  if (
    l.parentId === l.id ||
    (l.instantMs !== null &&
      (typeof l.instantMs !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(l.instantMs)))
  )
    throw new Error('Beuteherkunft oder aufgezeichnete Zeit ungültig.');
  if (l.instanceId !== undefined && l.instanceId !== null && (!id(l.instanceId) || l.quantity > 1))
    throw new Error(
      'Einzelstück im persönlichen Bestand benötigt eine eindeutige Identität und höchstens Menge eins.',
    );
  if (
    l.counterpartyLink &&
    (!['shop', 'npc', 'location', 'faction'].includes(l.counterpartyLink.kind) ||
      !id(l.counterpartyLink.id))
  )
    throw new Error('Empfängerverknüpfung prüfen.');
  for (const field of [
    'sourceNoteId',
    'awardId',
    'mergeTargetId',
    'rewardCreditId',
    'sourceTreasureId',
    'sourceTreasureItemId',
  ] as const)
    if (l[field] !== undefined && !id(l[field])) throw new Error('Beuteherkunft prüfen.');
  const c = l.counterpartyReference;
  if (
    (c &&
      (!id(c.shopId) ||
        !c.owner ||
        !['npc', 'location'].includes(c.owner.kind) ||
        !id(c.owner.id))) ||
    (c !== undefined && !c)
  )
    throw new Error('Aufgezeichnete Handelsbeziehung ungültig.');
}
export function checkedLedgerRow(row: any): LedgerItem {
  const item = decoded<LedgerItem>(row);
  validateLedgerItem(item);
  if (item.id !== row.id || item.characterId !== row.character_id || item.revision !== row.revision)
    throw new Error('Beuteeintrag gehört nicht zu seiner Figur oder Revision.');
  return item;
}
export function readLedgerDefinition(db: any, item: LedgerItem) {
  const pinned = readItemDefinition(db, ledgerDefinitionId(item), item.reference.revision);
  if (
    pinned.name !== item.name ||
    pinned.category !== item.category ||
    pinned.unitCopper !== item.unitCopper
  )
    throw new Error(
      'Persönlicher Beuteeintrag widerspricht seiner aufgezeichneten Gegenstandsrevision.',
    );
  return readItemDefinition(db, item.reference.definitionId);
}
function ledgerView(db: any, item: LedgerItem) {
  const definition = readLedgerDefinition(db, item);
  item.currentName = definition.name;
  item.currentUnitCopper = definition.unitCopper;
  return item;
}
function ledgerSource(
  db: any,
  cam: string,
  item: LedgerItem,
  titles?: Map<string, string | undefined>,
): LedgerItem {
  const id = item.sourceTreasureId ?? item.treasureId;
  if (!id) return item;
  if (titles?.has(id)) {
    const title = titles.get(id);
    if (title !== undefined) item.sourceTitle = title;
    return item;
  }
  // A missing historical source must not hide a valid personal grant.
  try {
    const row = db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, id);
    if (row) item.sourceTitle = checkedTreasureRow(row).title;
  } catch {}
  titles?.set(id, item.sourceTitle);
  return item;
}
export function readLedgerItem(db: any, cam: string, id: string): LedgerItem {
  const item = checkedLedgerRow(
    db.prepare('SELECT * FROM character_ledger WHERE campaign_id=? AND id=?').get(cam, id),
  );
  readLedgerDefinition(db, item);
  if (item.origin === 'transfer' && !item.rewardCreditId)
    item.rewardCreditId = transferCredit(db, cam, item);
  if (item.origin !== 'transfer' && item.status === 'given' && item.recipientCharacterId)
    item.creditedCopper = transferredValue(db, cam, item)?.toString() ?? null;
  return item;
}
export function readLedgerDetail(db: any, cam: string, id: string) {
  return ledgerSource(db, cam, readLedgerItem(db, cam, id));
}
// Older transfers already record their parent chain. Resolve it lazily so old
// campaign histories keep their bytes and receipts while new portions carry a stable credit.
function transferCredit(db: any, cam: string, item: LedgerItem): string {
  let current = item;
  const seen = new Set<string>();
  while (current.origin === 'transfer') {
    if (current.rewardCreditId) return current.rewardCreditId;
    if (!current.parentId || seen.has(current.id))
      throw new Error('Weitergabeherkunft nicht verfügbar.');
    seen.add(current.id);
    current = checkedLedgerRow(
      db
        .prepare('SELECT * FROM character_ledger WHERE campaign_id=? AND id=?')
        .get(cam, current.parentId),
    );
  }
  return current.id;
}
function transferredValue(
  db: any,
  cam: string,
  root: LedgerItem,
  quantityOnly = false,
): bigint | null {
  let total = 0n;
  // A transferred stack stays credited to its first handout. Quantity is counted
  // only at its current holder, or by the final sale/gift, never at intermediate handouts.
  const sql = `WITH RECURSIVE descendants(id) AS (
 SELECT id FROM character_ledger WHERE campaign_id=? AND id=?
 UNION SELECT l.id FROM character_ledger l JOIN descendants d ON CASE WHEN json_valid(l.payload) THEN json_extract(l.payload,'$.parentId') END=d.id WHERE l.campaign_id=?
 ) SELECT l.* FROM character_ledger l WHERE l.campaign_id=? AND (l.id IN (SELECT id FROM descendants) OR CASE WHEN json_valid(l.payload) THEN json_extract(l.payload,'$.rewardCreditId') END=?)`;
  for (const row of db.prepare(sql).iterate(cam, root.id, cam, cam, root.id)) {
    const item = checkedLedgerRow(row);
    if (item.origin !== 'transfer' || (item.status === 'given' && item.recipientCharacterId))
      continue;
    if (transferCredit(db, cam, item) !== root.id) continue;
    item.currentUnitCopper = readLedgerDefinition(db, item).unitCopper;
    const value = quantityOnly ? BigInt(item.quantity) : ledgerCopper(item);
    if (value === null) return null;
    total += value;
  }
  return total;
}
// One current reward valuation for the personal ledger and cross-character balance.
export function ledgerRewardQuantity(db: any, cam: string, item: LedgerItem): number {
  readLedgerDefinition(db, item);
  if (item.origin === 'purchase' || item.origin === 'transfer') return 0;
  const quantity =
    item.status === 'given' && item.recipientCharacterId
      ? Number(transferredValue(db, cam, item, true))
      : item.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error('Erhaltene Gegenstandsmenge nicht verfügbar.');
  return quantity;
}
export function ledgerRewardValue(db: any, cam: string, item: LedgerItem): bigint | null {
  const definition = readLedgerDefinition(db, item);
  item.currentName = definition.name;
  item.currentUnitCopper = definition.unitCopper;
  if (item.origin === 'transfer') item.rewardCreditId = transferCredit(db, cam, item);
  if (item.origin === 'purchase' || item.origin === 'transfer') return 0n;
  const value =
    item.status === 'given' && item.recipientCharacterId
      ? transferredValue(db, cam, item)
      : ledgerCopper(item);
  if (item.status === 'given' && item.recipientCharacterId)
    item.creditedCopper = value?.toString() ?? null;
  return value;
}
export function readLedger(db: any, cam: string, query: LedgerQuery): LedgerPage {
  return db.transaction(() => {
    if (
      !query ||
      typeof query.search !== 'string' ||
      query.search.length > 1000 ||
      !['', 'received', 'sold', 'given'].includes(query.status)
    )
      throw new Error('Ungültige Beutesuche.');
    const cursor = checkedCursor(query.after),
      needle = query.search.toLocaleLowerCase(),
      sourceTitles = new Map<string, string | undefined>();
    readProgressCharacter(db, cam, query.characterId);
    const items: LedgerItem[] = [],
      problems: LedgerPage['problems'] = [];
    let next: string | null = null,
      total = 0n,
      hasMore = false,
      valueKnown = true,
      shown = 0,
      unavailableCount = 0;
    // Evaluate all required units for the total; share fifty page slots between
    // healthy matches and explicit problems. Unreadable fields cannot be filtered.
    for (const row of db
      .prepare(
        'SELECT rowid AS cursor,* FROM character_ledger WHERE campaign_id=? AND character_id=? ORDER BY rowid DESC',
      )
      .iterate(cam, query.characterId)) {
      const onPage = cursor === null || row.cursor < cursor;
      try {
        const item = checkedLedgerRow(row),
          value = ledgerRewardValue(db, cam, item);
        if (item.origin !== 'purchase' && item.origin !== 'transfer') {
          if (value === null) valueKnown = false;
          else total += value;
        }
        if (onPage && (!query.status || query.status === item.status)) {
          if (needle) {
            ledgerSource(db, cam, item, sourceTitles);
            if (
              !(
                item.name +
                ' ' +
                item.currentName +
                ' ' +
                item.counterparty +
                ' ' +
                (item.sourceTitle ?? '')
              )
                .toLocaleLowerCase()
                .includes(needle)
            )
              continue;
          }
          if (shown < 50) {
            items.push(ledgerSource(db, cam, item, sourceTitles));
            shown++;
            next = String(row.cursor);
          } else hasMore = true;
        }
      } catch (error) {
        unavailableCount++;
        valueKnown = false;
        if (onPage) {
          if (shown < 50) {
            problems.push({
              id: row.id,
              message: (error instanceof Error
                ? error.message
                : 'Beuteeintrag nicht verfügbar.'
              ).slice(0, 1000),
            });
            shown++;
            next = String(row.cursor);
          } else hasMore = true;
        }
      }
    }
    return {
      items,
      problems,
      unavailableCount,
      next: hasMore ? next : null,
      totalCopper: valueKnown ? total.toString() : null,
    };
  })();
}
export function readLedgerInventory(
  db: any,
  cam: string,
  query: LedgerInventoryQuery,
): LedgerInventoryPage {
  return db.transaction(() => {
    if (
      !query ||
      typeof query.characterId !== 'string' ||
      !query.characterId ||
      query.characterId.length > 1000
    )
      throw new Error('Ungültige Inventarfigur.');
    const cursor = checkedCursor(query.after);
    if (
      !db
        .prepare('SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?')
        .get(cam, query.characterId)
    )
      throw new Error('Inventarfigur gehört nicht zu dieser Kampagne.');
    const sql =
      'SELECT rowid AS cursor,* FROM character_ledger WHERE campaign_id=? AND character_id=?' +
      (cursor === null ? '' : ' AND rowid<?') +
      ' ORDER BY rowid DESC LIMIT 51';
    const rows = db.prepare(sql).all(cam, query.characterId, ...(cursor === null ? [] : [cursor])),
      page = rows.slice(0, 50),
      items: LedgerItem[] = [],
      problems: LedgerPage['problems'] = [];
    for (const row of page)
      try {
        const item = checkedLedgerRow(row);
        if (item.status !== 'received' || item.quantity === 0) continue;
        items.push(ledgerView(db, item));
      } catch (error) {
        problems.push({
          id: row.id,
          message: (error instanceof Error ? error.message : 'Beuteeintrag nicht verfügbar.').slice(
            0,
            1000,
          ),
        });
      }
    return {
      items,
      problems,
      visited: page.length,
      next: rows.length > 50 ? String(page[49].cursor) : null,
    };
  })();
}
export function readProgressHistory(
  db: any,
  cam: string,
  characterId: string,
  after: string | null,
) {
  readProgressCharacter(db, cam, characterId);
  if (after !== null && !/^[1-9][0-9]{0,15}$/.test(after))
    throw new Error('Ungültige Verlaufseite.');
  const rows = db
    .prepare(
      'SELECT rowid AS cursor,* FROM progress_event WHERE campaign_id=? AND character_id=? AND (? IS NULL OR rowid<?) ORDER BY rowid DESC LIMIT 51',
    )
    .all(cam, characterId, after, after);
  const page = rows.slice(0, 50);
  return {
    items: page.map((r: any) => ({
      id: r.id,
      kind: r.kind,
      facts: decoded<Record<string, any>>(r),
    })),
    next: rows.length > 50 ? String(page[49].cursor) : null,
  };
}
export function readLootBalance(db: any, cam: string) {
  return db.transaction(() => {
    const members = readRoster(db, cam).filter((c) => !c.archived);
    const totals = new Map<string, bigint>(),
      unknown = new Map<string, number>();
    for (const m of members) {
      totals.set(m.id, 0n);
      unknown.set(m.id, 0);
    }
    for (const row of db
      .prepare('SELECT * FROM character_ledger WHERE campaign_id=?')
      .iterate(cam)) {
      if (!totals.has(row.character_id)) continue;
      try {
        const item = checkedLedgerRow(row),
          value = ledgerRewardValue(db, cam, item);
        if (value === null) unknown.set(item.characterId, (unknown.get(item.characterId) ?? 0) + 1);
        else totals.set(item.characterId, (totals.get(item.characterId) ?? 0n) + value);
      } catch {
        unknown.set(row.character_id, (unknown.get(row.character_id) ?? 0) + 1);
      }
    }
    const leader = [...totals.values()].reduce((a, b) => (a > b ? a : b), 0n);
    const characters = members.map((m) => ({
      characterId: m.id,
      name: m.profile.name,
      active: m.active,
      copper: (totals.get(m.id) ?? 0n).toString(),
      unknownEntries: unknown.get(m.id) ?? 0,
      gapCopper: (leader - (totals.get(m.id) ?? 0n)).toString(),
    }));
    return {
      characters,
      leaderCopper: leader.toString(),
      suggestedCharacterIds: lootBalanceSuggestions(characters, leader.toString()),
    };
  })();
}
export function checkedItemInput(input: ItemInput) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 1000 ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 1000000 ||
    !['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(input.category)
  )
    throw new Error('Beute benötigt Name, Kategorie und positive ganze Menge.');
  if (
    input.reference &&
    (typeof input.reference !== 'object' ||
      Array.isArray(input.reference) ||
      input.reference.kind !== 'authored' ||
      typeof input.reference.definitionId !== 'string' ||
      !input.reference.definitionId.trim() ||
      !Number.isSafeInteger(input.reference.revision) ||
      input.reference.revision < 1)
  )
    throw new Error('Gegenstandsreferenz prüfen.');
  if (!input.reference) copper(input.valueGold);
  return input;
}
export function validateItemInput(db: any, input: ItemInput) {
  checkedItemInput(input);
  if (input.reference) {
    const d = readItemDefinition(db, input.reference.definitionId);
    if (d.trashed || d.revision !== input.reference.revision)
      throw new Error('Gegenstandsdefinition geändert oder im Papierkorb.');
    return d;
  }
  return null;
}
export function checkedItem(db: any, input: ItemInput) {
  const definition = validateItemInput(db, input);
  if (definition)
    return {
      id: randomUUID(),
      reference: {
        kind: 'authored' as const,
        definitionId: definition.id,
        revision: definition.revision,
      },
      name: definition.name,
      category: definition.category,
      quantity: input.quantity,
      allocated: 0,
      unitCopper: definition.unitCopper,
    };
  const id = randomUUID(),
    unitCopper = copper(input.valueGold);
  db.prepare('INSERT INTO authored_item VALUES(?,1,?,?,?)').run(
    id,
    input.name,
    input.category,
    unitCopper,
  );
  recordItemDefinitionVersion(db, readItemDefinition(db, id));
  return {
    id: randomUUID(),
    reference: { kind: 'authored' as const, definitionId: id, revision: 1 },
    name: input.name,
    category: input.category,
    quantity: input.quantity,
    allocated: 0,
    unitCopper,
  };
}
export function saveTreasure(db: any, cam: string, t: Treasure) {
  checkedTreasure(t);
  const stored = {
    ...t,
    items: t.items.map((i) => {
      const s = { ...i };
      delete s.currentDefinition;
      return s;
    }),
  };
  const payload = json(stored);
  db.prepare(
    'INSERT INTO treasure VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, t.id, t.revision, payload, hash(payload));
}
export function saveLedger(db: any, cam: string, l: LedgerItem) {
  validateLedgerItem(l);
  const stored = { ...l };
  delete stored.currentName;
  delete stored.currentUnitCopper;
  delete stored.creditedCopper;
  delete stored.sourceTitle;
  const payload = json(stored);
  db.prepare(
    'INSERT INTO character_ledger VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
  ).run(cam, l.id, l.characterId, l.revision, payload, hash(payload));
}
export function makeTreasure(
  db: any,
  cam: string,
  title: string,
  sceneId: string | null,
  combatId: string | null,
  inputs: ItemInput[],
  locationId?: string,
) {
  if (
    typeof title !== 'string' ||
    title.length > 1000 ||
    !Array.isArray(inputs) ||
    inputs.length > 100
  )
    throw new Error('Ungültige Beute.');
  if (!inputs.length) return null;
  const scene = sceneId ? readLiveScene(db, cam, sceneId) : null;
  const treasure: Treasure = {
    id: randomUUID(),
    revision: 1,
    title: title || 'Beute',
    sceneId,
    locationId: locationId ?? scene?.locationId ?? null,
    combatId,
    items: inputs.map((i) => checkedItem(db, i)),
  };
  saveTreasure(db, cam, treasure);
  event(db, cam, null, 'treasure-created', { treasure });
  return treasure.id;
}
function availableRecipient(db: any, cam: string, id: string) {
  if (
    db
      .prepare(
        "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
      )
      .get(cam, id)
  )
    throw new Error('Archivierte Belohnungsempfänger zuerst wiederherstellen.');
}
export function awardXpPool(
  db: any,
  cam: string,
  pool: number,
  recipients: { characterId: string; revision: number }[],
  sourceKind: string,
  sourceId: string,
) {
  if (new Set(recipients.map((r) => r.characterId)).size !== recipients.length)
    throw new Error('XP-Empfänger dürfen nicht doppelt vorkommen.');
  const award = xpShare(pool, recipients.length);
  for (const recipient of recipients) {
    availableRecipient(db, cam, recipient.characterId);
    const p = readProgressCharacter(db, cam, recipient.characterId),
      before = structuredClone(p);
    if (p.revision !== recipient.revision)
      throw new Error('XP-Empfänger geändert. Belohnung erneut ansehen.');
    p.xp = (p.xp ?? 0) + award.share;
    xpLevel(p.xp);
    saveProgress(db, cam, p);
    notice(db, cam, p.characterId, award.share);
    event(db, cam, p.characterId, 'story-award', {
      sourceKind,
      sourceId,
      before,
      after: p,
      xp: award.share,
    });
  }
  return award;
}
export function finishCombatRewards(
  db: any,
  cam: string,
  state: CombatState,
  rewards: FinishRewards | undefined,
): CombatReward {
  const r: FinishRewards = rewards ?? {
    poolXp: 0,
    noXp: true,
    recipients: [],
    policyVersion: 'xp-ceil-2014-v1',
    loadXp: 0,
    items: [],
  };
  if (
    r.policyVersion !== 'xp-ceil-2014-v1' ||
    !Number.isSafeInteger(r.loadXp) ||
    r.loadXp < 0 ||
    !Array.isArray(r.recipients) ||
    r.recipients.length > 1000 ||
    new Set(r.recipients.map((p) => p.characterId)).size !== r.recipients.length ||
    (r.noXp && (r.poolXp !== 0 || r.recipients.length)) ||
    (!r.noXp && !r.recipients.length)
  )
    throw new Error('XP-Empfänger oder ausdrückliche Keine-XP-Entscheidung fehlen.');
  const divided = xpShare(r.poolXp, r.recipients.length),
    awardId = randomUUID();
  const participants = [
    ...new Set(state.participants.map((p) => p.characterId).filter((id): id is string => !!id)),
  ];
  const affected = [...new Set([...participants, ...r.recipients.map((p) => p.characterId)])];
  const load = xpShare(r.loadXp, participants.length).share;
  for (const id of affected) {
    availableRecipient(db, cam, id);
    const p = readProgressCharacter(db, cam, id),
      before = structuredClone(p),
      recipient = r.recipients.find((c) => c.characterId === id);
    if (recipient && recipient.revision !== p.revision)
      throw new Error('XP-Empfänger wurde geändert. Abschluss erneut ansehen.');
    if (recipient) {
      p.xp = (p.xp ?? 0) + divided.share;
      xpLevel(p.xp);
      notice(db, cam, id, divided.share);
    }
    const actor = state.participants.find((p) => p.characterId === id);
    if (actor) {
      if (actor.healthKnown === false) {
        p.health = null;
        p.combatStatus = healthStatus(actor);
      } else {
        p.health = healthFromActor(actor);
        delete p.combatStatus;
      }
      p.rest.longXp += load;
      p.rest.shortXp += load;
      if (![p.rest.longXp, p.rest.shortXp].every(Number.isSafeInteger))
        throw new Error('Rastbelastung zu groß.');
    }
    saveProgress(db, cam, p);
    event(db, cam, id, 'combat-award', {
      awardId,
      combatId: state.id,
      before,
      after: p,
      xp: recipient ? divided.share : 0,
      load: actor ? load : 0,
    });
  }
  const treasureId = makeTreasure(
    db,
    cam,
    state.title + ' · Beute',
    state.sceneId,
    state.id,
    r.items,
  );
  const result: CombatReward = {
    awardId,
    poolXp: r.poolXp,
    shareXp: divided.share,
    totalXp: divided.total,
    recipientIds: r.recipients.map((p) => p.characterId),
    treasureId,
    policyVersion: r.policyVersion,
  };
  const payload = json(result);
  db.prepare('INSERT INTO combat_award VALUES(?,?,?,?,?)').run(
    cam,
    state.id,
    awardId,
    payload,
    hash(payload),
  );
  return result;
}
function checkedCounterparty(db: any, cam: string, link: LedgerItem['counterpartyLink']) {
  if (!link) return undefined;
  let available = false;
  if (link.kind === 'location')
    available = !!db
      .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
      .get(cam, link.id);
  else if (link.kind === 'shop') {
    const r = db.prepare('SELECT payload FROM shop WHERE campaign_id=? AND id=?').get(cam, link.id);
    available = !!r && !JSON.parse(r.payload).trashed;
  } else if (['npc', 'faction'].includes(link.kind))
    available = !!db
      .prepare(
        "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0 AND json_extract(payload,'$.kind')=?",
      )
      .get(cam, link.id, link.kind);
  if (!available) throw new Error('Verknüpften Händler oder Empfänger prüfen.');
  return link;
}
function allocateTreasurePortion(
  db: any,
  cam: string,
  t: Treasure,
  a: Extract<ProgressAction, { kind: 'allocate-batch' }>['allocations'][number],
) {
  const item = t.items.find((i) => i.id === a.itemId);
  const member = db
    .prepare(
      'SELECT active,membership_revision,scene_id FROM roster_member WHERE campaign_id=? AND id=?',
    )
    .get(cam, a.characterId);
  if (!item || !member?.active || member.membership_revision !== a.expectedMembershipRevision)
    throw new Error('Beute oder Empfänger geändert. Bitte aktualisieren.');
  if (
    !Number.isSafeInteger(a.quantity) ||
    a.quantity <= 0 ||
    a.quantity > item.quantity - item.allocated
  )
    throw new Error('Menge überschreitet die unverteilte Beute.');
  const definition = readItemDefinition(db, item.reference.definitionId);
  if (definition.revision !== a.expectedDefinitionRevision || definition.trashed)
    throw new Error('Gegenstand geändert oder im Papierkorb. Beute erneut ansehen.');
  recordItemDefinitionVersion(db, definition);
  const scene = member.scene_id
    ? readLiveScene(db, cam, member.scene_id)
    : t.sceneId
      ? readLiveScene(db, cam, t.sceneId)
      : null;
  const l: LedgerItem = {
    id: randomUUID(),
    characterId: a.characterId,
    revision: 1,
    reference: { kind: 'authored', definitionId: definition.id, revision: definition.revision },
    name: definition.name,
    category: definition.category,
    quantity: a.quantity,
    unitCopper: definition.unitCopper,
    origin: 'award',
    status: 'received',
    actualSaleCopper: null,
    counterparty: '',
    treasureId: t.id,
    combatId: t.combatId,
    sceneId: scene?.id ?? t.sceneId,
    locationId: t.locationId,
    instantMs: scene?.clock.instantMs ?? null,
    recordedAt: new Date().toISOString(),
    parentId: null,
  };
  if (item.origin) {
    l.sourceNoteId = item.origin.sourceNoteId;
    l.awardId = item.origin.awardId;
    l.combatId = item.origin.combatId;
    l.sourceTreasureId = item.origin.treasureId;
    l.sourceTreasureItemId = item.origin.itemId;
    l.provenance = 'Aus verschobener Schatzbeute';
  } else {
    l.sourceNoteId = t.sourceNoteId;
    l.awardId = t.awardId;
  }
  item.allocated += a.quantity;
  saveLedger(db, cam, l);
  event(db, cam, l.characterId, 'loot-award', { treasureId: t.id, itemId: item.id, entry: l });
  return l.id;
}
export function executeProgress(db: any, command: ProgressCommand, guard: () => void): ProgressAck {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000 || !command.action)
        throw new Error('Fortschrittsauftrag fehlt.');
      const cam = command.campaignId,
        fp = hash(json({ ...command, token: undefined })),
        prior = db
          .prepare('SELECT * FROM progress_receipt WHERE command_id=?')
          .get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== cam ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('Auftragskennung bereits anders verwendet.');
        return JSON.parse(prior.payload);
      }
      const a = command.action;
      if (
        'characterId' in a &&
        db
          .prepare(
            "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
          )
          .get(cam, a.characterId)
      )
        throw new Error('Archivierte Figur zuerst wiederherstellen.');
      if ('recipients' in a && Array.isArray(a.recipients))
        for (const r of a.recipients)
          if (
            db
              .prepare(
                "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
              )
              .get(cam, r.characterId)
          )
            throw new Error('Archivierte Belohnungsempfänger zuerst wiederherstellen.');
      let groupId: string | undefined, partyAward: ProgressAck['partyAward'];
      let treasureId: string | null = null;
      const ledgerIds: string[] = [];
      const restWarnings: string[] = [];
      if (a.kind === 'party-award') {
        if (
          !Array.isArray(a.participants) ||
          !a.participants.length ||
          a.participants.length > 1000 ||
          new Set(a.participants.map((p) => p.characterId)).size !== a.participants.length ||
          typeof a.reason !== 'string' ||
          !a.reason.trim() ||
          a.reason.length > 10000
        )
          throw new Error('Figuren und einen Grund für die gemeinsame XP-Buchung wählen.');
        if (
          db.prepare('SELECT revision FROM roster_state WHERE campaign_id=?').get(cam)?.revision !==
          a.expectedRosterRevision
        )
          throw new Error('Party wurde verändert. XP-Abrechnung neu öffnen.');
        for (const r of a.participants) {
          if (
            typeof r.receiveXp !== 'boolean' ||
            typeof r.receiveLoad !== 'boolean' ||
            (!r.receiveXp && !r.receiveLoad)
          )
            throw new Error('XP- und Belastungsempfänger ausdrücklich wählen.');
          availableRecipient(db, cam, r.characterId);
          const m = db
            .prepare(
              'SELECT active,membership_revision FROM roster_member WHERE campaign_id=? AND id=?',
            )
            .get(cam, r.characterId);
          if (!m || m.membership_revision !== r.membershipRevision || (r.receiveLoad && !m.active))
            throw new Error('Belastung nur für aktuelle aktive Figuren; Partyquelle neu laden.');
        }
        const shares = partyAwardShares(
          a.poolXp,
          a.loadXp,
          a.participants.filter((p) => p.receiveXp).length,
          a.participants.filter((p) => p.receiveLoad).length,
        );
        for (const r of a.participants) {
          const p = readProgressCharacter(db, cam, r.characterId),
            before = structuredClone(p);
          if (p.revision !== r.revision)
            throw new Error('XP- oder Raststand geändert. Abrechnung neu öffnen.');
          if (r.receiveXp && a.poolXp) {
            p.xp = (p.xp ?? 0) + shares.xp.share;
            xpLevel(p.xp);
            notice(db, cam, p.characterId, shares.xp.share);
          }
          if (r.receiveLoad && a.loadXp) {
            p.rest.longXp += shares.load.share;
            p.rest.shortXp += shares.load.share;
            if (!Number.isSafeInteger(p.rest.longXp) || !Number.isSafeInteger(p.rest.shortXp))
              throw new Error('Tagesbelastung zu groß.');
          }
          saveProgress(db, cam, p);
          event(db, cam, p.characterId, 'party-award-member', {
            before,
            after: p,
            xp: r.receiveXp ? shares.xp.share : 0,
            load: r.receiveLoad ? shares.load.share : 0,
            reason: a.reason,
            commandId: command.commandId,
          });
        }
        partyAward = {
          poolXp: a.poolXp,
          loadXp: a.loadXp,
          shareXp: shares.xp.share,
          totalXp: shares.xp.total,
          shareLoad: shares.load.share,
          totalLoad: shares.load.total,
        };
        event(
          db,
          cam,
          null,
          'party-award',
          {
            ...partyAward,
            reason: a.reason,
            recipientIds: a.participants.filter((p) => p.receiveXp).map((p) => p.characterId),
            loadedIds: a.participants.filter((p) => p.receiveLoad).map((p) => p.characterId),
          },
          command.commandId,
        );
      } else if (a.kind === 'narrative-state') {
        const current = readNarrative(db, cam, a.state.noteId);
        if (
          current.state.revision !== a.expectedRevision ||
          current.noteRevision !== a.expectedNoteRevision
        )
          throw new Error('Narrative Notiz oder Belohnung geändert.');
        validateNarrativeState(db, cam, a.state);
        for (const i of a.state.items) {
          copper(i.valueGold);
          if (!['coins', 'equipment', 'trade-goods', 'magic', 'other'].includes(i.category))
            throw new Error('Gegenstandskategorie prüfen.');
        }
        consumeNarrativeDraft(db, cam, a.state.noteId, a.draftWriteId, {
          revision: a.expectedRevision,
          noteRevision: a.expectedNoteRevision,
        });
        const state = {
          ...structuredClone(a.state),
          revision: current.state.revision + 1,
          awardId: current.state.awardId,
        };
        saveNarrative(db, cam, state);
        event(db, cam, null, 'narrative-state', {
          title: narrativeNote(db, cam, a.state.noteId).title,
          before: current.state,
          after: state,
        });
      } else if (a.kind === 'narrative-award') {
        consumeFinishDraft(
          db,
          cam,
          {
            kind: 'narrative',
            targetId: a.noteId,
            revision: a.expectedRevision,
            noteRevision: a.expectedNoteRevision,
          },
          a.finishDraftWriteId,
        );
        consumeNarrativeDraft(db, cam, a.noteId, a.draftWriteId, {
          revision: a.expectedRevision,
          noteRevision: a.expectedNoteRevision,
        });
        const current = readNarrative(db, cam, a.noteId),
          note = narrativeNote(db, cam, a.noteId);
        if (
          current.state.revision !== a.expectedRevision ||
          current.noteRevision !== a.expectedNoteRevision ||
          current.state.awardId
        )
          throw new Error('Quest-/Gerüchtbelohnung geändert oder bereits vergeben.');
        if (
          typeof a.outcome !== 'string' ||
          !a.outcome.trim() ||
          a.outcome.length > 10000 ||
          !Array.isArray(a.recipients) ||
          a.recipients.length > 1000 ||
          typeof a.noXp !== 'boolean' ||
          (a.noXp && (a.poolXp !== 0 || a.recipients.length)) ||
          (!a.noXp && !a.recipients.length)
        )
          throw new Error(
            'Manuelles Ergebnis und XP-Empfänger oder ausdrücklich keine XP angeben.',
          );
        const divided = awardXpPool(db, cam, a.poolXp, a.recipients, note.kind, note.id);
        treasureId = makeTreasure(
          db,
          cam,
          note.title + ' · Belohnung',
          a.sceneId,
          null,
          a.items,
          current.state.locationId ?? undefined,
        );
        const award = {
          id: randomUUID(),
          noteId: note.id,
          title: note.title,
          sceneId: a.sceneId,
          poolXp: a.poolXp,
          shareXp: divided.share,
          recipientIds: a.recipients.map((r) => r.characterId),
          treasureId,
          outcome: a.outcome,
          recordedAt: new Date().toISOString(),
        };
        if (treasureId) {
          const t = decoded<Treasure>(
            db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, treasureId),
          );
          t.sourceNoteId = note.id;
          t.awardId = award.id;
          saveTreasure(db, cam, t);
        }
        saveNarrativeAward(db, cam, award);
        saveNarrative(db, cam, {
          ...current.state,
          revision: current.state.revision + 1,
          status: 'closed',
          awardId: award.id,
        });
        event(db, cam, null, 'narrative-award', award);
      } else if (
        a.kind === 'ledger-split' ||
        a.kind === 'ledger-merge' ||
        a.kind === 'ledger-transfer'
      ) {
        const l = readLedgerItem(db, cam, a.entryId),
          before = structuredClone(l);
        if (
          l.revision !== a.expectedRevision ||
          l.status !== 'received' ||
          typeof a.reason !== 'string' ||
          !a.reason.trim() ||
          a.reason.length > 10000
        )
          throw new Error('Verfügbaren Beuteeintrag und Grund angeben.');
        if (a.kind === 'ledger-merge') {
          const source = readLedgerItem(db, cam, a.sourceId),
            sourceBefore = structuredClone(source);
          if (
            source.id === l.id ||
            source.revision !== a.expectedSourceRevision ||
            source.quantity < 1 ||
            !ledgerStacksMatch(l, source) ||
            l.quantity + source.quantity > 1000000
          )
            throw new Error('Nur passende Mengenstapel derselben Herkunft zusammenführen.');
          l.quantity += source.quantity;
          if (l.paidCopper !== undefined && source.paidCopper !== undefined)
            l.paidCopper = (BigInt(l.paidCopper) + BigInt(source.paidCopper)).toString();
          else delete l.paidCopper;
          if (source.paidCopper !== undefined) source.paidCopper = '0';
          source.quantity = 0;
          source.mergeTargetId = l.id;
          source.revision++;
          l.revision++;
          saveLedger(db, cam, source);
          saveLedger(db, cam, l);
          event(db, cam, l.characterId, 'loot-merge', {
            before,
            sourceBefore,
            after: l,
            sourceAfter: source,
            reason: a.reason,
          });
          ledgerIds.push(l.id);
        } else {
          if (
            !Number.isSafeInteger(a.quantity) ||
            a.quantity < 1 ||
            a.quantity > l.quantity ||
            (a.kind === 'ledger-split' && (a.quantity === l.quantity || l.instanceId))
          )
            throw new Error('Eine passende Teilmenge angeben.');
          const part: LedgerItem = {
            ...l,
            id: randomUUID(),
            revision: 1,
            quantity: a.quantity,
            parentId: l.id,
            recordedAt: new Date().toISOString(),
          };
          partitionLedgerPaidPrice(l, part);
          l.quantity -= a.quantity;
          l.revision++;
          if (a.kind === 'ledger-transfer') {
            const m = db
              .prepare('SELECT membership_revision FROM roster_member WHERE campaign_id=? AND id=?')
              .get(cam, a.characterId);
            if (
              !m ||
              m.membership_revision !== a.expectedMembershipRevision ||
              a.characterId === l.characterId
            )
              throw new Error('Andere bestehende Empfängerfigur auswählen.');
            const handed = {
              ...part,
              status: 'given' as const,
              counterparty: JSON.parse(
                db
                  .prepare('SELECT payload FROM character_profile WHERE campaign_id=? AND id=?')
                  .get(cam, a.characterId).payload,
              ).name,
              recipientCharacterId: a.characterId,
              counterpartyLink: undefined,
            };
            saveLedger(db, cam, handed);
            const received = {
              ...part,
              id: randomUUID(),
              characterId: a.characterId,
              origin: 'transfer' as const,
              rewardCreditId: l.rewardCreditId ?? handed.id,
              parentId: handed.id,
              counterparty: JSON.parse(
                db
                  .prepare('SELECT payload FROM character_profile WHERE campaign_id=? AND id=?')
                  .get(cam, l.characterId).payload,
              ).name,
              sourceCharacterId: l.characterId,
              provenance: 'Weitergabe',
            };
            delete received.paidCopper;
            saveLedger(db, cam, received);
            event(db, cam, a.characterId, 'loot-transfer-received', {
              sourceId: handed.id,
              entry: received,
              reason: a.reason,
            });
            event(db, cam, l.characterId, 'loot-transfer', {
              before,
              after: l,
              handed,
              receivedId: received.id,
              reason: a.reason,
            });
            ledgerIds.push(l.id, handed.id, received.id);
          } else {
            saveLedger(db, cam, part);
            event(db, cam, l.characterId, 'loot-split', {
              before,
              after: l,
              portion: part,
              reason: a.reason,
            });
            ledgerIds.push(l.id, part.id);
          }
          saveLedger(db, cam, l);
        }
      } else if (a.kind === 'health') {
        const p = readProgressCharacter(db, cam, a.characterId),
          before = structuredClone(p);
        if (p.revision !== a.expectedRevision)
          throw new Error('HP-Stand geändert. Gespeicherten Stand laden, bevor du erneut änderst.');
        const active = openHealthCombats(db, cam).get(p.characterId);
        if (active)
          throw new Error(
            'Offene Begegnung „' + active.state.title + '“: HP im Kampftracker ändern.',
          );
        if (typeof a.reason !== 'string' || a.reason.length > 2000)
          throw new Error('HP-Grund zu lang oder ungültig.');
        if (a.operation === 'set') {
          const h = checkedHealth(a.health);
          p.health = {
            hp: h.hp,
            maxHp: h.maxHp,
            tempHp: h.tempHp,
            conditions: h.conditions,
            concentrating: h.concentrating,
          };
        } else if (a.operation === 'damage' || a.operation === 'heal') {
          if (!p.health)
            throw new Error('HP noch offen. Zuerst aktuelle und maximale HP eintragen.');
          if (!Number.isSafeInteger(a.amount) || a.amount <= 0 || a.amount > 1000000)
            throw new Error('Betrag benötigt eine positive ganze Zahl.');
          p.health =
            a.operation === 'damage'
              ? applyHealthDamage(p.health, a.amount).health
              : applyHealthHealing(p.health, a.amount);
        } else if (a.operation === 'death') {
          if (!p.health) throw new Error('Todesrettungswürfe benötigen bekannte HP.');
          p.health = applyDeathSave(p.health, a.result);
        } else throw new Error('Unbekannte HP-Aktion.');
        checkedHealth(p.health!);
        delete p.combatStatus;
        saveProgress(db, cam, p);
        event(
          db,
          cam,
          p.characterId,
          a.operation === 'death' ? 'death-save' : 'health',
          {
            operation: a.operation,
            ...('amount' in a ? { amount: a.amount } : {}),
            ...('result' in a ? { result: a.result } : {}),
            reason: a.reason,
            before,
            after: p,
          },
          command.commandId,
        );
      } else if (a.kind === 'xp') {
        const p = readProgressCharacter(db, cam, a.characterId),
          before = structuredClone(p);
        if (p.revision !== a.expectedRevision)
          throw new Error('XP-Stand geändert. Bitte aktualisieren.');
        if (
          !Number.isSafeInteger(a.amount) ||
          a.amount < 0 ||
          !['add', 'subtract', 'set'].includes(a.mode) ||
          typeof a.reason !== 'string' ||
          !a.reason.trim() ||
          a.reason.length > 10000
        )
          throw new Error('XP-Änderung benötigt einen nichtnegativen Betrag und einen Grund.');
        if (
          a.correctionOf &&
          !db
            .prepare('SELECT 1 FROM progress_event WHERE campaign_id=? AND id=? AND character_id=?')
            .get(cam, a.correctionOf, a.characterId)
        )
          throw new Error('Originaleintrag der XP-Korrektur fehlt.');
        const changed = changeCharacterXp(p, a.mode, a.amount);
        Object.assign(p, changed.after);
        saveProgress(db, cam, p);
        notice(db, cam, p.characterId, Math.max(0, changed.delta));
        event(
          db,
          cam,
          p.characterId,
          'xp',
          {
            before,
            after: p,
            reason: a.reason,
            mode: a.mode,
            requestedAmount: a.amount,
            appliedDelta: changed.delta,
            correctionOf: a.correctionOf ?? null,
          },
          command.commandId,
        );
      } else if (a.kind === 'rest') {
        if (
          (a.restoreHp !== undefined && typeof a.restoreHp !== 'boolean') ||
          (a.restoreHp && a.rest !== 'long')
        )
          throw new Error('HP-Erholung ist eine ausdrückliche Option der langen Rast.');
        if (
          !['short', 'long'].includes(a.rest) ||
          !a.recipients.length ||
          new Set(a.recipients.map((r) => r.characterId)).size !== a.recipients.length
        )
          throw new Error('Wähle Figuren für die Rast.');
        for (const recipient of a.recipients) {
          const p = readProgressCharacter(db, cam, recipient.characterId),
            before = structuredClone(p);
          if (p.revision !== recipient.revision)
            throw new Error('Raststand geändert. Bitte aktualisieren.');
          const member = db
            .prepare('SELECT active,scene_id FROM roster_member WHERE campaign_id=? AND id=?')
            .get(cam, p.characterId);
          if (!member?.active) throw new Error('Rast nur für aktive Figuren.');
          if (
            db
              .prepare(
                "SELECT 1 FROM combat WHERE campaign_id=? AND scene_id=? AND phase='running'",
              )
              .get(cam, member.scene_id)
          )
            throw new Error('Kampf vor der Rast abschließen.');
          p.rest = restAfter(p.rest, a.rest);
          if (a.restoreHp) {
            if (!p.health || p.health.hp <= 0 || p.health.death?.dead)
              restWarnings.push(p.characterId);
            else p.health.hp = p.health.maxHp;
          }
          saveProgress(db, cam, p);
          event(db, cam, p.characterId, 'rest', {
            commandId: command.commandId,
            rest: a.rest,
            before,
            after: p,
            restoreHp: a.restoreHp === true,
            ...(a.scene
              ? {
                  sceneId: a.scene.id,
                  ...(a.scene.amount !== undefined
                    ? { duration: { amount: a.scene.amount, unit: a.scene.unit } }
                    : {}),
                }
              : {}),
          });
        }
      } else if (a.kind === 'group-create' || a.kind === 'group-edit') {
        groupId = editGroup(db, cam, a);
      } else if (
        a.kind === 'treasure-create' ||
        a.kind === 'treasure-edit' ||
        a.kind === 'treasure-move' ||
        a.kind === 'treasure-anchor'
      ) {
        treasureId = editTreasury(db, cam, a);
      } else if (a.kind === 'treasure') {
        treasureId = makeTreasure(db, cam, a.title, a.sceneId, null, a.items);
      } else if (a.kind === 'allocate') {
        const t = decoded<Treasure>(
          db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, a.treasureId),
        );
        if (t.revision !== a.expectedRevision)
          throw new Error('Schatz geändert. Verteilung erneut ansehen.');
        ledgerIds.push(allocateTreasurePortion(db, cam, t, a));
        t.revision++;
        saveTreasure(db, cam, t);
        treasureId = t.id;
      } else if (a.kind === 'allocate-batch') {
        if (
          !Array.isArray(a.allocations) ||
          !a.allocations.length ||
          a.allocations.length > 1000 ||
          new Set(a.allocations.map((p) => JSON.stringify([p.itemId, p.characterId]))).size !==
            a.allocations.length
        )
          throw new Error(
            'Verteilung benötigt eindeutige Gegenstand-/Figur-Zuordnungen (höchstens 1000).',
          );
        const t = decoded<Treasure>(
          db.prepare('SELECT * FROM treasure WHERE campaign_id=? AND id=?').get(cam, a.treasureId),
        );
        if (t.revision !== a.expectedRevision)
          throw new Error('Schatz geändert. Verteilung erneut ansehen.');
        for (const portion of a.allocations) {
          if (
            db
              .prepare(
                "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
              )
              .get(cam, portion.characterId)
          )
            throw new Error('Archivierte Figur zuerst wiederherstellen.');
          ledgerIds.push(allocateTreasurePortion(db, cam, t, portion));
        }
        t.revision++;
        saveTreasure(db, cam, t);
        treasureId = t.id;
      } else if (a.kind === 'manual-item') {
        const member = db
          .prepare('SELECT membership_revision FROM roster_member WHERE campaign_id=? AND id=?')
          .get(cam, a.characterId);
        if (
          !member ||
          member.membership_revision !== a.expectedMembershipRevision ||
          !['award', 'purchase', 'manual'].includes(a.origin) ||
          typeof a.note !== 'string' ||
          a.note.length > 10000
        )
          throw new Error('Ungültiger persönlicher Beuteeintrag.');
        const item = checkedItem(db, a.item);
        const l: LedgerItem = {
          id: randomUUID(),
          characterId: a.characterId,
          revision: 1,
          reference: item.reference,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unitCopper: item.unitCopper,
          origin: a.origin,
          status: 'received',
          actualSaleCopper: null,
          counterparty: a.note,
          treasureId: null,
          combatId: null,
          sceneId: null,
          locationId: null,
          instantMs: null,
          recordedAt: new Date().toISOString(),
          parentId: null,
        };
        saveLedger(db, cam, l);
        event(db, cam, l.characterId, 'manual-loot', { entry: l });
        ledgerIds.push(l.id);
      } else if (a.kind === 'ledger') {
        const l = readLedgerItem(db, cam, a.entryId),
          before = structuredClone(l);
        ledgerIds.push(l.id);
        if (
          l.revision !== a.expectedRevision ||
          typeof a.reason !== 'string' ||
          !a.reason.trim() ||
          a.reason.length > 10000 ||
          typeof a.counterparty !== 'string' ||
          a.counterparty.length > 1000
        )
          throw new Error('Beuteänderung benötigt den aktuellen Stand und einen Grund.');
        if (a.operation === 'correct') {
          if (
            !Number.isSafeInteger(a.correctedQuantity) ||
            a.correctedQuantity! < 0 ||
            a.correctedQuantity! > 1000000
          )
            throw new Error('Korrektur benötigt eine nichtnegative Menge.');
          l.quantity = a.correctedQuantity!;
          if (a.counterpartyLink)
            l.counterpartyLink = checkedCounterparty(db, cam, a.counterpartyLink);
          if (a.counterparty.trim()) l.counterparty = a.counterparty;
          if (l.status === 'sold') l.actualSaleCopper = copper(a.actualGold);
          l.revision++;
          saveLedger(db, cam, l);
          event(db, cam, l.characterId, 'loot-correction', {
            originalId: l.id,
            before,
            after: l,
            reason: a.reason,
          });
        } else {
          if (
            !['sold', 'given'].includes(a.operation) ||
            l.status !== 'received' ||
            !Number.isSafeInteger(a.quantity) ||
            a.quantity <= 0 ||
            a.quantity > l.quantity
          )
            throw new Error('Verkauf/Weitergabe benötigt eine verfügbare Teilmenge.');
          const part: LedgerItem = {
            ...l,
            id: randomUUID(),
            revision: 1,
            quantity: a.quantity,
            status: a.operation,
            actualSaleCopper: a.operation === 'sold' ? copper(a.actualGold) : null,
            counterparty: a.counterparty,
            parentId: l.id,
            recordedAt: new Date().toISOString(),
            counterpartyLink: checkedCounterparty(db, cam, a.counterpartyLink),
          };
          partitionLedgerPaidPrice(l, part);
          l.quantity -= a.quantity;
          l.revision++;
          saveLedger(db, cam, l);
          saveLedger(db, cam, part);
          event(db, cam, l.characterId, `loot-${a.operation}`, {
            originalId: l.id,
            before,
            after: l,
            portion: part,
            reason: a.reason,
          });
          ledgerIds.push(part.id);
        }
      } else if (a.kind === 'notice') {
        if (!Array.isArray(a.ids) || a.ids.length > 1000) throw new Error('Ungültige Hinweise.');
        for (const id of a.ids)
          db.prepare(
            'UPDATE progress_notice SET delivered=1 WHERE campaign_id=? AND id=? AND character_id IN(SELECT id FROM roster_member WHERE campaign_id=? AND active=1)',
          ).run(cam, id, cam);
      } else throw new Error('Unbekannte Fortschrittsaktion.');
      syncOpenMaskHealth(db, cam);
      const current = readProgress(db, cam),
        result: ProgressAck = {
          ...current,
          ...(partyAward ? { partyAward } : {}),
          treasureId,
          ...(groupId ? { groupId } : {}),
          ledgerIds,
          ...(restWarnings.length
            ? {
                restWarnings: restWarnings.map(
                  (id) =>
                    (current.characters.find((c) => c.characterId === id)?.name ?? 'Figur') +
                    ': HP bleiben unverändert (unbekannt oder 0 HP).',
                ),
              }
            : {}),
        },
        payload = json(result);
      db.prepare('INSERT INTO progress_receipt VALUES(?,?,?,?,?)').run(
        command.commandId,
        cam,
        fp,
        payload,
        hash(payload),
      );
      return result;
    })
    .immediate();
}

interface ExecuteProgressContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  executeLive: (command: import('./../runtime/live-contracts').LiveCommand) => any;
}
export function storedExecuteProgress(
  db: any,
  context: ExecuteProgressContext,
  command: ProgressCommand,
): any {
  return db
    .transaction(() => {
      context.guard(command.token, command.campaignId);
      const a = command.action,
        guard = () => {
          context.guard(command.token, command.campaignId);
        };
      if (
        a.kind !== 'rest' ||
        !a.scene ||
        db.prepare('SELECT 1 FROM progress_receipt WHERE command_id=?').get(command.commandId)
      )
        return executeProgress(db, command, guard);
      const current = readLive(db, command.campaignId),
        scene = current.scene;
      if (
        !scene ||
        scene.id !== a.scene.id ||
        current.focusRevision !== a.scene.expectedFocusRevision ||
        scene.membershipRevision !== a.scene.expectedMembershipRevision ||
        scene.clock.revision !== a.scene.expectedClockRevision ||
        scene.retired
      )
        throw new Error('Rastgruppe oder Szenenzeit geändert. Aktuellen Spieltisch laden.');
      if (!a.recipients.every((r) => scene.members.includes(r.characterId)))
        throw new Error('Rast nur mit Figuren dieser Szene.');
      if ((a.scene.amount === undefined) !== (a.scene.unit === undefined))
        throw new Error('Rastdauer und Zeiteinheit gemeinsam angeben.');
      // Scene ownership is required even when the user deliberately keeps time.
      if (a.scene.amount === undefined) return executeProgress(db, command, guard);
      if (
        db
          .prepare("SELECT 1 FROM chase WHERE campaign_id=? AND scene_id=? AND status='running'")
          .get(command.campaignId, scene.id)
      )
        throw new Error('Verfolgung vor der zeitgebundenen Rast abschließen.');
      const result = executeProgress(db, command, guard),
        clock = context.executeLive({
          commandId: command.commandId + '|rest-clock',
          campaignId: command.campaignId,
          token: command.token,
          action: {
            kind: 'advance-clock',
            sceneId: scene.id,
            expectedRevision: a.scene.expectedClockRevision,
            amount: a.scene.amount,
            unit: a.scene.unit,
            calendarVersion: 'relative-v1',
            reason:
              (a.rest === 'long' ? 'Lange' : 'Kurze') +
              ' Rast · ' +
              a.recipients.length +
              ' Figuren',
          },
        });
      result.restScene = clock.scene;
      const payload = json(result);
      db.prepare('UPDATE progress_receipt SET payload=?,checksum=? WHERE command_id=?').run(
        payload,
        hash(payload),
        command.commandId,
      );
      return result;
    })
    .immediate();
}
