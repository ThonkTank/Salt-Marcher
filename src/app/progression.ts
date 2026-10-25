import type { LiveScene, TimeUnit } from './live-contracts';
import type { GroupsAPI, GroupAction } from './groups-contracts';
import type {
  TreasuryAPI,
  TreasuryAction,
  TreasureOrigin,
  TreasureAnchor,
  TreasureQuery,
} from './treasury-contracts';
import type { SceneDeskAPI } from './scene-desk-contracts';
import type { FinishDraftAPI as importFinishDraftAPI } from './finish-draft-contracts';
import type { NarrativeAction } from './narrative-contracts';
import type { Result } from './contracts';
import type { ItemDefinition } from './items-contracts';
export const levelXp = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
] as const;
export const dailyXp = [
  300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500, 15000, 18000,
  20000, 25000, 27000, 30000, 40000,
] as const;
export function xpLevel(xp: number) {
  if (!Number.isSafeInteger(xp) || xp < 0)
    throw new Error('XP müssen eine nichtnegative ganze Zahl sein.');
  let index = 0;
  while (index < 19 && xp >= levelXp[index + 1]!) index++;
  return {
    level: index + 1,
    floor: levelXp[index]!,
    next: levelXp[index + 1] ?? null,
    budget: dailyXp[index]!,
  };
}
export function xpInput(text: string): number {
  const raw = text.trim(),
    amount = Number(raw);
  if (!raw || !Number.isSafeInteger(amount) || amount < 0)
    throw new Error('Nichtnegative ganze XP eintragen.');
  return amount;
}
export function xpShare(pool: number, recipients: number) {
  if (
    !Number.isSafeInteger(pool) ||
    pool < 0 ||
    !Number.isSafeInteger(recipients) ||
    recipients < 0
  )
    throw new Error('Ungültige XP-Verteilung.');
  const share = recipients
    ? Number((BigInt(pool) + BigInt(recipients) - 1n) / BigInt(recipients))
    : 0;
  const total = share * recipients;
  if (!Number.isSafeInteger(total)) throw new Error('XP-Verteilung zu groß.');
  return { share, total };
}
export function copper(gold: string): string {
  if (typeof gold !== 'string' || !/^(0|[1-9][0-9]{0,14})([.,][0-9]{1,2})?$/.test(gold.trim()))
    throw new Error(
      'Wert benötigt eine nichtnegative Goldsumme mit höchstens zwei Nachkommastellen.',
    );
  const [whole, part = ''] = gold.trim().replace(',', '.').split('.');
  return (BigInt(whole!) * 100n + BigInt(part.padEnd(2, '0'))).toString();
}
export function gold(cp: string) {
  const n = BigInt(cp);
  return n / 100n + ',' + (n % 100n).toString().padStart(2, '0') + ' GM';
}
export interface Progress {
  characterId: string;
  revision: number;
  xp: number | null;
  rest: { known: boolean; longXp: number; shortXp: number; baseline: number; sections: number };
  health: {
    hp: number;
    maxHp: number;
    tempHp: number;
    conditions: string;
    concentrating: boolean;
    death?: { successes: number; failures: number; stable: boolean; dead: boolean };
  } | null;
  /** Current conditions/temporary HP when normal HP are intentionally unknown. */
  combatStatus?: { tempHp: number; conditions: string; concentrating: boolean };
}
export type CharacterHealth = NonNullable<Progress['health']> & {
  death?: { successes: number; failures: number; stable: boolean; dead: boolean };
};
export type DeathSaveResult =
  | 'success'
  | 'failure'
  | 'natural-20'
  | 'natural-1'
  | 'stabilize'
  | 'reset'
  | 'dead';
