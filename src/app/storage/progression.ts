import { checkedPreparedGroupValue } from './prepared-group';
import { checkedTreasureValue } from './progression-records';
import { checkedProgressValue } from './progression-records';
import { checkedCombatant } from '../runtime/combat-contracts';
import { checkedCharacterProfile } from '../runtime/live-contracts';
import { storedPayload } from './stored-payload';
import { checkedQuery, checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
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
  checkedNarrativeState,
} from './narrative';
import { randomUUID } from 'node:crypto';
import {
  applyDeathSave,
  applyHealthDamage,
  applyHealthHealing,
  checkedHealth,
  checkedHealthStatus,
  copper,
  ledgerStacksMatch,
  lootBalanceSuggestions,
  partitionLedgerPaidPrice,
  restAfter,
  xpLevel,
  xpShare,
  type CombatReward,
  type FinishRewards,
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
import { readLive, readLiveScene, readRoster } from './live-read';
import { readItemDefinition, recordItemDefinitionVersion } from './item-definitions';
import {
  json,
  hash,
  readProgressCharacter,
  checkedLedgerRow,
  checkedTreasureRow,
  saveProgress,
  event,
  readLedgerDefinition,
  transferCredit,
  transferredValue,
  ledgerRewardValue,
  validateLedgerItem,
  availableRecipient,
  notice,
  makeTreasure,
  awardXpPool,
  saveTreasure,
  checkedItem,
} from './progression-records';
export {
  readProgressCharacter,
  saveProgress,
  event,
  checkedTreasureRow,
  readTreasure,
  checkedLedgerRow,
  readLedgerDefinition,
  ledgerRewardQuantity,
  ledgerRewardValue,
  checkedItemInput,
  validateItemInput,
  checkedItem,
  saveTreasure,
  makeTreasure,
  awardXpPool,
} from './progression-records';
export function installProgressSchema(db: SqliteDatabase) {
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
export { createProgress } from './progression-records';

export function validateProgressBackup(db: SqliteDatabase) {
  for (const row of checkedQuery(db, 'SELECT campaign_id,id FROM character_progress', {
    campaign_id: 'text',
    id: 'text',
  }).iterate())
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
      } else if (table === 'progress_event') checkedProgressEvent(row);
      else if (table === 'progress_receipt') checkedProgressReceipt(row);
      else checkedCombatAward(row);
    }
  }
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
  db: SqliteDatabase,
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
  db: SqliteDatabase,
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
  const member = checkedQuery(
    db,
    'SELECT active,scene_id FROM roster_member WHERE campaign_id=? AND id=?',
    { active: 'integer', scene_id: 'nullable-text' },
  ).get(cam, actor.characterId);
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

function storedCombat(value: unknown): CombatState {
  const row = checkedRow(value, {
    id: 'text',
    scene_id: 'text',
    phase: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  });
  const state = checkedCombat(decodeStored(row, shape.combat));
  if (state.id !== row.id || state.sceneId !== row.scene_id || state.phase !== row.phase)
    throw new Error('Kampfzuordnung widersprüchlich.');
  return state;
}

