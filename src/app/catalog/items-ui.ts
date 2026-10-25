import { EditorSession } from '../shared/editor-session';
import { shopStockForItem } from './items-contracts';
import { nextAuthoredDefinition } from './item-definition-validation';
import { validateShopShape } from '../runtime/shop-validation';
import { renderShopRestockTables } from '../runtime/shop-restock-ui';
import {
  writeConfirmed,
  hasPendingCommit,
  initCommitControls,
  updateCommitControls,
  onCommitState,
  onCommitResolved,
  type CommitResolution,
} from '../shared/commit-confirmation';
import type { ProgressAck } from '../runtime/progression';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type {
  ItemDefinition,
  ItemQuery,
  ShopSummary,
  ShopView,
  Shop,
  ItemShopAction,
  ItemShopAck,
} from './items-contracts';
import type { Preparation } from '../campaign/preparation-contracts';
import { formatInstant, type LiveView } from '../runtime/live-contracts';
import { copper, gold, type LedgerItem, type LedgerInventoryPage } from '../runtime/progression';
import { refreshProgress } from '../runtime/progression-ui';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();
const tradePendingWork = editorSession.operation<Promise<boolean>>();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => el<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const amount = (s: string) =>
  (BigInt(s) / 100n).toString() + '.' + (BigInt(s) % 100n).toString().padStart(2, '0');
let workspace: WorkspaceGeometry | null = null,
  definition: ItemDefinition | null = null,
  shop: ShopView | null = null,
  sources: Preparation | null = null,
  roster: LiveView['roster'] = [],
  ledger: LedgerItem[] = [];
let shopClock: {
  sceneId: string;
  expectedRevision: number;
  instantMs: string;
  title: string;
} | null = null;
let dirtyDefinition = false,
  dirtyShop = false,
  offset = 0,
  next: number | null = null;
let tell: (text: string, error?: boolean) => void, enter: (shopId?: string) => Promise<void>;
let openRequest = 0,
  searchRequest = 0,
  definitionRequest = 0,
  shopsRequest = 0,
  shopRequest = 0,
  sellerRequest = 0,
  clockRequest = 0;
let requestedShop: string | null = null,
  shopLoading = false,
  shopError = '',
  sellerLoading = false,
  sellerError = '',
  loadedSeller: string | null = null;
let requestedDefinition: string | null = null,
  definitionLoading = false,
  definitionError = '';
let searchTimer: ReturnType<typeof setTimeout> | null = null;
function clearSearchTimer() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
}
function clearItemResults(text: string) {
  el('items-results').replaceChildren();
  el('items-source').textContent = '';
  next = null;
  const status = el('items-page');
  status.setAttribute('role', 'status');
  status.textContent = text;
  for (const id of ['items-prev', 'items-next']) el<HTMLButtonElement>(id).disabled = true;
}
let contextReady = false,
  contextLoading = false,
  contextError = '';
let historyRequest = 0,
  historyLoading = false;
let tradeConfirmed = false;
const lockedButtons = new Map<HTMLButtonElement, boolean>();
let lastDefinitionSave: { id: string; fields: string; revision: number } | null = null;
const sceneShopRequests = new WeakMap<HTMLElement, number>();
const owned = (token: string | undefined, g: number) =>
  workspace?.token === token && editorSession.generation === g;