export function deathSaveControls(death: CharacterHealth['death']) {
  const terminal = !!(death?.dead || death?.stable);
  return { terminal, reset: !!death && (death.successes > 0 || death.failures > 0 || terminal) };
}
export function checkedHealthStatus(h: NonNullable<Progress['combatStatus']>) {
  if (
    !h ||
    typeof h !== 'object' ||
    Array.isArray(h) ||
    !Number.isSafeInteger(h.tempHp) ||
    h.tempHp < 0 ||
    h.tempHp > 1000000 ||
    typeof h.conditions !== 'string' ||
    h.conditions.length > 4000 ||
    typeof h.concentrating !== 'boolean'
  )
    throw new Error('Gespeicherte HP oder Zustände ungültig.');
  return h;
}
export function checkedHealth(h: CharacterHealth): CharacterHealth {
  if (
    !h ||
    typeof h !== 'object' ||
    Array.isArray(h) ||
    typeof h.conditions !== 'string' ||
    h.conditions.length > 4000 ||
    typeof h.concentrating !== 'boolean' ||
    ![h.hp, h.maxHp, h.tempHp].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000) ||
    h.maxHp < 1 ||
    h.hp > h.maxHp
  )
    throw new Error('HP benötigen gültige ganze Werte und aktuelle HP bis zum Maximum.');
  if (h.death !== undefined) {
    const d = h.death;
    if (
      !d ||
      typeof d !== 'object' ||
      Array.isArray(d) ||
      h.hp > 0 ||
      ![d.successes, d.failures].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 3) ||
      typeof d.stable !== 'boolean' ||
      typeof d.dead !== 'boolean' ||
      (d.dead && (d.failures !== 3 || d.stable || d.successes === 3)) ||
      (d.stable && (d.successes !== 3 || d.dead || d.failures === 3)) ||
      (!d.dead && !d.stable && (d.successes === 3 || d.failures === 3))
    )
      throw new Error('Todesrettungswürfe ungültig.');
  }
  return h;
}
export function applyDeathSave(health: CharacterHealth, result: DeathSaveResult): CharacterHealth {
  const h = structuredClone(checkedHealth(health));
  if (h.hp > 0) throw new Error('Todesrettungswürfe benötigen 0 HP.');
  if (
    !['success', 'failure', 'natural-20', 'natural-1', 'stabilize', 'reset', 'dead'].includes(
      result,
    )
  )
    throw new Error('Unbekanntes Todesrettungswurfergebnis.');
  const d = h.death ?? { successes: 0, failures: 0, stable: false, dead: false };
  if ((d.dead || d.stable) && result !== 'reset')
    throw new Error(
      d.dead
        ? 'Figur ist als tot markiert. Zuerst zurücksetzen.'
        : 'Figur ist stabilisiert. Für neue Todesrettungswürfe zuerst zurücksetzen.',
    );
  if (result === 'reset') h.death = { successes: 0, failures: 0, stable: false, dead: false };
  else if (result === 'stabilize') h.death = { ...d, successes: 3, stable: true };
  else if (result === 'dead') h.death = { ...d, failures: 3, dead: true, stable: false };
  else if (result === 'natural-20') {
    h.hp = 1;
    delete h.death;
  } else {
    const failures = Math.min(
        3,
        d.failures + (result === 'natural-1' ? 2 : result === 'failure' ? 1 : 0),
      ),
      successes = Math.min(3, d.successes + (result === 'success' ? 1 : 0));
    h.death = { successes, failures, stable: successes === 3, dead: failures === 3 };
  }
  return checkedHealth(h);
}
/** Ordinary damage uses the same health facts in Party and combat; mask-only roll prompts stay outside. */
export function applyHealthDamage(
  health: CharacterHealth,
  amount: number,
  deathSaves = true,
  critical = false,
): { health: CharacterHealth; deathResult?: 'failure' | 'dead' } {
  let h = structuredClone(checkedHealth(health));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error('Betrag benötigt eine positive ganze Zahl.');
  const absorbed = Math.min(h.tempHp, amount),
    remaining = amount - absorbed,
    beforeHp = h.hp;
  h.tempHp -= absorbed;
  h.hp = Math.max(0, beforeHp - remaining);
  let deathResult: 'failure' | 'dead' | undefined;
  if (deathSaves && remaining > 0) {
    if (beforeHp > 0 && h.hp === 0) delete h.death;
    const overflow = Math.max(0, remaining - beforeHp);
    const result =
      (beforeHp === 0 ? remaining : overflow) >= h.maxHp
        ? 'dead'
        : beforeHp === 0
          ? 'failure'
          : undefined;
    if (result && !h.death?.dead) {
      if (h.death?.stable) h = applyDeathSave(h, 'reset');
      h = applyDeathSave(h, result);
      deathResult = result;
      if (result === 'failure' && critical && !h.death?.dead) h = applyDeathSave(h, 'failure');
    }
  }
  if (h.hp === 0) h.concentrating = false;
  return { health: checkedHealth(h), ...(deathResult ? { deathResult } : {}) };
}
export function applyHealthHealing(health: CharacterHealth, amount: number): CharacterHealth {
  const h = structuredClone(checkedHealth(health));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error('Betrag benötigt eine positive ganze Zahl.');
  if (h.death?.dead)
    throw new Error(
      'Tote können nicht geheilt werden. Wiederbelebung oder ausdrückliche Korrektur erforderlich.',
    );
  h.hp = Math.min(h.maxHp, h.hp + amount);
  if (h.hp > 0) delete h.death;
  return checkedHealth(h);
}
/** Party-owned rest transition shared by confirmed writes and read-only day planning. */
export function restAfter(rest: Progress['rest'], kind: 'short' | 'long'): Progress['rest'] {
  if (kind === 'long') return { known: true, longXp: 0, shortXp: 0, baseline: 0, sections: 0 };
  return {
    ...rest,
    shortXp: 0,
    ...(rest.known && rest.sections < 2
      ? { baseline: rest.longXp, sections: rest.sections + 1 }
      : {}),
  };
}
export function restFrame(p: Progress) {
  if (p.xp === null || !p.rest.known) return null;
  const budget = xpLevel(p.xp).budget,
    remaining = budget - p.rest.baseline;
  return {
    budget,
    consumed: p.rest.longXp,
    sections: 3 - p.rest.sections,
    fill:
      remaining <= 0 ? 1 : Math.max(0, Math.min(1, (p.rest.longXp - p.rest.baseline) / remaining)),
    nextRest: p.rest.baseline + Math.max(0, remaining) / (3 - p.rest.sections),
    overdue: p.rest.longXp >= budget,
  };
}
export type ItemCategory = 'coins' | 'equipment' | 'trade-goods' | 'magic' | 'other';
export interface ItemInput {
  name: string;
  quantity: number;
  valueGold: string;
  category: ItemCategory;
  reference?: ItemReference;
}
export interface ItemReference {
  kind: 'authored';
  definitionId: string;
  revision: number;
  historicalDefinitionId?: string;
}
export interface TreasureItem {
  id: string;
  reference: ItemReference;
  name: string;
  category: ItemCategory;
  quantity: number;
  allocated: number;
  unitCopper: string | null;
  currentDefinition?: ItemDefinition;
  origin?: TreasureOrigin;
}
export interface Treasure {
  id: string;
  revision: number;
  title: string;
  sceneId: string | null;
  locationId: string | null;
  combatId: string | null;
  sourceNoteId?: string;
  awardId?: string;
  items: TreasureItem[];
}
export interface LedgerItem {
  id: string;
  characterId: string;
  revision: number;
  reference: ItemReference;
  name: string;
  category: ItemCategory;
  quantity: number;
  unitCopper: string | null;
  origin: 'award' | 'purchase' | 'manual' | 'transfer';
  status: 'received' | 'sold' | 'given';
  actualSaleCopper: string | null;
  counterparty: string;
  treasureId: string | null;
  combatId: string | null;
  sceneId: string | null;
  locationId: string | null;
  instantMs: string | null;
  recordedAt: string;
  parentId: string | null;
  sourceTreasureId?: string;
  sourceTreasureItemId?: string;
  rewardCreditId?: string;
  creditedCopper?: string | null;
  recipientCharacterId?: string;
  sourceCharacterId?: string;
  sourceNoteId?: string;
  awardId?: string;
  provenance?: string;
  mergeTargetId?: string;
  counterpartyLink?: { kind: 'shop' | 'npc' | 'location' | 'faction'; id: string };
  paidCopper?: string;
  instanceId?: string | null;
  counterpartyReference?: { shopId: string; owner: { kind: 'npc' | 'location'; id: string } };
  currentName?: string;
  currentUnitCopper?: string | null;
  /** Current source title for navigation; never part of the stored grant. */
  sourceTitle?: string;
}
/** Allocate the recorded total price before quantity changes; whole copper stays in the remainder. */
export function partitionLedgerPaidPrice(source: LedgerItem, portion: LedgerItem): void {
  if (source.paidCopper === undefined) return;
  const total = BigInt(source.paidCopper),
    share = (total * BigInt(portion.quantity)) / BigInt(source.quantity);
  portion.paidCopper = share.toString();
  source.paidCopper = (total - share).toString();
}
export const ledgerDefinitionId = (item: Pick<LedgerItem, 'reference'>) =>
  item.reference.historicalDefinitionId ?? item.reference.definitionId;