export function latestCombatStatuses(db: SqliteDatabase, cam: string, ids: Iterable<string>) {
  const missing = new Set(ids),
    statuses = new Map<
      string,
      Pick<NonNullable<Progress['health']>, 'tempHp' | 'conditions' | 'concentrating'>
    >();
  if (missing.size)
    for (const row of checkedQuery(
      db,
      "SELECT * FROM combat WHERE campaign_id=? AND phase='finished' ORDER BY ordinal DESC",
      {
        campaign_id: 'text',
        id: 'text',
        scene_id: 'text',
        ordinal: 'integer',
        revision: 'integer',
        phase: 'text',
        payload: 'text',
        checksum: 'text',
      },
    ).iterate(cam)) {
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

function openHealthCombats(db: SqliteDatabase, cam: string) {
  const actors = new Map<
    string,
    { state: CombatState; actor: CombatState['participants'][number] }
  >();
  for (const row of checkedQuery(
    db,
    "SELECT * FROM combat WHERE campaign_id=? AND phase IN('preparing','running') ORDER BY ordinal DESC",
    {
      campaign_id: 'text',
      id: 'text',
      scene_id: 'text',
      ordinal: 'integer',
      revision: 'integer',
      phase: 'text',
      payload: 'text',
      checksum: 'text',
    },
  ).iterate(cam)) {
    const state = storedCombat(row);
    for (const actor of state.participants)
      if (actor.characterId) {
        if (!actors.has(actor.characterId)) actors.set(actor.characterId, { state, actor });
      }
  }
  return actors;
}

export function lastCombatPartyParticipant(
  db: SqliteDatabase,
  cam: string,
  state: CombatState,
  characterId: string,
) {
  for (const row of checkedQuery(
    db,
    "SELECT * FROM progress_event WHERE campaign_id=? AND character_id=? AND kind IN ('combat-exit','combat-entry','combat-return') ORDER BY rowid DESC",
    {
      campaign_id: 'text',
      id: 'text',
      character_id: 'nullable-text',
      kind: 'text',
      payload: 'text',
      checksum: 'text',
    },
  ).iterate(cam, characterId)) {
    const facts = checkedProgressEvent(row);
    if (!('combatId' in facts) || !('participant' in facts))
      throw new Error('Kampfverlauf hat ungültige Fakten.');
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

export function readProgress(db: SqliteDatabase, cam: string): ProgressView {
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
      notices: checkedQuery(
        db,
        'SELECT n.id,n.character_id AS characterId,n.text FROM progress_notice n JOIN roster_member m ON m.campaign_id=n.campaign_id AND m.id=n.character_id WHERE n.campaign_id=? AND n.delivered=0 AND m.active=1 ORDER BY n.rowid',
        { id: 'text', characterId: 'text', text: 'text' },
      ).all(cam),
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

export function readTreasures(
  db: SqliteDatabase,
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
  for (const row of checkedQuery(
    db,
    'SELECT rowid AS cursor,* FROM treasure WHERE campaign_id=? AND (? IS NULL OR rowid<?) ORDER BY rowid DESC',
    {
      cursor: 'integer',
      campaign_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    },
  ).iterate(cam, cursor, cursor)) {
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

function ledgerView(db: SqliteDatabase, item: LedgerItem) {
  const definition = readLedgerDefinition(db, item);
  item.currentName = definition.name;
  item.currentUnitCopper = definition.unitCopper;
  return item;
}

function ledgerSource(
  db: SqliteDatabase,
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
    const row = checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id);
    if (row) item.sourceTitle = checkedTreasureRow(row).title;
  } catch {}
  titles?.set(id, item.sourceTitle);
  return item;
}

export function readLedgerItem(db: SqliteDatabase, cam: string, id: string): LedgerItem {
  const item = checkedLedgerRow(
    checkedQuery(db, 'SELECT * FROM character_ledger WHERE campaign_id=? AND id=?', {
      campaign_id: 'text',
      id: 'text',
      character_id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).get(cam, id),
  );
  readLedgerDefinition(db, item);
  if (item.origin === 'transfer' && !item.rewardCreditId)
    item.rewardCreditId = transferCredit(db, cam, item);
  if (item.origin !== 'transfer' && item.status === 'given' && item.recipientCharacterId)
    item.creditedCopper = transferredValue(db, cam, item)?.toString() ?? null;
  return item;
}

export function readLedgerDetail(db: SqliteDatabase, cam: string, id: string) {
  return ledgerSource(db, cam, readLedgerItem(db, cam, id));
}

export function readLedger(db: SqliteDatabase, cam: string, query: LedgerQuery): LedgerPage {
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
    for (const row of checkedQuery(
      db,
      'SELECT rowid AS cursor,* FROM character_ledger WHERE campaign_id=? AND character_id=? ORDER BY rowid DESC',
      {
        cursor: 'integer',
        campaign_id: 'text',
        id: 'text',
        character_id: 'text',
        revision: 'integer',
        payload: 'text',
        checksum: 'text',
      },
    ).iterate(cam, query.characterId)) {
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
  db: SqliteDatabase,
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
      !checkedQuery(db, 'SELECT 1 FROM roster_member WHERE campaign_id=? AND id=?', {
        '1': 'integer',
      }).get(cam, query.characterId)
    )
      throw new Error('Inventarfigur gehört nicht zu dieser Kampagne.');
    const sql =
      'SELECT rowid AS cursor,* FROM character_ledger WHERE campaign_id=? AND character_id=?' +
      (cursor === null ? '' : ' AND rowid<?') +
      ' ORDER BY rowid DESC LIMIT 51';
    const rows = checkedQuery(db, sql, { id: 'text', cursor: 'integer' }).all(
        cam,
        query.characterId,
        ...(cursor === null ? [] : [cursor]),
      ),
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
          id: checkedRow(row, { id: 'text' }).id,
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
      next: rows.length > 50 ? String(page[49]!.cursor) : null,
    };
  })();
}

export function readProgressHistory(
  db: SqliteDatabase,
  cam: string,
  characterId: string,
  after: string | null,
) {
  readProgressCharacter(db, cam, characterId);
  if (after !== null && !/^[1-9][0-9]{0,15}$/.test(after))
    throw new Error('Ungültige Verlaufseite.');
  const rows = checkedQuery(
    db,
    'SELECT rowid AS cursor,* FROM progress_event WHERE campaign_id=? AND character_id=? AND (? IS NULL OR rowid<?) ORDER BY rowid DESC LIMIT 51',
    {
      cursor: 'integer',
      campaign_id: 'text',
      id: 'text',
      character_id: 'nullable-text',
      kind: 'text',
      payload: 'text',
      checksum: 'text',
    },
  ).all(cam, characterId, after, after);
  const page = rows.slice(0, 50);
  return {
    items: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      facts: checkedProgressEvent(r),
    })),
    next: rows.length > 50 ? String(page[49]!.cursor) : null,
  };
}