const categories: { [k: string]: string } = {
  coins: 'Münzen',
  equipment: 'Ausrüstung',
  'trade-goods': 'Handelswaren',
  magic: 'Magischer Gegenstand',
  other: 'Sonstiges',
};
function option(s: HTMLSelectElement, id: string, name: string) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = name;
  s.append(o);
}
function button(label: string, action: () => Promise<unknown> | void, ownerShop?: string) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.onclick = () => {
    if (ownerShop && (!shopReady() || shop?.shop.id !== ownerShop)) return;
    if (b.closest('#shop-editor') && !shopReady()) return;
    run(action);
  };
  return b;
}
function run(action: () => Promise<unknown> | void) {
  const token = workspace?.token,
    g = editorSession.generation;
  void Promise.resolve()
    .then(() => {
      if (owned(token, g)) return action();
    })
    .catch((error) => {
      if (owned(token, g)) tell(error.message, true);
    });
}
async function command(action: ItemShopAction, snapshot: Shop | null = null): Promise<ItemShopAck> {
  const owner = workspace,
    g = editorSession.generation;
  if (!owner) throw new Error('Öffne eine Kampagne.');
  if (
    action.kind !== 'definition' &&
    action.kind !== 'definition-trash' &&
    (!contextReady || contextLoading)
  )
    throw new Error('Vergabe- und Shopkontext zuerst laden.');
  if (['purchase', 'sell', 'restock', 'random-restock'].includes(action.kind) && !shopReady())
    throw new Error('Ausgewählten Shop zuerst laden.');
  if (action.kind === 'sell' && !sellerReady())
    throw new Error('Inventar der ausgewählten Figur zuerst laden.');
  if (action.kind === 'definition')
    nextAuthoredDefinition(action.definition, action.expectedRevision);
  if (action.kind === 'shop') validateShopShape(action.shop, true);
  if (
    action.kind === 'shop' &&
    (action.shop.stock.some((e) => e.restock?.nextDueMs === '0') ||
      (action.shop.restockTables ?? []).some((t) => t.schedule?.nextDueMs === '0'))
  )
    action = {
      ...action,
      scheduleClock: shopClock
        ? { sceneId: shopClock.sceneId, expectedRevision: shopClock.expectedRevision }
        : undefined,
    };
  const request = {
    commandId: crypto.randomUUID(),
    campaignId: owner.campaign.id,
    token: owner.token,
    action: structuredClone(action),
  };
  const meta = {
    owner: 'items',
    token: owner.token,
    epoch: g,
    action: request.action,
    fields: action.kind === 'definition' ? definitionFields() : shopFields(),
    snapshot,
  };
  const result = await writeConfirmed<ItemShopAck>(
    'items',
    request,
    () => window.campaign.executeItemShop(request),
    () => owned(owner.token, g),
    meta,
  );
  if (!owned(owner.token, g))
    throw new Error('Änderung in der früheren Kampagne bestätigt. Den Stand dort erneut öffnen.');
  if (['purchase', 'sell', 'restock', 'random-restock'].includes(action.kind))
    tradeConfirmed = true;
  return result;
}
function setShopClock(live: LiveView) {
  const scene = live.scene;
  shopClock = scene
    ? {
        sceneId: scene.id,
        expectedRevision: scene.clock.revision,
        instantMs: scene.clock.instantMs,
        title: scene.title || 'Gruppe im Fokus',
      }
    : null;
  renderShopTime();
}
function renderShopTime() {
  el('shop-time').textContent =
    'Zeitbasis für neue Auffüllregeln (Tage zu je 24 Stunden): ' +
    (shopClock
      ? shopClock.title + ' · ' + formatInstant(shopClock.instantMs)
      : 'Vorbereitungszeit vor Spielbeginn') +
    '.';
}
async function refreshShopClock() {
  const owner = workspace,
    g = editorSession.generation,
    id = shop?.shop.id,
    request = ++clockRequest;
  if (!owner) return;
  const response = await window.campaign.live(owner.token);
  if (!owned(owner.token, g) || request !== clockRequest) return;
  const live = unwrap(response);
  if (id && shop?.shop.id === id) {
    const response = await window.campaign.shop(owner.token, id);
    if (!owned(owner.token, g) || request !== clockRequest || shop?.shop.id !== id) return;
    shop.timeNotice = unwrap(response).timeNotice;
  }
  if (!owned(owner.token, g) || request !== clockRequest) return;
  setShopClock(live);
  el('shop-availability').textContent =
    (shop?.unavailable ? 'Shop pausiert.' : 'Besitzer: ' + (shop?.ownerName ?? '')) +
    (shop?.timeNotice ? ' · ' + shop.timeNotice : '');
}
function collectDefinition() {
  if (!definition) return;
  return {
    ...definition,
    name: value('item-name'),
    category: value('item-category') as ItemDefinition['category'],
    magic: el<HTMLInputElement>('item-magic').checked,
    rarity: value('item-rarity'),
    attunement: value('item-attunement') as ItemDefinition['attunement'],
    unitCopper: value('item-value').trim() ? copper(value('item-value')) : null,
    weightText: value('item-weight'),
    properties: value('item-properties')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    description:
      value('item-description') === definition.description.replace(/\r\n?/g, '\n')
        ? definition.description
        : value('item-description'),
  };
}
function definitionFields() {
  return JSON.stringify(
    [
      ...el('item-form').querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input,textarea,select'),
    ].map((i) => [i.id, i.type === 'checkbox' ? (i as HTMLInputElement).checked : i.value]),
  );
}
function shopFields() {
  return JSON.stringify([
    value('shop-name'),
    value('shop-notes'),
    value('shop-owner'),
    shop?.shop.stock,
    shop?.shop.restockTables,
  ]);
}
function showItemsArea(area: 'catalog' | 'shops') {
  el('items-catalog').hidden = area !== 'catalog';
  el('items-shops').hidden = area !== 'shops';
  el('items-show-catalog').setAttribute('aria-pressed', String(area === 'catalog'));
  el('items-show-shops').setAttribute('aria-pressed', String(area === 'shops'));
}
function showDefinition(next: ItemDefinition, dirty = false) {
  if (definition?.id !== next.id) {
    el<HTMLDetailsElement>('item-editing').open =
      next.source.kind === 'authored' && next.revision === 0;
    el<HTMLDetailsElement>('item-usage').open = false;
  }
  definitionRequest++;
  requestedDefinition = next.id;
  definitionLoading = false;
  definitionError = '';
  definition = next;
  dirtyDefinition = false;
  renderDefinition();
  dirtyDefinition = dirty;
}
function mergeShop(saved: ShopView, snapshot: Shop) {
  const draft = shop!.shop,
    beforeById = new Map(snapshot.stock.map((e) => [e.id, e])),
    savedById = new Map(saved.shop.stock.map((e) => [e.id, e]));
  draft.revision = saved.shop.revision;
  for (const entry of draft.stock) {
    const before = beforeById.get(entry.id),
      confirmed = savedById.get(entry.id);
    if (!before || !confirmed) continue;
    if (JSON.stringify(entry) === JSON.stringify(before)) Object.assign(entry, confirmed);
    else {
      if (JSON.stringify(entry.reference) === JSON.stringify(before.reference))
        entry.reference = confirmed.reference;
      if (JSON.stringify(entry.restock) === JSON.stringify(before.restock))
        entry.restock = confirmed.restock;
    }
  }
  if (JSON.stringify(draft.restockTables) === JSON.stringify(snapshot.restockTables))
    draft.restockTables = saved.shop.restockTables;
  shop = { ...saved, shop: draft };
}
function applyTradeShop(saved: ShopView, snapshot: Shop) {
  if (dirtyShop) mergeShop(saved, snapshot);
  else shop = saved;
  renderShop();
}
function flushDrafts(): Promise<boolean> {
  if (pendingWork.value) return pendingWork.value;
  const w = workspace,
    g = editorSession.generation;
  if (!w) return Promise.resolve(true);
  const task = Promise.resolve().then(async () => {
    try {
      while (owned(w.token, g) && (dirtyDefinition || dirtyShop)) {
        if ((dirtyDefinition && !definition) || (dirtyShop && !shop))
          throw new Error('Entwurf gehört zu keiner aktiven Auswahl.');
        while (dirtyDefinition && definition && owned(w.token, g)) {
          const id = definition.id,
            fields = definitionFields(),
            d = collectDefinition()!,
            revision = definition.revision;
          const result = await command({
            kind: 'definition',
            definition: d,
            expectedRevision: revision || null,
          });
          if (!owned(w.token, g) || definition?.id !== id) return false;
          if (!result.definition) throw new Error('Gespeicherter Gegenstand fehlt.');
          definition = result.definition;
          lastDefinitionSave = { id, fields, revision: definition.revision };
          dirtyDefinition = fields !== definitionFields();
          if (shop) shop.items = shop.items.map((d) => (d.id === id ? definition! : d));
          if (!dirtyDefinition) {
            renderDefinition();
            if (shop && !dirtyShop) renderShop();
          }
        }
        while (dirtyShop && shop && owned(w.token, g)) {
          collectShop();
          const id = shop.shop.id,
            fields = shopFields(),
            snapshot = structuredClone(shop.shop);
          const result = await command(
            { kind: 'shop', shop: snapshot, expectedRevision: snapshot.revision || null },
            snapshot,
          );
          if (!owned(w.token, g) || shop?.shop.id !== id) return false;
          if (!result.shop) throw new Error('Gespeicherter Shop fehlt.');
          dirtyShop = fields !== shopFields();
          mergeShop(result.shop, snapshot);
          if (!dirtyShop) renderShop();
        }
      }
      return owned(w.token, g);
    } catch (error) {
      if (owned(w.token, g)) tell((error as Error).message + ' Eingaben bleiben offen.', true);
      return false;
    }
  });
  pendingWork.value = task;
  return task;
}
export async function flushItems(): Promise<boolean> {
  if (
    workspace &&
    hasPendingCommit(workspace.campaign.id) &&
    !tradePendingWork.value &&
    !pendingWork.value
  )
    return false;
  const token = workspace?.token,
    g = editorSession.generation;
  if (tradePendingWork.value && !(await tradePendingWork.value)) return false;
  if (!owned(token, g)) return false;
  return (await flushDrafts()) && owned(token, g);
}
function performTrade(action: () => Promise<void>) {
  if (tradePendingWork.value) return tradePendingWork.value;
  const token = workspace?.token,
    g = editorSession.generation;
  tradeConfirmed = false;
  const task = Promise.resolve()
    .then(async () => {
      if (!owned(token, g)) return false;
      await action();
      return owned(token, g);
    })
    .catch((error) => {
      if (owned(token, g))
        tell(
          (tradeConfirmed ? 'Buchung bestätigt; Anzeige konnte nicht aktualisiert werden: ' : '') +
            error.message,
          true,
        );
      return tradeConfirmed && owned(token, g);
    });
  tradePendingWork.value = task;
  lockShopContext();
  void task.finally(lockShopContext);
  return task;
}
export function activateItems(w: WorkspaceGeometry) {
  historyRequest++;
  historyLoading = false;
  clearSearchTimer();
  workspace = w;
  contextReady = false;
  contextLoading = false;
  contextError = '';
  requestedDefinition = null;
  definitionLoading = false;
  definitionError = '';
  requestedShop = null;
  shopLoading = false;
  shopError = '';
  sellerLoading = false;
  sellerError = '';
  loadedSeller = null;
  editorSession.generation++;
  openRequest++;
  searchRequest++;
  definitionRequest++;
  shopsRequest++;
  shopRequest++;
  sellerRequest++;
  clockRequest++;
  pendingWork.value = null;
  tradePendingWork.value = null;
  tradeConfirmed = false;
  lastDefinitionSave = null;
  shopClock = null;
  definition = null;
  shop = null;
  sources = null;
  roster = [];
  ledger = [];
  dirtyDefinition = false;
  dirtyShop = false;
  offset = 0;
  clearItemResults('');
  el('shops-list').replaceChildren();
  el('shop-stock').replaceChildren();
  el('shop-sale-problems').textContent = '';
  el('shop-sale-problem-details').hidden = true;
  el('shop-sale-problem-list').textContent = '';
  for (const id of ['item-recipient', 'shop-seller', 'shop-sale-item']) el(id).replaceChildren();
  renderDefinition();
  renderShop();
  renderItemContext();
  updateCommitControls();
}
function renderItemContext() {
  const status = el('item-context-status');
  status.hidden = !contextLoading && !contextError;
  status.setAttribute('role', contextError ? 'alert' : 'status');
  status.textContent = contextError
    ? 'Vergabe und Shops nicht verfügbar: ' + contextError + ' Die Gegenstandssuche bleibt nutzbar.'
    : contextLoading
      ? 'Vergabe und Shops werden geladen. Die Gegenstandssuche bleibt nutzbar.'
      : '';
  el('item-context-retry').hidden = !contextError;
  el<HTMLButtonElement>('item-context-retry').disabled = contextLoading;
  el<HTMLButtonElement>('shop-new').disabled = !contextReady || contextLoading;
  el<HTMLInputElement>('shops-trash-filter').disabled = !contextReady || contextLoading;
  lockShopContext();
}
export async function openItems(
  shopId?: string,
  reference?: { id: string; stillCurrent: () => boolean },
) {
  const w = workspace,
    g = editorSession.generation,
    request = ++openRequest;
  if (
    !w ||
    !(await flushItems()) ||
    !owned(w.token, g) ||
    request !== openRequest ||
    (reference && !reference.stillCurrent())
  )
    return;
  const current = () => owned(w.token, g) && request === openRequest;
  if (shopId) showItemsArea('shops');
  else if (reference) showItemsArea('catalog');
  contextReady = false;
  contextLoading = true;
  contextError = '';
  sources = null;
  roster = [];
  shopClock = null;
  ledger = [];
  loadedSeller = null;
  shopLoading = false;
  shopError = '';
  sellerLoading = false;
  sellerError = '';
  sellerRequest++;
  shopRequest++;
  clockRequest++;
  renderItemContext();
  // Imported references do not depend on campaign preparation, roster, clocks or shops.
  const references = search(),
    detail = reference ? selectDefinition(reference.id, reference.stillCurrent) : Promise.resolve();
  const context = (async () => {
    try {
      const [nextSources, live] = await Promise.all([
        window.campaign.preparation(w.token, '').then(unwrap),
        window.campaign.live(w.token).then(unwrap),
      ]);
      if (!current()) return;
      sources = nextSources;
      roster = live.roster;
      setShopClock(live);
      const recipients = el<HTMLSelectElement>('item-recipient'),
        sellers = el<HTMLSelectElement>('shop-seller');
      for (const s of [recipients, sellers]) {
        const old = s.value;
        s.replaceChildren();
        for (const c of roster) {
          option(s, c.id, c.profile.name + (c.active ? '' : ' · inaktiv'));
        }
        if ([...s.options].some((o) => o.value === old)) s.value = old;
      }
      contextReady = true;
      await loadShops();
      if (!current()) return;
      const id = shopId ?? shop?.shop.id;
      if (id) await selectShop(id);
      else renderShop();
      if (current()) await loadSeller();
    } catch (error) {
      if (current()) {
        contextReady = false;
        contextError = (error as Error).message;
      }
    } finally {
      if (current()) {
        contextLoading = false;
        renderItemContext();
      }
    }
  })();
  await Promise.all([references, detail, context]);
}
export async function createShopAtLocation(locationId: string, name: string) {
  const w = workspace,
    g = editorSession.generation;
  await openItems();
  if (!w || !owned(w.token, g) || !(await flushItems())) throw new Error('Shop-Kontext geändert.');
  const location = sources?.locations.find((l) => l.document.id === locationId && !l.trashed);
  if (!location) throw new Error('Ort für neuen Shop nicht verfügbar.');
  const next: Shop = {
    id: crypto.randomUUID(),
    revision: 0,
    name,
    owner: { kind: 'location', id: locationId },
    notes: '',
    trashed: false,
    stock: [],
  };
  shopRequest++;
  requestedShop = next.id;
  shopLoading = false;
  shopError = '';
  shop = {
    shop: next,
    ownerName: location.document.name,
    unavailable: false,
    timeNotice: null,
    items: [],
    history: [],
  };
  dirtyShop = false;
  renderShop();
  lockShopContext();
  dirtyShop = true;
  if (!(await flushItems()) || !owned(w.token, g) || shop?.shop.id !== next.id)
    throw new Error('Neuer Shop ist noch nicht übernommen. Offene Eingaben im Shop prüfen.');
  await loadShops();
  if (!owned(w.token, g)) return next.id;
  showItemsArea('shops');
  el<HTMLDetailsElement>('shop-settings').open = true;
  el('shop-editor').scrollIntoView({ block: 'start' });
  el('shop-notes').focus();
  return next.id;
}
export async function prepareShopLocation(id: string, locationId: string) {
  const w = workspace,
    g = editorSession.generation;
  await openItems(id);
  if (!w || !owned(w.token, g) || !shopReady() || shop?.shop.id !== id)
    throw new Error('Shop für Ortsbindung nicht verfügbar.');
  if (!sources?.locations.some((l) => l.document.id === locationId && !l.trashed))
    throw new Error('Zielort nicht verfügbar.');
  el<HTMLDetailsElement>('shop-settings').open = true;
  el<HTMLSelectElement>('shop-owner').value = 'location:' + locationId;
  dirtyShop = true;
  el('shop-owner').focus();
  tell('Zielort als Shopbesitzer vorbelegt. Shop speichern bestätigt die Zuordnung.');
}
export async function openItemReference(id: string, stillCurrent = () => true) {
  const token = workspace?.token,
    g = editorSession.generation;
  if (!stillCurrent()) return;
  await openItems(undefined, { id, stillCurrent: () => owned(token, g) && stillCurrent() });
}
async function search() {
  clearSearchTimer();
  const token = workspace?.token,
    g = editorSession.generation,
    request = ++searchRequest,
    current = () => owned(token, g) && request === searchRequest;
  const q: ItemQuery = {
    search: value('item-search'),
    category: value('item-filter-category'),
    magic: value('item-filter-magic') as ItemQuery['magic'],
    rarity: value('item-filter-rarity'),
    attunement: value('item-filter-attunement'),
    sort: value('item-sort') as ItemQuery['sort'],
    direction: value('item-direction') as ItemQuery['direction'],
    after: offset,
    includeTrashed: el<HTMLInputElement>('item-trash-filter').checked,
  };
  const root = el('items-results'),
    status = el('items-page');
  clearItemResults('Gegenstände werden geladen.');
  try {
    const response = await window.campaign.itemDefinitions(q);
    if (!current()) return;
    const page = unwrap(response);
    next = page.next;
    el('items-source').textContent = [page.sourceStatus.message, ...(page.problems ?? [])].join(
      '\n',
    );
    status.textContent = page.total
      ? page.total + ' Gegenstände · Seite ' + (Math.floor(q.after / 40) + 1)
      : 'Keine Gegenstände für diese Suche.';
    for (const d of page.items) {
      const row = button(
        d.name +
          ' · ' +
          [
            categories[d.category],
            d.rarity,
            d.attunement === 'yes' ? 'Einstimmung erforderlich' : '',
            d.unitCopper === null ? 'Wert offen' : gold(d.unitCopper),
            d.trashed ? 'Papierkorb' : '',
          ]
            .filter(Boolean)
            .join(' · '),
        () => selectDefinition(d.id),
      );
      row.dataset.definitionId = d.id;
      root.append(row);
    }
    markDefinitionSelection();
    el<HTMLButtonElement>('items-prev').disabled = q.after === 0;
    el<HTMLButtonElement>('items-next').disabled = next === null;
  } catch (error) {
    if (current()) {
      status.setAttribute('role', 'alert');
      status.textContent = (error as Error).message;
    }
  }
}
function markDefinitionSelection() {
  for (const row of el('items-results').querySelectorAll<HTMLButtonElement>('button'))
    row.setAttribute('aria-pressed', String(row.dataset.definitionId === requestedDefinition));
}
function definitionReady() {
  return (
    !!definition && definition.id === requestedDefinition && !definitionLoading && !definitionError
  );
}
function lockDefinition() {
  markDefinitionSelection();
  const blocked =
      !!tradePendingWork.value || (!!workspace && hasPendingCommit(workspace.campaign.id)),
    ready = definitionReady();
  for (const input of el('item-form').querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input,select,textarea'))
    input.disabled = blocked || !ready || definition?.source.kind === 'srd51';
  for (const id of ['item-save', 'item-trash'])
    el<HTMLButtonElement>(id).disabled = blocked || !ready || definition?.source.kind === 'srd51';
  el<HTMLButtonElement>('item-copy').disabled = blocked || !ready;
  for (const id of ['item-award', 'item-treasure', 'shop-add-item'])
    el<HTMLButtonElement>(id).disabled =
      blocked ||
      !ready ||
      !!definition?.trashed ||
      !contextReady ||
      contextLoading ||
      (id === 'shop-add-item' && !shopReady());
  for (const id of ['item-recipient', 'item-award-quantity'])
    el<HTMLInputElement | HTMLSelectElement>(id).disabled =
      blocked || !ready || !!definition?.trashed || !contextReady || contextLoading;
  const status = el('item-load-status');
  status.hidden = !definitionLoading && !definitionError;
  status.setAttribute('role', definitionError ? 'alert' : 'status');
  status.textContent = definitionError || (definitionLoading ? 'Gegenstand wird geladen.' : '');
  el('item-load-retry').hidden = !definitionError || !requestedDefinition;
  el<HTMLButtonElement>('item-load-retry').disabled = blocked || definitionLoading;
}
async function selectDefinition(id: string, stillCurrent = () => true) {
  const token = workspace?.token,
    g = editorSession.generation,
    request = ++definitionRequest;
  requestedDefinition = id;
  definitionLoading = true;
  definitionError = '';
  lockDefinition();
  const current = () => owned(token, g) && request === definitionRequest && stillCurrent();
  try {
    if (!(await flushItems())) {
      if (current()) requestedDefinition = definition?.id ?? null;
      return;
    }
    if (!current()) return;
    const response = await window.campaign.itemDefinition(id);
    if (!current()) return;
    if (dirtyDefinition)
      throw new Error('Neue Gegenstandseingabe bleibt offen. Bei Bedarf erneut wählen.');
    const next = unwrap(response);
    if (next.id !== id) throw new Error('Gegenstandsantwort gehört nicht zur Auswahl.');
    showDefinition(next);
  } catch (error) {
    if (current()) definitionError = (error as Error).message;
  } finally {
    if (owned(token, g) && request === definitionRequest) {
      if (!stillCurrent()) requestedDefinition = definition?.id ?? null;
      definitionLoading = false;
      lockDefinition();
    }
  }
}
function renderDefinition() {
  el('item-editor').hidden = !definition;
  el('item-empty').hidden = !!definition;
  if (!definition || dirtyDefinition) {
    lockDefinition();
    return;
  }
  const d = definition;
  el('item-reference-title').textContent = d.name || 'Neuer Gegenstand';
  el('item-reference-facts').textContent = [
    categories[d.category],
    d.magic ? 'magisch' : '',
    d.rarity,
    'Einstimmung: ' +
      { yes: 'erforderlich', no: 'nicht erforderlich', unspecified: 'nicht angegeben' }[
        d.attunement
      ],
    d.weightText ? 'Gewicht: ' + d.weightText : '',
    d.unitCopper === null ? 'Wert offen' : gold(d.unitCopper),
    d.trashed ? 'Papierkorb' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  el('item-reference-properties').textContent = d.properties.join(' · ');
  el('item-reference-properties').hidden = !d.properties.length;
  el('item-reference-description').textContent = d.description || 'Keine Beschreibung hinterlegt.';
  el('item-editing').hidden = d.source.kind === 'srd51';
  for (const [id, v] of Object.entries({
    'item-name': d.name,
    'item-category': d.category,
    'item-rarity': d.rarity,
    'item-attunement': d.attunement,
    'item-value': d.unitCopper === null ? '' : amount(d.unitCopper),
    'item-weight': d.weightText,
    'item-properties': d.properties.join(', '),
    'item-description': d.description,
  }))
    el<HTMLInputElement>(id).value = v;
  el<HTMLInputElement>('item-magic').checked = d.magic;
  el('item-source').textContent =
    d.source.label +
    (d.source.license ? ' · ' + d.source.license : '') +
    (d.source.kind === 'srd51'
      ? ' · Schreibgeschützte Quelle.'
      : ' · Eigene Definition für diese Installation.');
  el('item-trash').hidden = d.source.kind === 'srd51';
  el('item-copy').textContent = d.source.kind === 'srd51' ? 'Eigene Kopie anlegen' : 'Duplizieren';
  const link = el<HTMLAnchorElement>('item-source-link');
  link.hidden = !d.source.url;
  link.href = d.source.url ?? '';
  el('item-trash').textContent = d.trashed
    ? 'Gegenstand wiederherstellen'
    : 'Gegenstand in Papierkorb';
  el('item-usage').hidden = d.trashed;
  lockDefinition();
}
function shopProblem(s: ShopSummary, scene = false) {
  const p = document.createElement('p');
  p.className = 'error';
  p.setAttribute('role', 'status');
  p.textContent =
    (scene ? 'Zuordnung zu dieser Gruppe nicht prüfbar: ' : 'Shop nicht verfügbar: ') +
    s.name +
    ' · ' +
    s.problem;
  return p;
}
async function loadShops() {
  const w = workspace,
    g = editorSession.generation,
    request = ++shopsRequest;
  if (!w) return;
  const response = await window.campaign.shops(
    w.token,
    el<HTMLInputElement>('shops-trash-filter').checked,
  );
  if (!owned(w.token, g) || request !== shopsRequest) return;
  const list = unwrap(response),
    root = el('shops-list');
  root.replaceChildren();
  for (const s of list)
    root.append(
      s.problem
        ? shopProblem(s)
        : button(
            s.name + ' · ' + s.ownerName + (s.unavailable ? ' · pausiert / Papierkorb' : ''),
            () => selectShop(s.id),
          ),
    );
}
function shopReady() {
  return (
    contextReady &&
    !contextLoading &&
    !!shop &&
    shop.shop.id === requestedShop &&
    !shopLoading &&
    !shopError
  );
}
function sellerReady() {
  return !sellerLoading && !sellerError && loadedSeller === value('shop-seller');
}
function lockShopContext() {
  lockDefinition();
  el('shop-editor').hidden = !shop && !shopLoading && !shopError;
  el('shop-fields').hidden = !shop;
  const blocked =
    !!tradePendingWork.value || (!!workspace && hasPendingCommit(workspace.campaign.id));
  const trader = roster.find((c) => c.id === value('shop-seller')),
    activeBuyer = !!trader?.active;
  for (const b of el('shop-stock').querySelectorAll<HTMLButtonElement>(
    'button[data-purchase-available]',
  )) {
    b.disabled = !activeBuyer || b.dataset.purchaseAvailable !== 'true';
    b.textContent = 'Für ' + (trader?.profile.name ?? 'Figur') + ' kaufen';
  }
  el<HTMLButtonElement>('shop-sale-submit').textContent =
    'Verkauf für ' + (trader?.profile.name ?? 'Figur') + ' buchen';
  el('shop-trader-note').hidden = activeBuyer || !value('shop-seller');
  el('shop-sale-heading').textContent =
    'Von ' +
    (roster.find((c) => c.id === value('shop-seller'))?.profile.name ?? 'Figur') +
    ' an ' +
    (shop?.shop.name || 'diesen Shop') +
    ' verkaufen';
  el<HTMLFieldSetElement>('shop-fields').disabled = blocked || !shopReady();
  el<HTMLFieldSetElement>('shop-sale-fields').disabled = blocked || !shopReady() || !sellerReady();
  el<HTMLButtonElement>('shop-load-retry').disabled = blocked || shopLoading;
  el<HTMLButtonElement>('shop-seller-retry').disabled = blocked || sellerLoading;
  el<HTMLButtonElement>('shop-history-more').disabled = blocked || !shopReady() || historyLoading;
  const status = el('shop-load-status');
  status.hidden = !shopLoading && !shopError;
  status.setAttribute('role', shopError ? 'alert' : 'status');
  status.textContent = shopError || (shopLoading ? 'Shop wird geladen.' : '');
  el('shop-load-retry').hidden = !shopError || !requestedShop;
  const sellerStatus = el('shop-seller-status');
  sellerStatus.hidden = !sellerLoading && !sellerError;
  sellerStatus.setAttribute('role', sellerError ? 'alert' : 'status');
  sellerStatus.textContent = sellerError || (sellerLoading ? 'Inventar wird geladen.' : '');
  el('shop-seller-retry').hidden = !sellerError;
}
async function selectShop(id: string) {
  const w = workspace,
    g = editorSession.generation,
    request = ++shopRequest;
  if (!w || !contextReady) return;
  historyRequest++;
  historyLoading = false;
  requestedShop = id;
  shopLoading = true;
  shopError = '';
  lockShopContext();
  const current = () => owned(w.token, g) && request === shopRequest;
  try {
    if (!(await flushItems())) {
      if (current()) requestedShop = shop?.shop.id ?? null;
      return;
    }
    if (!current()) return;
    const response = await window.campaign.shop(w.token, id);
    if (!current()) return;
    if (dirtyShop) throw new Error('Neue Shopeingabe bleibt offen. Bei Bedarf erneut wählen.');
    const result = unwrap(response);
    if (result.shop.id !== id) throw new Error('Shopantwort gehört nicht zur Auswahl.');
    if (shop?.shop.id !== result.shop.id) el<HTMLDetailsElement>('shop-settings').open = false;
    shop = result;
    dirtyShop = false;
    renderShop();
    salePrice();
  } catch (error) {
    if (current()) shopError = (error as Error).message;
  } finally {
    if (current()) {
      shopLoading = false;
      lockShopContext();
    }
  }
}
function collectShop() {
  if (!shop) return;
  // Disabled fieldsets still retain validity; checkValidity() would skip them during a switch.
  const invalid = [
    ...el('shop-stock').querySelectorAll<HTMLInputElement>('input[data-shop-field]'),
  ].find((i) => i.validity.customError);
  if (invalid)
    throw new Error(
      (invalid.closest('label')?.firstChild?.textContent ?? 'Shopfeld') + ': Eingabe prüfen.',
    );
  shop.shop.name = value('shop-name');
  const notes = value('shop-notes');
  if (notes !== shop.shop.notes.replace(/\r\n?/g, '\n')) shop.shop.notes = notes;
  const v = value('shop-owner'),
    split = v.indexOf(':');
  shop.shop.owner = { kind: v.slice(0, split) as 'npc' | 'location', id: v.slice(split + 1) };
}
function renderShop(force = false) {
  el('shop-editor').hidden = !shop;
  if (!shop) {
    el<HTMLButtonElement>('item-open-shop').disabled = true;
    el('item-open-shop').textContent = 'Shop öffnen';
    return;
  }
  if (dirtyShop && !force) return;
  el('shop-title').textContent = shop.shop.name || 'Neuer Shop';
  el<HTMLButtonElement>('item-open-shop').textContent =
    'Shop öffnen: ' + (shop.shop.name || 'Neuer Shop');
  el<HTMLButtonElement>('item-open-shop').disabled = false;
  const shopButton = (label: string, action: () => Promise<unknown> | void) =>
    button(label, action, shop!.shop.id);
  const drafts = new Map<string, string>();
  for (const i of el('shop-stock').querySelectorAll<HTMLInputElement>('input[data-trade-key]'))
    if (i.value !== i.dataset.tradeDefault) drafts.set(i.dataset.tradeKey!, i.value);
  el<HTMLInputElement>('shop-name').value = shop.shop.name;
  el<HTMLTextAreaElement>('shop-notes').value = shop.shop.notes;
  const owners = el<HTMLSelectElement>('shop-owner');
  owners.replaceChildren();
  for (const l of sources?.locations ?? [])
    option(
      owners,
      'location:' + l.document.id,
      'Ort: ' + l.document.name + (l.trashed ? ' · Papierkorb' : ''),
    );
  for (const n of sources?.notes ?? [])
    if (n.note.kind === 'npc')
      option(
        owners,
        'npc:' + n.note.id,
        'NPC: ' + n.note.title + (n.trashed ? ' · Papierkorb' : ''),
      );
  owners.value = shop.shop.owner.kind + ':' + shop.shop.owner.id;
  el('shop-availability').textContent = shop.unavailable
    ? 'Shop pausiert: Besitzer oder Shop im Papierkorb.'
    : 'Besitzer: ' + shop.ownerName;
  el('shop-availability').textContent += shop.timeNotice ? ' · ' + shop.timeNotice : '';
  renderShopTime();
  el('shop-trash').textContent = shop.shop.trashed ? 'Shop wiederherstellen' : 'Shop in Papierkorb';
  const root = el('shop-stock'),
    definitions = new Map(shop.items.map((d) => [d.id, d]));
  root.replaceChildren();
  for (const e of shop.shop.stock) {
    const d = definitions.get(e.reference.definitionId),
      card = document.createElement('article');
    card.className = 'session-group-card';
    const title = document.createElement('h4');
    title.textContent =
      (d?.name ?? 'Gegenstand') +
      ' · ' +
      e.quantity +
      ' verfügbar · ' +
      gold(e.buyCopper) +
      (e.unique ? ' · Einzelstück' : '');
    card.append(title);
    const config = document.createElement('details'),
      summary = document.createElement('summary'),
      tradeFields = document.createElement('div');
    summary.textContent = 'Bestand, Preise und Auffüllregeln bearbeiten';
    config.append(summary);
    tradeFields.className = 'time-fields';
    card.append(config, tradeFields);
    const input = (
      label: string,
      initial: string,
      type: string,
      apply: (v: string) => void,
      persist = true,
      parent: HTMLElement = persist ? config : tradeFields,
    ) => {
      const l = document.createElement('label'),
        i = document.createElement('input');
      l.textContent = label;
      i.type = type;
      i.value = initial;
      if (!persist) {
        i.dataset.tradeKey = shop!.shop.id + '|' + e.id + '|' + label;
        i.dataset.tradeDefault = initial;
        i.value = drafts.get(i.dataset.tradeKey) ?? initial;
      }
      if (type === 'number') {
        i.min = '0';
        i.max = '1000000';
        i.step = '1';
      }
      if (persist) i.dataset.shopField = 'true';
      i.oninput = i.onchange = () => {
        if (persist) dirtyShop = true;
        try {
          if (type === 'number' && !i.value.trim()) throw new Error('Menge oder Intervall fehlt.');
          apply(i.value);
          i.setCustomValidity('');
        } catch (error) {
          i.setCustomValidity((error as Error).message);
          tell((error as Error).message, true);
        }
      };
      l.append(i);
      parent.append(l);
      return i;
    };
    input('Bestand', String(e.quantity), 'number', (v) => (e.quantity = Number(v)));
    input(
      'Verkaufspreis pro Stück (GM)',
      amount(e.buyCopper),
      'text',
      (v) => (e.buyCopper = copper(v)),
    );
    input(
      'Ankaufspreis pro Stück (GM)',
      amount(e.sellCopper),
      'text',
      (v) => (e.sellCopper = copper(v)),
    );
    input('Bestandsnotiz', e.notes, 'text', (v) => (e.notes = v));
    const type = document.createElement('label'),
      unique = document.createElement('input');
    unique.type = 'checkbox';
    unique.checked = e.unique;
    type.textContent = 'Konkretes Einzelstück ';
    type.append(unique);
    unique.onchange = () => {
      e.unique = unique.checked;
      e.instanceId = e.unique ? (e.instanceId ?? crypto.randomUUID()) : null;
      if (e.unique) {
        e.quantity = Math.min(1, e.quantity);
        e.restock = null;
      }
      dirtyShop = true;
      renderStockKeepingText();
    };
    config.append(type);
    if (!e.unique) {
      const m = document.createElement('select');
      for (const [id, label] of [
        ['', 'Keine automatische Regel'],
        ['fill', 'Auf Zielmenge auffüllen'],
        ['add', 'Menge hinzufügen'],
      ])
        option(m, id!, label!);
      m.value = e.restock?.mode ?? '';
      m.onchange = () => {
        e.restock = m.value
          ? {
              mode: m.value as 'fill' | 'add',
              quantity: e.restock?.quantity ?? 1,
              intervalMs: e.restock?.intervalMs ?? '86400000',
              nextDueMs: '0',
            }
          : null;
        dirtyShop = true;
        renderStockKeepingText();
      };
      const lab = document.createElement('label');
      lab.textContent = 'Automatisches Auffüllen';
      lab.append(m);
      config.append(lab);
      if (e.restock) {
        input('Ziel / Zugabe', String(e.restock.quantity), 'number', (v) => {
          e.restock!.quantity = Number(v);
        });
        input(
          'Intervall in Tagen zu je 24 Stunden',
          (Number(e.restock.intervalMs) / 86400000).toString(),
          'number',
          (v) => {
            const days = Number(v);
            if (!Number.isSafeInteger(days) || days < 1)
              throw new Error('Intervall benötigt positive ganze 24-Stunden-Tage.');
            e.restock!.intervalMs = (BigInt(days) * 86400000n).toString();
            e.restock!.nextDueMs = '0';
          },
        );
      }
      const quantity = input('Manuell hinzufügen', '1', 'number', () => {}, false, config);
      config.append(
        shopButton('Auffüllen', () =>
          performTrade(async () => {
            const w = workspace,
              g = editorSession.generation,
              id = shop?.shop.id,
              added = Number(quantity.value);
            if (!w || !id || !(await flushDrafts()) || !owned(w.token, g) || shop?.shop.id !== id)
              return;
            const snapshot = structuredClone(shop.shop);
            const result = await command(
              {
                kind: 'restock',
                shopId: id,
                expectedRevision: shop.shop.revision,
                entryId: e.id,
                mode: 'add',
                quantity: added,
                reason: 'Manuell im Shop aufgefüllt',
              },
              snapshot,
            );
            if (!owned(w.token, g) || shop?.shop.id !== id) return;
            applyTradeShop(result.shop!, snapshot);
          }),
        ),
      );
    }
    const q = input('Kaufmenge', '1', 'number', () => {}, false),
      paid = input('Tatsächlich gezahlt (GM gesamt)', amount(e.buyCopper), 'text', () => {}, false);
    q.oninput = () => {
      if (/^[0-9]+$/.test(q.value)) paid.value = amount(BigInt(e.buyCopper) * BigInt(q.value) + '');
    };
    const buy = shopButton(
      'Für ' +
        (roster.find((c) => c.id === value('shop-seller'))?.profile.name ?? 'Figur') +
        ' kaufen',
      () =>
        performTrade(async () => {
          const w = workspace,
            g = editorSession.generation,
            id = shop?.shop.id,
            buyer = roster.find((c) => c.id === value('shop-seller')),
            quantity = Number(q.value),
            actualGold = paid.value,
            definitionFieldsAtClick =
              dirtyDefinition && definition?.id === d?.id ? definitionFields() : null;
          if (!w || !id || !buyer?.active || !d) return;
          if (!(await flushDrafts()) || !owned(w.token, g) || shop?.shop.id !== id) return;
          const expectedDefinitionRevision =
            definitionFieldsAtClick !== null &&
            lastDefinitionSave?.id === d.id &&
            lastDefinitionSave.fields === definitionFieldsAtClick
              ? lastDefinitionSave.revision
              : d.revision;
          const snapshot = structuredClone(shop.shop);
          const result = await command(
            {
              kind: 'purchase',
              shopId: id,
              expectedRevision: shop.shop.revision,
              entryId: e.id,
              expectedDefinitionRevision,
              quantity,
              characterId: buyer.id,
              expectedMembershipRevision: buyer.membershipRevision,
              actualGold,
            },
            snapshot,
          );
          if (!owned(w.token, g) || shop?.shop.id !== id) return;
          applyTradeShop(result.shop!, snapshot);
          await loadSeller();
          if (!owned(w.token, g)) return;
          await refreshProgress();
          if (owned(w.token, g)) tell('Kauf gebucht.');
        }),
    );
    buy.dataset.purchaseAvailable = String(!shop.unavailable && !!e.quantity && !d?.trashed);
    buy.disabled =
      buy.dataset.purchaseAvailable !== 'true' ||
      !roster.some((c) => c.id === value('shop-seller') && c.active);
    card.append(buy);
    config.append(
      shopButton('Bestandszeile entfernen', () => {
        collectShop();
        shop!.shop.stock = shop!.shop.stock.filter((s) => s.id !== e.id);
        dirtyShop = true;
        renderShop(true);
      }),
    );
    root.append(card);
  }
  const restock = el('shop-restock');
  restock.replaceChildren();
  renderShopRestockTables(restock, shop, {
    changed: () => {
      dirtyShop = true;
    },
    rebuild: () => renderStockKeepingText(),
    button: shopButton,
    roll: (tableId) =>
      performTrade(async () => {
        const w = workspace,
          g = editorSession.generation,
          id = shop?.shop.id;
        if (!w || !id || !(await flushDrafts()) || !owned(w.token, g) || shop?.shop.id !== id)
          return;
        const table = shop.shop.restockTables?.find((t) => t.id === tableId);
        if (!table) return;
        const snapshot = structuredClone(shop.shop),
          result = await command(
            {
              kind: 'random-restock',
              shopId: id,
              expectedRevision: shop.shop.revision,
              tableId,
              expectedTableRevision: table.revision,
            },
            snapshot,
          );
        if (owned(w.token, g) && shop?.shop.id === id) applyTradeShop(result.shop!, snapshot);
      }).then(() => {}),
  });
  renderShopHistory(shop.history);
}
function renderShopHistory(history: ShopView['history']) {
  historyRequest++;
  historyLoading = false;
  const next = historyCursor(),
    more = el<HTMLButtonElement>('shop-history-more');
  more.hidden = !next;
  more.disabled = !shopReady();
  const status = el('shop-history-status');
  status.setAttribute('role', 'status');
  status.textContent =
    history.length + ' Einträge angezeigt' + (next ? ' · Ältere Einträge verfügbar.' : '.');
  const root = el('shop-history');
  root.replaceChildren();
  for (const h of history) {
    const entry = h.facts?.entry,
      price =
        entry?.status === 'sold'
          ? { label: 'Erlös', copper: entry.actualSaleCopper }
          : entry?.origin === 'purchase' && entry.status === 'received'
            ? { label: 'Gezahlt', copper: entry.paidCopper }
            : null;
    const p = document.createElement('p');
    p.textContent = h.time + ' · ' + h.description;
    if (price) {
      const raw = price.copper,
        text =
          typeof raw === 'string' && /^[0-9]+$/.test(raw)
            ? gold(raw)
            : raw == null
              ? 'nicht aufgezeichnet'
              : 'nicht lesbar';
      p.append(' · ' + price.label + ': ' + text);
    }
    if (typeof entry?.characterId === 'string' && entry.characterId) {
      const name = roster.find((c) => c.id === entry.characterId)?.profile.name;
      p.append(' · Figur: ' + (name ?? 'nicht im aktuellen Roster'));
    }
    root.append(p);
  }
}
// Old immutable receipts have no continuation field; their last full page is still a valid cursor.
function historyCursor() {
  return shop?.historyNext === undefined && shop?.history.length === 50
    ? shop.history.at(-1)!.id
    : (shop?.historyNext ?? null);
}
async function loadOlderShopHistory() {
  const w = workspace,
    g = editorSession.generation,
    id = shop?.shop.id,
    after = historyCursor();
  if (
    !w ||
    !id ||
    !after ||
    !shopReady() ||
    historyLoading ||
    tradePendingWork.value ||
    hasPendingCommit(w.campaign.id)
  )
    return;
  const request = ++historyRequest,
    current = () =>
      owned(w.token, g) && request === historyRequest && shop?.shop.id === id && shopReady();
  historyLoading = true;
  lockShopContext();
  const status = el('shop-history-status');
  status.setAttribute('role', 'status');
  status.textContent = 'Ältere Einträge werden geladen…';
  try {
    const page = unwrap(await window.campaign.shopHistory(w.token, id, after));
    if (!current()) return;
    if (page.shopId !== id || page.next === after)
      throw Error('Verlaufsseite gehört nicht zur angefragten Auswahl.');
    const focused = document.activeElement === el('shop-history-more');
    shop!.history.push(...page.entries);
    shop!.historyNext = page.next;
    renderShopHistory(shop!.history);
    if (focused && !page.next) status.focus();
  } catch (error) {
    if (current()) {
      status.setAttribute('role', 'alert');
      status.textContent =
        (error as Error).message +
        ' Sichtbare Einträge bleiben erhalten. Ältere Einträge erneut laden.';
    }
  } finally {
    if (request === historyRequest) {
      historyLoading = false;
      lockShopContext();
    }
  }
}

let stockIntent: {
  token: string;
  epoch: number;
  shopId: string;
  definitionId: string;
  revision: number;
} | null = null;
async function addShopItem(prices?: { buy: string; sell: string }) {
  const token = workspace?.token,
    g = editorSession.generation,
    id = shop?.shop.id,
    definitionId = definition?.id;
  if (!token || !id || !definitionId || !shopReady() || !definitionReady())
    throw new Error('Gegenstand und Shop auswählen.');
  if (
    !(await flushItems()) ||
    !owned(token, g) ||
    shop?.shop.id !== id ||
    definition?.id !== definitionId ||
    !definitionReady()
  )
    return;
  if (
    prices &&
    (!stockIntent ||
      stockIntent.token !== token ||
      stockIntent.epoch !== g ||
      stockIntent.shopId !== id ||
      stockIntent.definitionId !== definitionId ||
      stockIntent.revision !== definition.revision)
  )
    throw new Error('Gegenstand oder Shop inzwischen geändert. Preise erneut eingeben.');
  if (definition.unitCopper === null && !prices) {
    stockIntent = { token, epoch: g, shopId: id, definitionId, revision: definition.revision };
    el('stock-price-title').textContent = definition.name + ' · kein veröffentlichter Richtwert';
    el<HTMLInputElement>('stock-buy').value = '';
    el<HTMLInputElement>('stock-sell').value = '';
    el<HTMLDialogElement>('stock-price-dialog').showModal();
    return;
  }
  collectShop();
  shop.shop.stock.push({
    id: crypto.randomUUID(),
    reference: { kind: 'authored', definitionId: definition.id, revision: definition.revision },
    quantity: 1,
    unique: false,
    instanceId: null,
    buyCopper: prices?.buy ?? definition.unitCopper!,
    sellCopper: prices?.sell ?? definition.unitCopper!,
    notes: '',
    restock: null,
  });
  if (!shop.items.some((d) => d.id === definition!.id)) shop.items.push(definition);
  dirtyShop = true;
  renderShop(true);
  if (prices) el<HTMLDialogElement>('stock-price-dialog').close();
}
function renderStockKeepingText() {
  collectShop();
  renderShop(true);
}
async function loadSeller() {
  const w = workspace,
    g = editorSession.generation,
    id = value('shop-seller'),
    request = ++sellerRequest;
  if (!w || !contextReady) return;
  const select = el<HTMLSelectElement>('shop-sale-item'),
    old = select.value;
  sellerLoading = true;
  sellerError = '';
  loadedSeller = null;
  ledger = [];
  select.replaceChildren();
  lockShopContext();
  const current = () =>
    owned(w.token, g) && request === sellerRequest && value('shop-seller') === id;
  try {
    const items: LedgerItem[] = [],
      problems: LedgerInventoryPage['problems'] = [];
    let cursor: string | null = null,
      unavailableCount = 0;
    if (id)
      do {
        const response = await window.campaign.ledgerInventory(w.token, {
          characterId: id,
          after: cursor,
        });
        if (!current()) return;
        const page = unwrap(response);
        if (page.items.some((l) => l.characterId !== id))
          throw new Error('Inventarantwort gehört zu einer anderen Figur.');
        items.push(...page.items.filter((l) => l.quantity > 0));
        problems.push(...page.problems.slice(0, 50 - problems.length));
        unavailableCount += page.problems.length;
        cursor = page.next;
      } while (cursor);
    if (!current()) return;
    ledger = items;
    loadedSeller = id;
    const status = el('shop-sale-problems');
    status.textContent = unavailableCount
      ? unavailableCount + ' Einträge nicht verfügbar. Nur geprüfte Einträge sind auswählbar.'
      : '';
    el('shop-sale-problem-details').hidden = !unavailableCount;
    el('shop-sale-problem-list').textContent =
      problems.map((p) => p.id + ': ' + p.message).join('\n') +
      (unavailableCount > problems.length ? '\nWeitere Hinweise im persönlichen Ledger.' : '');
    for (const l of ledger) option(select, l.id, l.quantity + ' × ' + (l.currentName ?? l.name));
    if (ledger.some((l) => l.id === old)) select.value = old;
    salePrice();
  } catch (error) {
    if (current()) sellerError = (error as Error).message;
  } finally {
    if (current()) {
      sellerLoading = false;
      lockShopContext();
    }
  }
}
function salePrice() {
  if (!/^[0-9]+$/.test(value('shop-sale-quantity'))) return;
  const l = ledger.find((l) => l.id === value('shop-sale-item'));
  if (!l) return;
  const e = shop ? shopStockForItem(shop.shop.stock, l) : undefined;
  const quote =
    e?.sellCopper ?? (l.currentUnitCopper !== undefined ? l.currentUnitCopper : l.unitCopper);
  el<HTMLInputElement>('shop-sale-price').value =
    quote === null ? '' : amount(BigInt(quote) * BigInt(value('shop-sale-quantity') || '1') + '');
}
function lockItemActions() {
  const blocked = !!workspace && hasPendingCommit(workspace.campaign.id);
  if (!blocked) {
    for (const [button, disabled] of lockedButtons) button.disabled = disabled;
    lockedButtons.clear();
    lockShopContext();
    return;
  }
  for (const button of el('items').querySelectorAll<HTMLButtonElement>('button')) {
    if (!lockedButtons.has(button)) lockedButtons.set(button, button.disabled);
    button.disabled = true;
  }
  lockShopContext();
}
async function recoveredItems(event: CommitResolution) {
  const w = workspace,
    g = editorSession.generation;
  if (!w || event.ref.campaignId !== w.campaign.id) return;
  if (!definition && !shop && !dirtyDefinition && !dirtyShop) {
    const ack = event.ref.family === 'items' ? (event.value as ItemShopAck) : null;
    await openItems(ack?.shop?.shop.id);
    if (owned(w.token, g) && ack?.definition) await selectDefinition(ack.definition.id);
    return;
  }
  const meta = event.meta as
    | {
        owner: string;
        token: string;
        epoch: number;
        action: ItemShopAction;
        fields: string;
        snapshot: Shop | null;
      }
    | undefined;
  if (event.ref.family === 'items' && meta?.owner === 'items' && owned(meta.token, meta.epoch)) {
    const result = event.value as ItemShopAck;
    if (
      meta.action.kind === 'definition' &&
      result.definition &&
      definition?.id === meta.action.definition.id &&
      definition.revision === (meta.action.expectedRevision ?? 0)
    ) {
      dirtyDefinition = meta.fields !== definitionFields();
      definition = result.definition;
      lastDefinitionSave = {
        id: definition.id,
        fields: meta.fields,
        revision: definition.revision,
      };
      renderDefinition();
    } else if (
      result.shop &&
      meta.snapshot &&
      shop?.shop.id === meta.snapshot.id &&
      shop.shop.revision === meta.snapshot.revision
    ) {
      dirtyShop = meta.fields !== shopFields();
      mergeShop(result.shop, meta.snapshot);
      renderShop();
    }
  }
  const response = await window.campaign.live(w.token);
  if (!owned(w.token, g)) return;
  roster = unwrap(response).roster;
  await loadSeller();
}
export function initItems(status: typeof tell, open: typeof enter) {
  tell = status;
  enter = open;
  initCommitControls(() => workspace, status);
  onCommitState(lockItemActions);
  onCommitResolved(recoveredItems);
  el('items').innerHTML =
    `<div class="toolbar" aria-label="Gegenstände und Shops"><button id="items-show-catalog" type="button" aria-pressed="true">Gegenstandskatalog</button><button id="items-show-shops" type="button" aria-pressed="false">Shops</button></div><p id="item-context-status" role="status" hidden></p><button id="item-context-retry" type="button" hidden>Vergabe und Shops erneut laden</button><section id="items-catalog"><div class="catalog-heading"><h2>Gegenstände und Shops</h2><p id="items-source"></p></div><div class="items-columns"><section><div class="toolbar"><button id="item-new" type="button">Neuer Gegenstand</button></div><form id="items-search-form"><label for="item-search">Suchen</label><input id="item-search" type="search" placeholder="Name, Beschreibung oder Eigenschaft"><details id="item-filters"><summary id="item-filter-summary">Filter und Sortierung</summary><div class="combat-fields"><label>Kategorie<select id="item-filter-category"><option value="">Alle</option>${Object.entries(
      categories,
    )
      .map(([id, n]) => `<option value="${id}">${n}</option>`)
      .join(
        '',
      )}</select></label><label>Magisch<select id="item-filter-magic"><option value="">Alle</option><option value="yes">Ja</option><option value="no">Nein</option></select></label><label>Seltenheit<input id="item-filter-rarity"></label><label>Einstimmung<select id="item-filter-attunement"><option value="">Alle</option><option value="yes">Ja</option><option value="no">Nein</option><option value="unspecified">Offen</option></select></label><label>Sortierung<select id="item-sort"><option value="name">Name</option><option value="value">Wert</option></select></label><label>Richtung<select id="item-direction"><option value="asc">Aufsteigend</option><option value="desc">Absteigend</option></select></label></div><label class="check-label"><input id="item-trash-filter" type="checkbox"> Papierkorb anzeigen</label></details><div class="toolbar"><button type="submit">Suchen</button><button id="item-filter-reset" type="button" hidden>Filter zurücksetzen</button></div></form><div id="items-results" class="item-list"></div><div class="toolbar"><button id="items-prev">← Zurück</button><p id="items-page"></p><button id="items-next">Weiter →</button></div></section><section><p id="item-load-status" role="status" hidden></p><button id="item-load-retry" type="button" hidden>Gegenstand erneut laden</button><p id="item-empty">Wähle einen Gegenstand oder lege eine eigene Definition an.</p><div id="item-editor" hidden><article id="item-reference" aria-labelledby="item-reference-title"><h3 id="item-reference-title"></h3><p id="item-reference-facts" class="caption"></p><p id="item-reference-properties"></p><div id="item-reference-description"></div><p id="item-source" class="caption"></p><a id="item-source-link" target="_blank" rel="noopener noreferrer">Quellenseite im SRD-PDF</a></article><div class="toolbar"><button id="item-copy" type="button">Duplizieren</button></div><details id="item-editing"><summary>Definition bearbeiten</summary><form id="item-form"><label for="item-name">Name</label><input id="item-name" required maxlength="1000"><div class="combat-fields"><label>Kategorie<select id="item-category">${Object.entries(
      categories,
    )
      .map(([id, n]) => `<option value="${id}">${n}</option>`)
      .join(
        '',
      )}</select></label><label>Richtwert pro Stück (GM, optional)<input id="item-value" placeholder="Wert offen"></label><label>Seltenheit<input id="item-rarity" placeholder="Zum Beispiel ungewöhnlich"></label><label>Einstimmung<select id="item-attunement"><option value="unspecified">Offen</option><option value="no">Nein</option><option value="yes">Ja</option></select></label></div><label class="check-label"><input id="item-magic" type="checkbox"> Magisch</label><label>Gewicht<input id="item-weight"></label><label>Eigenschaften (kommagetrennt)<input id="item-properties"></label><label>Beschreibung<textarea id="item-description" rows="6"></textarea></label><div class="toolbar"><button id="item-save" type="submit">Definition speichern</button><button id="item-trash" type="button">Papierkorb</button></div></form></details><details id="item-usage"><summary>Beute vergeben oder Shopbestand ergänzen</summary><label>Figur<select id="item-recipient"></select></label><div class="time-fields"><label>Menge<input id="item-award-quantity" type="number" min="1" value="1"></label><p class="caption">Vergaben verwenden den Richtwert der Definition. Offene Werte bleiben unbekannt; für einen eigenen Richtwert zuerst eine Kopie anlegen.</p><input id="item-award-value" type="hidden" value="0"></div><div class="toolbar"><button id="item-award">Als persönliche Beute vergeben</button><button id="item-treasure">Unverteilte Beute anlegen</button><button id="shop-add-item">Zum gewählten Shop hinzufügen</button><button id="item-open-shop" type="button" disabled>Shop öffnen</button></div></details></div></section></div></section><section id="items-shops" hidden><div class="catalog-heading"><h2>Shops</h2><p>Handel bucht Gegenstände und Preise. Münzen werden am Charakterbogen verwaltet.</p></div><div class="items-columns"><section><button id="shop-new">Neuer Shop</button><label class="check-label"><input id="shops-trash-filter" type="checkbox"> Pausierte Shops und Papierkorb anzeigen</label><div id="shops-list" class="item-list"></div></section><section id="shop-editor" hidden><p id="shop-load-status" role="status" hidden></p><button id="shop-load-retry" type="button" hidden>Shop erneut laden</button><fieldset id="shop-fields"><h3 id="shop-title"></h3><p id="shop-availability"></p><label>Handelnde Figur<select id="shop-seller"></select></label><p id="shop-trader-note" class="caption" hidden>Inaktive Figuren können verkaufen. Für einen Kauf eine aktive Figur wählen.</p><details id="shop-settings"><summary>Shop, Zeitbasis und Warenauffüllung bearbeiten</summary><form id="shop-form"><label>Name<input id="shop-name" required></label><label>Besitzer<select id="shop-owner"></select></label><label>Notizen<textarea id="shop-notes" rows="3"></textarea></label><div class="toolbar"><button type="submit">Shop und Bestand speichern</button><button id="shop-trash" type="button">Papierkorb</button></div></form><p id="shop-time" class="caption"></p><button id="shop-time-refresh" type="button">Zeitbasis aktualisieren</button><div id="shop-restock"></div></details><div id="shop-stock"></div><h3 id="shop-sale-heading">An diesen Shop verkaufen</h3><p id="shop-sale-problems" class="caption" role="status"></p><details id="shop-sale-problem-details" hidden><summary>Nicht verfügbare Einträge</summary><p id="shop-sale-problem-list" class="caption"></p></details><form id="shop-sale-form"><p id="shop-seller-status" role="status" hidden></p><button id="shop-seller-retry" type="button" hidden>Inventar erneut laden</button><fieldset id="shop-sale-fields"><label>Verfügbare Gegenstände<select id="shop-sale-item"></select></label><div class="time-fields"><label>Menge<input id="shop-sale-quantity" type="number" min="1" value="1"></label><label>Tatsächlich erhalten (GM gesamt)<input id="shop-sale-price" value="0"></label></div><label>Notiz<input id="shop-sale-note"></label><details><summary>Preise für neuen Shopbestand bei unbekanntem Wert</summary><label>Shop kauft pro Stück (GM)<input id="shop-new-buy-price"></label><label>Shop verkauft pro Stück (GM)<input id="shop-new-sell-price"></label></details><button id="shop-sale-submit" type="submit">Verkauf buchen</button></fieldset></form><details><summary>Handels- und Auffüllverlauf</summary><div id="shop-history"></div><p id="shop-history-status" role="status" tabindex="-1"></p><button id="shop-history-more" type="button" hidden>Ältere Einträge laden</button></details></fieldset></section></div></section>`;
  const stockDialog = document.createElement('dialog');
  stockDialog.id = 'stock-price-dialog';
  stockDialog.innerHTML =
    '<form id="stock-price-form"><h2 id="stock-price-title"></h2><p>Verkaufs- und Ankaufspreis dieses Shops ausdrücklich wählen. Der SRD-Richtwert bleibt offen.</p><label>Verkaufspreis pro Stück (GM)<input id="stock-buy" required></label><label>Ankaufspreis pro Stück (GM)<input id="stock-sell" required></label><div class="actions"><button id="stock-price-cancel" type="button">Abbrechen</button><button type="submit">Mit diesen Preisen hinzufügen</button></div></form>';
  el('items').append(stockDialog);
  el('stock-price-cancel').onclick = () => stockDialog.close();
  el('stock-price-form').onsubmit = (e) => {
    e.preventDefault();
    run(() => addShopItem({ buy: copper(value('stock-buy')), sell: copper(value('stock-sell')) }));
  };
  el('item-context-retry').onclick = () => run(() => openItems());
  el('item-load-retry').onclick = () => {
    if (requestedDefinition) run(() => selectDefinition(requestedDefinition!));
  };
  el('item-source-link').onclick = (e) => {
    e.preventDefault();
    if (!definitionReady()) return;
    run(async () => {
      if (workspace && definition)
        unwrap(await window.campaign.openItemSource(workspace.token, definition.id));
    });
  };
  el('shop-time-refresh').onclick = () => run(refreshShopClock);
  el('item-form').oninput = () => {
    if (definitionReady() && definition?.source.kind !== 'srd51') dirtyDefinition = true;
  };
  el('item-form').onchange = () => {
    if (definitionReady() && definition?.source.kind !== 'srd51') dirtyDefinition = true;
  };
  el('shop-form').oninput = () => {
    if (shopReady()) dirtyShop = true;
  };
  el('shop-form').onchange = () => {
    if (shopReady()) dirtyShop = true;
  };
  const filters = [
    'item-filter-category',
    'item-filter-magic',
    'item-filter-rarity',
    'item-filter-attunement',
  ];
  const summarizeFilters = () => {
    const labels = filters
      .filter((id) => value(id).trim())
      .map((id) => {
        const node = el<HTMLSelectElement>(id);
        return id === 'item-filter-rarity'
          ? 'Seltenheit: ' + node.value
          : (id === 'item-filter-category'
              ? 'Kategorie: '
              : id === 'item-filter-magic'
                ? 'Magisch: '
                : 'Einstimmung: ') +
              (node.options?.[node.selectedIndex]?.textContent ?? node.value);
      });
    if (value('item-sort') !== 'name' || value('item-direction') !== 'asc')
      labels.push('Sortierung geändert');
    if (el<HTMLInputElement>('item-trash-filter').checked) labels.push('mit Papierkorb');
    el('item-filter-summary').textContent = labels.length
      ? 'Filter: ' + labels.join(' · ')
      : 'Filter und Sortierung';
    el('item-filter-reset').hidden = !labels.length;
  };
  const scheduleSearch = () => {
    summarizeFilters();
    clearSearchTimer();
    searchRequest++;
    offset = 0;
    clearItemResults('Gegenstände werden gesucht…');
    searchTimer = setTimeout(() => {
      searchTimer = null;
      void search();
    }, 200);
  };
  el('item-search').oninput = scheduleSearch;
  for (const id of [...filters, 'item-sort', 'item-direction', 'item-trash-filter']) {
    el(id).oninput = scheduleSearch;
    el(id).onchange = scheduleSearch;
  }
  el('item-filter-reset').onclick = () => {
    for (const id of filters) el<HTMLInputElement>(id).value = '';
    el<HTMLSelectElement>('item-sort').value = 'name';
    el<HTMLSelectElement>('item-direction').value = 'asc';
    el<HTMLInputElement>('item-trash-filter').checked = false;
    summarizeFilters();
    offset = 0;
    void search();
  };
  el('items-search-form').onsubmit = (e) => {
    e.preventDefault();
    summarizeFilters();
    offset = 0;
    void search();
  };
  el('items-prev').onclick = () => {
    const b = el<HTMLButtonElement>('items-prev');
    if (b.disabled) return;
    b.disabled = true;
    offset = Math.max(0, offset - 40);
    void search();
  };
  el('items-next').onclick = () => {
    const b = el<HTMLButtonElement>('items-next');
    if (b.disabled || next === null) return;
    b.disabled = true;
    offset = next;
    void search();
  };
  el('item-form').onsubmit = (e) => {
    e.preventDefault();
    if (!definitionReady()) return;
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        id = definition?.id;
      if ((await flushItems()) && owned(token, g) && definition?.id === id) {
        renderDefinition();
        renderShop();
        await search();
        tell('Gegenstand gespeichert.');
      }
    });
  };
  el('shop-form').onsubmit = (e) => {
    e.preventDefault();
    if (!shopReady()) return;
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        id = shop?.shop.id;
      if ((await flushItems()) && owned(token, g) && shop?.shop.id === id) {
        renderShop();
        await loadShops();
        tell('Shop gespeichert.');
      }
    });
  };
  el('item-new').onclick = () =>
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        intent = ++definitionRequest;
      if (!(await flushItems()) || !owned(token, g) || intent !== definitionRequest) return;
      const fresh: ItemDefinition = {
        id: crypto.randomUUID(),
        revision: 0,
        name: '',
        category: 'equipment',
        magic: false,
        rarity: '',
        attunement: 'unspecified',
        unitCopper: null,
        weightText: '',
        properties: [],
        description: '',
        source: { kind: 'authored', label: 'Eigener Gegenstand', license: null, url: null },
        trashed: false,
      };
      showDefinition(fresh);
      el('item-name').focus();
    });
  el('item-copy').onclick = () => {
    if (!definitionReady()) return;
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        id = definition?.id;
      if (
        !id ||
        !(await flushItems()) ||
        !owned(token, g) ||
        definition?.id !== id ||
        !definitionReady()
      )
        return;
      showDefinition(
        {
          ...structuredClone(definition),
          id: crypto.randomUUID(),
          revision: 0,
          name: definition.name + ' – Kopie',
          source: {
            ...definition.source,
            kind: 'authored',
            label:
              definition.source.kind === 'srd51'
                ? 'Eigene Kopie aus ' + definition.source.label
                : 'Eigener Gegenstand',
          },
          trashed: false,
        },
        true,
      );
      el('item-name').focus();
    });
  };
  el('item-trash').onclick = () => {
    if (!definitionReady()) return;
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        id = definition?.id;
      if (
        !id ||
        !(await flushItems()) ||
        !owned(token, g) ||
        definition?.id !== id ||
        !definitionReady()
      )
        return;
      const result = await command({
        kind: 'definition-trash',
        id,
        expectedRevision: definition.revision,
        trashed: !definition.trashed,
      });
      if (!owned(token, g) || definition?.id !== id || !definitionReady()) return;
      definition = result.definition!;
      renderDefinition();
      await search();
    });
  };
  const itemInput = (d: ItemDefinition, quantity: string, valueGold: string) => ({
    name: d.name,
    category: d.category,
    quantity: Number(quantity),
    valueGold,
    reference: { kind: 'authored' as const, definitionId: d.id, revision: d.revision },
  });
  el('item-award').onclick = () => {
    if (!definitionReady()) return;
    run(() =>
      performTrade(async () => {
        const w = workspace,
          g = editorSession.generation,
          id = definition?.id,
          c = roster.find((c) => c.id === value('item-recipient')),
          quantity = value('item-award-quantity'),
          price = value('item-award-value');
        if (!w || !id || !c || !definitionReady() || !contextReady || contextLoading) return;
        if (
          !(await flushDrafts()) ||
          !owned(w.token, g) ||
          definition?.id !== id ||
          !definitionReady()
        )
          return;
        const request = {
          commandId: crypto.randomUUID(),
          campaignId: w.campaign.id,
          token: w.token,
          action: {
            kind: 'manual-item' as const,
            characterId: c.id,
            expectedMembershipRevision: c.membershipRevision,
            origin: 'award' as const,
            item: itemInput(definition, quantity, price),
            note: 'Aus dem Itemkatalog vergeben',
          },
        };
        const result = await writeConfirmed<ProgressAck>(
          'progress',
          request,
          () => window.campaign.executeProgress(request),
          () => owned(w.token, g),
          { owner: 'items', token: w.token, epoch: g },
        );
        if (!owned(w.token, g)) return;
        void result;
        tradeConfirmed = true;
        await refreshProgress();
        if (!owned(w.token, g)) return;
        await loadSeller();
        if (owned(w.token, g)) tell('Persönliche Beute vergeben.');
      }),
    );
  };
  el('item-treasure').onclick = () => {
    if (!definitionReady()) return;
    run(() =>
      performTrade(async () => {
        const w = workspace,
          g = editorSession.generation,
          id = definition?.id,
          quantity = value('item-award-quantity'),
          price = value('item-award-value');
        if (!w || !id || !definitionReady() || !contextReady || contextLoading) return;
        if (
          !(await flushDrafts()) ||
          !owned(w.token, g) ||
          definition?.id !== id ||
          !definitionReady()
        )
          return;
        const response = await window.campaign.live(w.token);
        if (!owned(w.token, g) || definition?.id !== id || !definitionReady()) return;
        const live = unwrap(response);
        const request = {
          commandId: crypto.randomUUID(),
          campaignId: w.campaign.id,
          token: w.token,
          action: {
            kind: 'treasure' as const,
            title: definition.name,
            sceneId: live.scene?.id ?? null,
            items: [itemInput(definition, quantity, price)],
          },
        };
        await writeConfirmed<ProgressAck>(
          'progress',
          request,
          () => window.campaign.executeProgress(request),
          () => owned(w.token, g),
          { owner: 'items', token: w.token, epoch: g },
        );
        if (!owned(w.token, g)) return;
        tradeConfirmed = true;
        await refreshProgress();
        if (owned(w.token, g)) tell('Unverteilte Beute angelegt.');
      }),
    );
  };
  el('shop-new').onclick = () =>
    run(async () => {
      const token = workspace?.token,
        g = editorSession.generation,
        intent = ++shopRequest;
      if (
        !(await flushItems()) ||
        !owned(token, g) ||
        intent !== shopRequest ||
        !sources ||
        !contextReady ||
        contextLoading
      )
        return;
      const location = sources.locations.find((l) => !l.trashed),
        npc = sources.notes.find((n) => n.note.kind === 'npc' && !n.trashed);
      if (!location && !npc) throw new Error('Lege zuerst einen Ort oder NPC in der Welt an.');
      const s: Shop = {
        id: crypto.randomUUID(),
        revision: 0,
        name: '',
        owner: location
          ? { kind: 'location', id: location.document.id }
          : { kind: 'npc', id: npc!.note.id },
        notes: '',
        trashed: false,
        stock: [],
      };
      requestedShop = s.id;
      shopLoading = false;
      shopError = '';
      el<HTMLDetailsElement>('shop-settings').open = true;
      shop = {
        shop: s,
        ownerName: location?.document.name ?? npc!.note.title,
        unavailable: false,
        timeNotice: null,
        items: [],
        history: [],
      };
      renderShop();
      lockShopContext();
      el('shop-name').focus();
    });
  el('shop-add-item').onclick = () => run(() => addShopItem());
  el('shops-trash-filter').onchange = () => run(loadShops);
  el('shop-trash').onclick = () =>
    run(async () => {
      if (!shopReady()) return;
      const token = workspace?.token,
        g = editorSession.generation,
        id = shop?.shop.id;
      if (!id || !(await flushItems()) || !owned(token, g) || shop?.shop.id !== id) return;
      shop.shop.trashed = !shop.shop.trashed;
      dirtyShop = true;
      if ((await flushItems()) && owned(token, g) && shop?.shop.id === id) {
        renderShop();
        await loadShops();
      }
    });
  el('shop-history-more').onclick = () => void loadOlderShopHistory();
  el('shop-load-retry').onclick = () => {
    if (requestedShop) run(() => selectShop(requestedShop!));
  };
  el('shop-seller-retry').onclick = () => run(loadSeller);
  el('shop-seller').onchange = () => {
    void loadSeller();
  };
  el('items-show-catalog').onclick = () =>
    run(async () => {
      if (await flushItems()) showItemsArea('catalog');
    });
  el('items-show-shops').onclick = () =>
    run(async () => {
      if (await flushItems()) showItemsArea('shops');
    });
  el('item-open-shop').onclick = () =>
    run(async () => {
      if (await flushItems()) showItemsArea('shops');
    });
  el('shop-sale-item').onchange = salePrice;
  el('shop-sale-quantity').oninput = salePrice;
  el('shop-sale-form').onsubmit = (e) => {
    e.preventDefault();
    if (!shopReady() || !sellerReady()) return;
    run(() =>
      performTrade(async () => {
        const w = workspace,
          g = editorSession.generation,
          id = shop?.shop.id,
          l = ledger.find((l) => l.id === value('shop-sale-item')),
          quantity = Number(value('shop-sale-quantity')),
          actualGold = value('shop-sale-price'),
          notes = value('shop-sale-note'),
          newStockPrices =
            value('shop-new-buy-price') || value('shop-new-sell-price')
              ? { buyGold: value('shop-new-buy-price'), sellGold: value('shop-new-sell-price') }
              : undefined;
        if (!w || !id || !l || l.characterId !== value('shop-seller')) return;
        const seller = value('shop-seller');
        if (!(await flushDrafts()) || !owned(w.token, g) || shop?.shop.id !== id) return;
        const response = await window.campaign.itemDefinition(l.reference.definitionId);
        if (!owned(w.token, g) || shop?.shop.id !== id) return;
        const d = unwrap(response);
        if (!sellerReady() || value('shop-seller') !== seller) return;
        const snapshot = structuredClone(shop.shop);
        const result = await command(
          {
            kind: 'sell',
            shopId: id,
            expectedRevision: shop.shop.revision,
            ledgerId: l.id,
            expectedLedgerRevision: l.revision,
            expectedDefinitionRevision: d.revision,
            quantity,
            actualGold,
            notes,
            ...(newStockPrices ? { newStockPrices } : {}),
          },
          snapshot,
        );
        if (!owned(w.token, g) || shop?.shop.id !== id) return;
        applyTradeShop(result.shop!, snapshot);
        await loadSeller();
        if (!owned(w.token, g)) return;
        await refreshProgress();
        if (owned(w.token, g)) tell('Verkauf gebucht.');
      }),
    );
  };
}
export async function renderSceneShops(token: string, sceneId: string, root: HTMLElement) {
  const g = editorSession.generation,
    request = (sceneShopRequests.get(root) ?? 0) + 1;
  sceneShopRequests.set(root, request);
  const response = await window.campaign.sceneShops(token, sceneId);
  if (!owned(token, g) || sceneShopRequests.get(root) !== request) return;
  const list = unwrap(response);
  root.replaceChildren();
  for (const s of list)
    root.append(
      s.problem
        ? shopProblem(s, true)
        : button('Shop öffnen: ' + s.name + ' · ' + s.ownerName, () => enter(s.id)),
    );
}

editorSession.observeDraft(() => ({
  openInput: dirtyDefinition || dirtyShop,
  retainedDraft: false,
  unresolvedCommand: !!workspace && hasPendingCommit(workspace.campaign.id),
}));