export function ledgerStacksMatch(a: LedgerItem, b: LedgerItem): boolean {
  const key = (item: LedgerItem) =>
    JSON.stringify([
      item.reference.definitionId,
      item.reference.revision,
      item.reference.historicalDefinitionId ?? null,
      item.name,
      item.category,
      item.unitCopper,
      item.origin,
      item.treasureId,
      item.combatId,
      item.sceneId,
      item.locationId,
      item.instantMs,
      item.sourceNoteId ?? null,
      item.awardId ?? null,
      item.provenance ?? null,
      item.rewardCreditId ?? null,
      item.sourceTreasureId ?? null,
      item.sourceTreasureItemId ?? null,
      item.sourceCharacterId ?? null,
      item.mergeTargetId ?? null,
      item.counterparty,
      item.counterpartyLink ? [item.counterpartyLink.kind, item.counterpartyLink.id] : null,
      item.counterpartyReference
        ? [
            item.counterpartyReference.shopId,
            item.counterpartyReference.owner.kind,
            item.counterpartyReference.owner.id,
          ]
        : null,
    ]);
  return (
    !a.instanceId &&
    !b.instanceId &&
    a.characterId === b.characterId &&
    a.status === 'received' &&
    b.status === 'received' &&
    key(a) === key(b)
  );
}
export function ledgerCopper(item: LedgerItem): bigint | null {
  if (item.status === 'sold')
    return item.actualSaleCopper === null ? null : BigInt(item.actualSaleCopper);
  if (item.quantity === 0) return 0n;
  const value = item.currentUnitCopper !== undefined ? item.currentUnitCopper : item.unitCopper;
  return value === null ? null : BigInt(value) * BigInt(item.quantity);
}
export interface ProgressView {
  characters: (Progress & {
    name: string;
    active: boolean;
    membershipRevision: number;
    sceneId: string | null;
    healthCombat?: { id: string; sceneId: string; title: string };
    lastCombatStatus?: Pick<CharacterHealth, 'tempHp' | 'conditions' | 'concentrating'>;
  })[];
  notices: { id: string; characterId: string; text: string }[];
}
export interface ProgressAck extends ProgressView {
  partyAward?: {
    poolXp: number;
    loadXp: number;
    shareXp: number;
    totalXp: number;
    shareLoad: number;
    totalLoad: number;
  };
  restScene?: LiveScene;
  restWarnings?: string[];
  treasureId: string | null;
  groupId?: string;
  ledgerIds: string[];
}
export interface TreasurePage {
  items: {
    id: string;
    title: string;
    revision: number;
    available: number;
    anchor?: TreasureAnchor;
    anchorLabel?: string;
    anchorAvailable?: boolean;
  }[];
  next: string | null;
}
export interface LedgerQuery {
  characterId: string;
  after: string | null;
  search: string;
  status: '' | LedgerItem['status'];
}
export interface LedgerPage {
  items: LedgerItem[];
  problems: { id: string; message: string }[];
  unavailableCount: number;
  next: string | null;
  totalCopper: string | null;
}
export interface LedgerInventoryQuery {
  characterId: string;
  after: string | null;
}
export interface LedgerInventoryPage {
  items: LedgerItem[];
  problems: LedgerPage['problems'];
  visited: number;
  next: string | null;
}
export interface ProgressGuard {
  characterId: string;
  revision: number;
}
export interface FinishRewards {
  poolXp: number;
  noXp: boolean;
  recipients: ProgressGuard[];
  policyVersion: 'xp-ceil-2014-v1';
  loadXp: number;
  items: ItemInput[];
}
export interface CombatReward {
  awardId: string;
  poolXp: number;
  shareXp: number;
  totalXp: number;
  recipientIds: string[];
  treasureId: string | null;
  policyVersion: 'xp-ceil-2014-v1';
}
export type ProgressAction =
  | GroupAction
  | NarrativeAction
  | TreasuryAction
  | {
      kind: 'ledger-split';
      entryId: string;
      expectedRevision: number;
      quantity: number;
      reason: string;
    }
  | {
      kind: 'ledger-merge';
      entryId: string;
      expectedRevision: number;
      sourceId: string;
      expectedSourceRevision: number;
      reason: string;
    }
  | {
      kind: 'ledger-transfer';
      entryId: string;
      expectedRevision: number;
      quantity: number;
      characterId: string;
      expectedMembershipRevision: number;
      reason: string;
    }
  | ({ kind: 'health'; characterId: string; expectedRevision: number; reason: string } & (
      | { operation: 'set'; health: CharacterHealth }
      | { operation: 'damage' | 'heal'; amount: number }
      | { operation: 'death'; result: DeathSaveResult }
    ))
  | {
      kind: 'party-award';
      expectedRosterRevision: number;
      poolXp: number;
      loadXp: number;
      reason: string;
      participants: {
        characterId: string;
        revision: number;
        membershipRevision: number;
        receiveXp: boolean;
        receiveLoad: boolean;
      }[];
    }
  | {
      kind: 'xp';
      characterId: string;
      expectedRevision: number;
      mode: 'add' | 'subtract' | 'set';
      amount: number;
      reason: string;
      correctionOf?: string;
    }
  | {
      kind: 'rest';
      rest: 'short' | 'long';
      recipients: ProgressGuard[];
      restoreHp?: boolean;
      scene?: {
        id: string;
        expectedMembershipRevision: number;
        expectedClockRevision: number;
        expectedFocusRevision: number;
      } & ({ amount: number; unit: TimeUnit } | { amount?: never; unit?: never });
    }
  | { kind: 'treasure'; title: string; sceneId: string | null; items: ItemInput[] }
  | {
      kind: 'allocate-batch';
      treasureId: string;
      expectedRevision: number;
      allocations: {
        itemId: string;
        expectedDefinitionRevision: number;
        quantity: number;
        characterId: string;
        expectedMembershipRevision: number;
      }[];
    }
  | {
      kind: 'allocate';
      treasureId: string;
      expectedRevision: number;
      expectedDefinitionRevision: number;
      itemId: string;
      quantity: number;
      characterId: string;
      expectedMembershipRevision: number;
    }
  | {
      kind: 'manual-item';
      characterId: string;
      expectedMembershipRevision: number;
      origin: 'award' | 'purchase' | 'manual';
      item: ItemInput;
      note: string;
    }
  | {
      kind: 'ledger';
      entryId: string;
      expectedRevision: number;
      operation: 'sold' | 'given' | 'correct';
      quantity: number;
      actualGold: string;
      counterparty: string;
      correctedQuantity?: number;
      counterpartyLink?: LedgerItem['counterpartyLink'];
      reason: string;
    }
  | { kind: 'notice'; ids: string[] };