export function readLootBalance(db: SqliteDatabase, cam: string) {
  return db.transaction(() => {
    const members = readRoster(db, cam).filter((c) => !c.archived);
    const totals = new Map<string, bigint>(),
      unknown = new Map<string, number>();
    for (const m of members) {
      totals.set(m.id, 0n);
      unknown.set(m.id, 0);
    }
    for (const row of checkedQuery(db, 'SELECT * FROM character_ledger WHERE campaign_id=?', {
      campaign_id: 'text',
      id: 'text',
      character_id: 'text',
      revision: 'integer',
      payload: 'text',
      checksum: 'text',
    }).iterate(cam)) {
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

export function saveLedger(db: SqliteDatabase, cam: string, l: LedgerItem) {
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

export function finishCombatRewards(
  db: SqliteDatabase,
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

function checkedCounterparty(
  db: SqliteDatabase,
  cam: string,
  link: LedgerItem['counterpartyLink'],
) {
  if (!link) return undefined;
  let available = false;
  if (link.kind === 'location')
    available = !!checkedQuery(
      db,
      'SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0',
      { '1': 'integer' },
    ).get(cam, link.id);
  else if (link.kind === 'shop') {
    const r = checkedQuery(db, 'SELECT * FROM shop WHERE campaign_id=? AND id=?', {
      payload: 'text',
    }).get(cam, link.id);
    available = !!r && !decodeStored(r, shape.shop).trashed;
  } else if (['npc', 'faction'].includes(link.kind))
    available = !!checkedQuery(
      db,
      "SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND trashed=0 AND json_extract(payload,'$.kind')=?",
      { '1': 'integer' },
    ).get(cam, link.id, link.kind);
  if (!available) throw new Error('Verknüpften Händler oder Empfänger prüfen.');
  return link;
}

function allocateTreasurePortion(
  db: SqliteDatabase,
  cam: string,
  t: Treasure,
  a: Extract<ProgressAction, { kind: 'allocate-batch' }>['allocations'][number],
) {
  const item = t.items.find((i) => i.id === a.itemId);
  const member = checkedQuery(
    db,
    'SELECT active,membership_revision,scene_id FROM roster_member WHERE campaign_id=? AND id=?',
    { active: 'integer', membership_revision: 'integer', scene_id: 'nullable-text' },
  ).get(cam, a.characterId);
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

export function executeProgress(
  db: SqliteDatabase,
  command: ProgressCommand,
  guard: () => void,
): ProgressAck {
  return db
    .transaction(() => {
      guard();
      if (!command.commandId || command.commandId.length > 1000 || !command.action)
        throw new Error('Fortschrittsauftrag fehlt.');
      const cam = command.campaignId,
        fp = hash(json({ ...command, token: undefined })),
        prior = checkedQuery(db, 'SELECT * FROM progress_receipt WHERE command_id=?', {
          command_id: 'text',
          campaign_id: 'text',
          fingerprint: 'text',
          payload: 'text',
          checksum: 'text',
        }).get(command.commandId);
      if (prior) {
        if (
          prior.campaign_id !== cam ||
          prior.fingerprint !== fp ||
          hash(prior.payload) !== prior.checksum
        )
          throw new Error('Auftragskennung bereits anders verwendet.');
        return checkedProgressReceipt(prior);
      }
      const a = command.action;
      if (
        'characterId' in a &&
        checkedQuery(
          db,
          "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
          { '1': 'integer' },
        ).get(cam, a.characterId)
      )
        throw new Error('Archivierte Figur zuerst wiederherstellen.');
      if ('recipients' in a && Array.isArray(a.recipients))
        for (const r of a.recipients)
          if (
            checkedQuery(
              db,
              "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
              { '1': 'integer' },
            ).get(cam, r.characterId)
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
          checkedQuery(db, 'SELECT revision FROM roster_state WHERE campaign_id=?', {
            revision: 'integer',
          }).get(cam)?.revision !== a.expectedRosterRevision
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
          const m = checkedQuery(
            db,
            'SELECT active,membership_revision FROM roster_member WHERE campaign_id=? AND id=?',
            { active: 'integer', membership_revision: 'integer' },
          ).get(cam, r.characterId);
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
          const t = checkedTreasureRow(
            checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=? AND id=?', {
              campaign_id: 'text',
              id: 'text',
              revision: 'integer',
              payload: 'text',
              checksum: 'text',
            }).get(cam, treasureId),
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
            const m = checkedQuery(
              db,
              'SELECT membership_revision FROM roster_member WHERE campaign_id=? AND id=?',
              { membership_revision: 'integer' },
            ).get(cam, a.characterId);
            if (
              !m ||
              m.membership_revision !== a.expectedMembershipRevision ||
              a.characterId === l.characterId
            )
              throw new Error('Andere bestehende Empfängerfigur auswählen.');
            const handed = {
              ...part,
              status: 'given' as const,
              counterparty: checkedCharacterProfile(
                shape.character_profile(
                  storedPayload(
                    checkedQuery(
                      db,
                      'SELECT * FROM character_profile WHERE campaign_id=? AND id=?',
                      { payload: 'text' },
                    ).get(cam, a.characterId),
                  ),
                ),
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
              counterparty: checkedCharacterProfile(
                shape.character_profile(
                  storedPayload(
                    checkedQuery(
                      db,
                      'SELECT * FROM character_profile WHERE campaign_id=? AND id=?',
                      { payload: 'text' },
                    ).get(cam, l.characterId),
                  ),
                ),
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
          !checkedQuery(
            db,
            'SELECT 1 FROM progress_event WHERE campaign_id=? AND id=? AND character_id=?',
            { '1': 'integer' },
          ).get(cam, a.correctionOf, a.characterId)
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
          const member = checkedQuery(
            db,
            'SELECT active,scene_id FROM roster_member WHERE campaign_id=? AND id=?',
            { active: 'integer', scene_id: 'nullable-text' },
          ).get(cam, p.characterId);
          if (!member?.active) throw new Error('Rast nur für aktive Figuren.');
          if (
            checkedQuery(
              db,
              "SELECT 1 FROM combat WHERE campaign_id=? AND scene_id=? AND phase='running'",
              { '1': 'integer' },
            ).get(cam, member.scene_id)
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
        const t = checkedTreasureRow(
          checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=? AND id=?', {
            campaign_id: 'text',
            id: 'text',
            revision: 'integer',
            payload: 'text',
            checksum: 'text',
          }).get(cam, a.treasureId),
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
        const t = checkedTreasureRow(
          checkedQuery(db, 'SELECT * FROM treasure WHERE campaign_id=? AND id=?', {
            campaign_id: 'text',
            id: 'text',
            revision: 'integer',
            payload: 'text',
            checksum: 'text',
          }).get(cam, a.treasureId),
        );
        if (t.revision !== a.expectedRevision)
          throw new Error('Schatz geändert. Verteilung erneut ansehen.');
        for (const portion of a.allocations) {
          if (
            checkedQuery(
              db,
              "SELECT 1 FROM character_profile WHERE campaign_id=? AND id=? AND json_type(payload,'$.archive')='object'",
              { '1': 'integer' },
            ).get(cam, portion.characterId)
          )
            throw new Error('Archivierte Figur zuerst wiederherstellen.');
          ledgerIds.push(allocateTreasurePortion(db, cam, t, portion));
        }
        t.revision++;
        saveTreasure(db, cam, t);
        treasureId = t.id;
      } else if (a.kind === 'manual-item') {
        const member = checkedQuery(
          db,
          'SELECT membership_revision FROM roster_member WHERE campaign_id=? AND id=?',
          { membership_revision: 'integer' },
        ).get(cam, a.characterId);
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
  executeLive: (
    command: import('./../runtime/live-contracts').LiveCommand,
  ) => import('../runtime/live-contracts').LiveAck;
}

export function storedExecuteProgress(
  db: SqliteDatabase,
  context: ExecuteProgressContext,
  command: ProgressCommand,
): ProgressAck {
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
        checkedQuery(db, 'SELECT 1 FROM progress_receipt WHERE command_id=?', {
          '1': 'integer',
        }).get(command.commandId)
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
        checkedQuery(
          db,
          "SELECT 1 FROM chase WHERE campaign_id=? AND scene_id=? AND status='running'",
          { '1': 'integer' },
        ).get(command.campaignId, scene.id)
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

function checkedProgressEvent(value: unknown) {
  const row = checkedRow(value, { kind: 'text', character_id: 'nullable-text' }),
    facts = decodeStored(value, shape.progress_event);
  const required: Record<string, readonly string[]> = {
    'combat-group-entry': ['combatId', 'groupId', 'actorIds'],
    'combat-entry': ['commandId', 'combatId', 'participant'],
    'combat-exit': ['commandId', 'combatId', 'participant', 'reason'],
    'combat-return': ['commandId', 'combatId', 'participant'],
    'group-created': ['groupId', 'after'],
    'group-edited': ['groupId', 'before', 'after'],
    'shop-purchase': ['entry', 'shopId'],
    'shop-sale': ['before', 'portion', 'shopId', 'notes'],
    'treasure-created': ['treasure'],
    'treasure-edited': ['treasureId', 'before', 'after', 'reason'],
    'treasure-moved': ['treasureId', 'from', 'to', 'before', 'after'],
    'treasure-anchored': ['treasureId', 'from', 'to', 'before', 'after'],
    'story-award': ['sourceKind', 'sourceId', 'before', 'after', 'xp'],
    'combat-award': ['awardId', 'combatId', 'before', 'after', 'xp', 'load'],
    'loot-award': ['treasureId', 'itemId', 'entry'],
    'party-award-member': ['before', 'after', 'xp', 'load', 'reason', 'commandId'],
    'party-award': [
      'recipientIds',
      'loadedIds',
      'poolXp',
      'loadXp',
      'shareXp',
      'totalXp',
      'shareLoad',
      'totalLoad',
    ],
    'narrative-state': ['title', 'before', 'after'],
    'narrative-award': ['noteId', 'sceneId', 'poolXp', 'shareXp', 'recipientIds', 'outcome'],
    'loot-merge': ['before', 'after', 'sourceBefore', 'sourceAfter'],
    'loot-transfer-received': ['sourceId', 'entry', 'reason'],
    'loot-transfer': ['before', 'after', 'handed', 'receivedId', 'reason'],
    'loot-split': ['before', 'after', 'portion', 'reason'],
    'death-save': ['before', 'after', 'operation'],
    health: ['before', 'after', 'operation'],
    xp: ['before', 'after', 'mode', 'requestedAmount', 'appliedDelta'],
    rest: ['commandId', 'rest', 'before', 'after', 'restoreHp'],
    'manual-loot': ['entry'],
    'loot-correction': ['originalId', 'before', 'after', 'reason'],
    'loot-sold': ['originalId', 'before', 'after', 'portion', 'reason'],
    'loot-given': ['originalId', 'before', 'after', 'portion', 'reason'],
    'loot-correct': ['originalId', 'before', 'after', 'portion', 'reason'],
  };
  const fields = required[row.kind];
  if (
    'revision' in facts ||
    !fields ||
    fields.some((key) => !Object.hasOwn(facts, key)) ||
    !Number.isFinite(Date.parse(facts.recordedAt))
  )
    throw new Error('Fortschrittsverlauf hat ungültige Fakten für seine Recordart.');
  for (const [key, v] of Object.entries(facts)) {
    if (
      ['xp', 'load', 'poolXp', 'loadXp', 'shareXp', 'totalXp', 'shareLoad', 'totalLoad'].includes(
        key,
      ) &&
      (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
    )
      throw new Error('Fortschrittsverlauf hat ungültige Mengen.');
  }
  const record: Record<string, unknown> = facts;
  const characterKinds = [
    'story-award',
    'combat-award',
    'party-award-member',
    'death-save',
    'health',
    'xp',
    'rest',
    'combat-entry',
    'combat-return',
  ];
  if (characterKinds.includes(row.kind))
    for (const key of ['before', 'after'])
      if (Object.hasOwn(record, key)) {
        const p = checkedProgressValue(record[key]);
        if (row.character_id !== null && p.characterId !== row.character_id)
          throw new Error('Fortschrittsfakten gehören zu einer anderen Figur.');
      }
  if (row.kind === 'group-created' || row.kind === 'group-edited')
    for (const key of ['before', 'after'])
      if (Object.hasOwn(record, key)) {
        const group = checkedPreparedGroupValue(record[key]);
        if (group.id !== record.groupId)
          throw new Error('Historische Gruppenfakten widersprüchlich.');
      }
  if (row.kind.startsWith('treasure-'))
    for (const key of ['treasure', 'before', 'after'])
      if (Object.hasOwn(record, key)) {
        const treasure = checkedTreasureValue(record[key]);
        if (record.treasureId !== undefined && treasure.id !== record.treasureId)
          throw new Error('Historische Schatzfakten widersprüchlich.');
      }
  if (row.kind === 'narrative-state')
    for (const key of ['before', 'after']) checkedNarrativeState(record[key]);
  if (
    row.kind.startsWith('loot-') ||
    ['shop-purchase', 'shop-sale', 'manual-loot'].includes(row.kind)
  ) {
    const entries = new Map<string, LedgerItem>();
    for (const key of [
      'entry',
      'before',
      'after',
      'portion',
      'sourceBefore',
      'sourceAfter',
      'handed',
    ])
      if (Object.hasOwn(record, key)) {
        const item = shape.character_ledger(record[key]);
        validateLedgerItem(item);
        entries.set(key, item);
      }
    const before = entries.get('before'),
      after = entries.get('after'),
      portion = entries.get('portion'),
      handed = entries.get('handed'),
      entry = entries.get('entry');
    if (before && after && (before.id !== after.id || before.characterId !== after.characterId))
      throw new Error('Historische Beutekorrektur widersprüchlich.');
    if (before && (portion ?? handed) && (portion ?? handed)!.parentId !== before.id)
      throw new Error('Historische Beuteportion gehört zu einem anderen Eintrag.');
    if (record.originalId !== undefined && before && record.originalId !== before.id)
      throw new Error('Historischer Beuteursprung widersprüchlich.');
    if (
      row.kind === 'shop-purchase' &&
      (entry?.origin !== 'purchase' || entry.counterpartyReference?.shopId !== record.shopId)
    )
      throw new Error('Historischer Shopkauf widersprüchlich.');
    if (
      row.kind === 'shop-sale' &&
      (portion?.status !== 'sold' || portion.counterpartyReference?.shopId !== record.shopId)
    )
      throw new Error('Historischer Shopverkauf widersprüchlich.');
  }
  if (row.kind === 'party-award') {
    const ids = record.recipientIds,
      loaded = record.loadedIds;
    if (
      !Array.isArray(ids) ||
      !Array.isArray(loaded) ||
      [...ids, ...loaded].some((v) => typeof v !== 'string' || !v.trim()) ||
      new Set(ids).size !== ids.length ||
      new Set(loaded).size !== loaded.length
    )
      throw new Error('Historische Partyempfänger beschädigt.');
    const expected = xpShare(checkedRow(record, { poolXp: 'integer' }).poolXp, ids.length),
      load = xpShare(checkedRow(record, { loadXp: 'integer' }).loadXp, loaded.length);
    if (
      record.shareXp !== expected.share ||
      record.totalXp !== expected.total ||
      record.shareLoad !== load.share ||
      record.totalLoad !== load.total
    )
      throw new Error('Historische Partyverteilung widersprüchlich.');
  }
  if (row.kind === 'xp') {
    const r = checkedRow(record, { requestedAmount: 'integer', appliedDelta: 'integer' });
    if (r.requestedAmount < 0) throw new Error('Historische XP-Korrektur beschädigt.');
  }
  if ('participant' in facts) checkedCombatant(facts.participant);

  if (
    'participant' in facts &&
    row.character_id !== null &&
    facts.participant.characterId !== row.character_id
  )
    throw new Error('Kampfverlauf gehört zu einer anderen Figur.');
  return facts;
}

function checkedCombatAward(value: unknown) {
  const row = checkedRow(value, { id: 'text' }),
    a = decodeStored(value, shape.combat_award);
  const expected = xpShare(a.poolXp, a.recipientIds.length);
  if (
    a.awardId !== row.id ||
    !a.awardId ||
    new Set(a.recipientIds).size !== a.recipientIds.length ||
    a.recipientIds.some((id) => !id.trim()) ||
    expected.share !== a.shareXp ||
    expected.total !== a.totalXp
  )
    throw new Error('Gespeicherter Kampfabschlussbeleg widersprüchlich.');
  return a;
}
function checkedProgressReceipt(value: unknown): ProgressAck {
  const row = checkedRow(value, { command_id: 'text', campaign_id: 'text', fingerprint: 'text' }),
    ack = decodeStored(value, shape.progress_receipt);
  if (
    'revision' in ack ||
    !row.command_id ||
    !row.campaign_id ||
    !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
    new Set(ack.characters.map((c) => c.characterId)).size !== ack.characters.length
  )
    throw new Error('Fortschrittsbestätigung beschädigt.');
  for (const c of ack.characters) {
    checkedProgressValue(c);
    if (
      !Number.isSafeInteger(c.membershipRevision) ||
      c.membershipRevision < 0 ||
      (c.sceneId !== null && !c.sceneId.trim())
    )
      throw new Error('Bestätigte Figurenbindung beschädigt.');
    if (c.lastCombatStatus) checkedHealthStatus(c.lastCombatStatus);
  }
  if (
    new Set(ack.ledgerIds).size !== ack.ledgerIds.length ||
    ack.ledgerIds.some((id) => !id.trim() || id.length > 1000)
  )
    throw new Error('Bestätigte Beutekennungen beschädigt.');
  if (ack.partyAward) {
    const a = ack.partyAward;
    if (Object.values(a).some((n) => !Number.isSafeInteger(n) || n < 0))
      throw new Error('Bestätigte Partybelohnung beschädigt.');
  }
  return ack;
}