export interface ProgressCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action: ProgressAction;
}
export interface ProgressHistory {
  items: { id: string; kind: string; facts: Record<string, any> }[];
  next: string | null;
}
export interface LootBalance {
  characters: {
    characterId: string;
    name: string;
    active: boolean;
    copper: string;
    unknownEntries: number;
    gapCopper: string;
  }[];
  leaderCopper: string;
  suggestedCharacterIds: string[];
}
export function lootBalanceSuggestions(
  characters: LootBalance['characters'],
  leaderCopper: string,
) {
  if (characters.some((c) => c.unknownEntries)) return [];
  const known = characters.filter((c) => !c.unknownEntries),
    active = known.filter((c) => c.active),
    pool = active.length ? active : known;
  if (!pool.length) return [];
  const minimum = pool.reduce(
    (best, c) => (BigInt(c.copper) < best ? BigInt(c.copper) : best),
    BigInt(pool[0]!.copper),
  );
  if (minimum >= BigInt(leaderCopper)) return [];
  return pool.filter((c) => BigInt(c.copper) === minimum).map((c) => c.characterId);
}
export interface ProgressAPI extends importFinishDraftAPI, SceneDeskAPI, TreasuryAPI, GroupsAPI {
  adventuringDay(
    token: string,
    request: import('./adventuring-day-contracts').DayRequest,
  ): Promise<Result<import('./adventuring-day-contracts').DayView>>;
  ledgerParties(
    token: string,
  ): Promise<Result<{ kind: 'shop' | 'npc' | 'location' | 'faction'; id: string; name: string }[]>>;
  keepNarrativeDraft(
    token: string,
    draft: import('./narrative-contracts').NarrativeDraft,
    expected: string | null,
  ): Promise<Result<void>>;
  discardNarrativeDraft(token: string, id: string, writeId: string): Promise<Result<void>>;
  narrative(
    token: string,
    noteId: string,
  ): Promise<Result<import('./narrative-contracts').NarrativeView>>;
  progressHistory(
    token: string,
    characterId: string,
    after: string | null,
  ): Promise<Result<ProgressHistory>>;
  progress(token: string): Promise<Result<ProgressView>>;
  lootBalance(token: string): Promise<Result<LootBalance>>;
  treasures(
    token: string,
    after: string | null,
    query?: TreasureQuery,
  ): Promise<Result<TreasurePage>>;
  treasure(token: string, id: string): Promise<Result<Treasure>>;
  ledger(token: string, query: LedgerQuery): Promise<Result<LedgerPage>>;
  ledgerInventory(token: string, query: LedgerInventoryQuery): Promise<Result<LedgerInventoryPage>>;
  ledgerItem(token: string, id: string): Promise<Result<LedgerItem>>;
  executeProgress(command: ProgressCommand): Promise<Result<ProgressAck>>;
}
