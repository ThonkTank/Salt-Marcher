import { EditorSession } from '../shared/editor-session';
import { ItemReferenceCatalog } from './item-reference-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { Creature, CreatureCatalogQuery } from '../../features/catalog/creature-catalog';
import { renderCreatureDetail } from './creature-detail-ui';
import { xpLevel } from '../runtime/progression';
import {
  initGeneration,
  activateGeneration,
  flushGeneration,
  generationPlanningChanged,
  generationCatalogFiltersChanged,
  generationCreature,
  refreshGeneration,
} from '../campaign/generation-ui';
import { creatureCatalogReference } from './catalog-reference-contracts';
import {
  assessEncounter,
  encounterEntryLabel,
  validateEncounterPlanInput,
  type CatalogInfo,
  type CreaturePage,
  type EncounterPlan,
} from './encounter-contracts';
export const editorSession = new EditorSession();
const savingWork = editorSession.operation<Promise<boolean>>();

export { renderCreatureDetail } from './creature-detail-ui';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let itemReference: ItemReferenceCatalog | null = null,
  catalogContent: 'monster' | 'items' = 'monster';
function catalogContentView(content: 'monster' | 'items') {
  if (content === 'items') {
    clearSearchTimer();
    suspendCatalogInfo();
    searchRequest++;
    creatureRequest++;
    get('catalog-table').setAttribute('aria-busy', 'false');
    if (get('catalog-detail').getAttribute('aria-busy') === 'true') renderCreatureSelection();
  }
  catalogContent = content;
  get('catalog-monsters').hidden = content !== 'monster';
  itemReference?.show(content === 'items');
  for (const [id, on] of [
    ['catalog-monsters-tab', content === 'monster'],
    ['catalog-items-tab', content === 'items'],
  ] as const) {
    get(id).setAttribute('aria-selected', String(on));
    get(id).tabIndex = on ? 0 : -1;
  }
  if (content === 'monster') void refreshCatalogInfo();
}
let workspace: WorkspaceGeometry | null = null,
  info: CatalogInfo | null = null,
  page: CreaturePage | null = null,
  creature: Creature | null = null,
  plan: EncounterPlan | null = null;
let infoRequest = 0,
  infoPending: Promise<void> | null = null;
function suspendCatalogInfo() {
  infoRequest++;
  infoPending = null;
}
let searchRequest = 0,
  listRequest = 0,
  planRequest = 0,
  creatureRequest = 0,
  partyRequest = 0,
  editVersion = 0,
  offset = 0,
  sort: CreatureCatalogQuery['sort'] = 'name',
  blocked = false,
  dirty = false;
const owned = (token: string | undefined, g: number) =>
  editorSession.generation === g && workspace?.token === token;
let timer: ReturnType<typeof setTimeout> | null = null,
  searchTimer: ReturnType<typeof setTimeout> | null = null;
let tell: (text: string, error?: boolean) => void, prepare: (plan: EncounterPlan) => Promise<void>;
let tableLookupQuery: CreatureCatalogQuery | null = null,
  startingPlan = false;
type CreatureReading =
  | { kind: 'catalog'; id: string }
  | {
      kind: 'saved';
      id: string;
      source: Creature | null;
      planId: string;
      planName: string;
      revision: number;
      pending: boolean;
    };
let reading: CreatureReading | null = null,
  readingHistory: CreatureReading[] = [],
  readingPosition = -1;
function rememberReading(next: CreatureReading) {
  const key = (r: CreatureReading) =>
    r.kind === 'catalog' ? 'catalog:' + r.id : JSON.stringify([r.planId, r.revision, r.id]);
  if (readingPosition >= 0 && key(readingHistory[readingPosition]!) === key(next)) {
    readingHistory[readingPosition] = next;
    return;
  }
  readingHistory = readingHistory.slice(0, readingPosition + 1);
  readingHistory.push(next);
  if (readingHistory.length > 50) readingHistory.shift();
  readingPosition = readingHistory.length - 1;
}
function renderReadingControls(error = false) {
  get<HTMLButtonElement>('creature-reading-back').disabled = readingPosition <= 0;
  get<HTMLButtonElement>('creature-reading-forward').disabled =
    readingPosition < 0 || readingPosition >= readingHistory.length - 1;
  get('creature-reading-source').textContent =
    reading?.kind === 'saved'
      ? reading.pending
        ? 'Quellenstand im Vorlagenentwurf · ' +
          reading.planName +
          '. Dieser Entwurfsstand ist noch nicht als gespeicherte Vorlage bestätigt.'
        : 'Gespeicherter Quellenstand · ' +
          reading.planName +
          ' · Vorlagenrevision ' +
          reading.revision +
          '. Dieser Statblock bleibt unverändert, wenn sich der Katalog ändert.'
      : reading
        ? 'Aktueller Katalogstand · ' + reading.id
        : '';
  get('creature-reading-current').hidden = reading?.kind !== 'saved';
  get('creature-reading-retry').hidden = !error || reading?.kind !== 'catalog';
}

function renderCatalogPlan() {
  const button = get<HTMLButtonElement>('catalog-add');
  button.disabled = !creature || !workspace || blocked || startingPlan;
  button.textContent = startingPlan
    ? 'Vorlage wird angelegt …'
    : plan
      ? 'Zur Vorlage hinzufügen'
      : 'Neue Vorlage mit Auswahl beginnen';
  get('catalog-plan-open').textContent = plan
    ? 'Vorlage: ' + plan.name + ' ↓'
    : 'Gespeicherte Vorlagen / leere Vorlage ↓';
  const summary = get('catalog-plan-roster');
  summary.hidden = !plan;
  summary.textContent = plan
    ? (plan.entries.length
        ? plan.entries.map((e) => encounterEntryLabel(e, plan!.sources)).join(' · ')
        : 'Noch keine Kreaturen hinzugefügt.') +
      '\n' +
      get('encounter-assessment').textContent
    : '';
}
function clearSaveTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}
function clearSearchTimer() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
}
function clearResults(text: string, loading = false, error = false) {
  page = null;
  get('catalog-rows').replaceChildren();
  get('catalog-page').textContent = text;
  get('catalog-page').setAttribute('role', error ? 'alert' : 'status');
  get('catalog-table').setAttribute('aria-busy', String(loading));
  get<HTMLButtonElement>('catalog-prev').disabled = true;
  get<HTMLButtonElement>('catalog-next').disabled = true;
}
function renderCatalogControls() {
  const chips = get('catalog-filter-chips');
  chips.replaceChildren();
  for (const input of get('catalog-filters').querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input,select',
  )) {
    if (
      input.id === 'catalog-direction' ||
      !input.value ||
      (input.id === 'catalog-cr-min' && Number(input.value) === 0)
    )
      continue;
    const label =
      document.querySelector<HTMLLabelElement>('label[for="' + input.id + '"]')?.textContent ??
      input.id;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = label + ': ' + input.value + ' ×';
    chip.setAttribute('aria-label', label + ' entfernen');
    chip.onclick = () => {
      input.value = '';
      input.oninput?.call(input, new Event('input'));
      input.focus();
    };
    chips.append(chip);
  }
  chips.hidden = !chips.childElementCount;
  for (const button of get('catalog-table').querySelectorAll<HTMLButtonElement>('thead button')) {
    const column = button.dataset.sort!,
      active = column === sort;
    button.textContent =
      ({ name: 'Name', cr: 'HG', ac: 'RK', hp: 'HP', xp: 'XP' } as Record<string, string>)[column] +
      (active ? (value('catalog-direction') === 'desc' ? ' ↓' : ' ↑') : '');
    button.parentElement?.setAttribute(
      'aria-sort',
      active ? (value('catalog-direction') === 'desc' ? 'descending' : 'ascending') : 'none',
    );
  }
}
function adoptPlan(next: EncounterPlan, invalidateRequests = true) {
  clearSaveTimer();
  savingWork.value = null;
  if (invalidateRequests) planRequest++;
  partyRequest++;
  editVersion++;
  plan = next;
  dirty = next.revision === 0;
  blocked = false;
  get<HTMLDetailsElement>('encounter-library').open = false;
  get<HTMLDetailsElement>('encounter-party-details').open = next.party.length === 0;
  renderPlan();
}
export function activateCatalog(next: WorkspaceGeometry) {
  clearSaveTimer();
  clearSearchTimer();
  suspendCatalogInfo();
  savingWork.value = null;
  itemReference?.activate();
  workspace = next;
  startingPlan = false;
  editorSession.generation++;
  searchRequest++;
  clearResults('Katalog noch nicht geladen.');
  listRequest++;
  planRequest++;
  creatureRequest++;
  partyRequest++;
  plan = null;
  creature = null;
  reading = null;
  readingHistory = [];
  readingPosition = -1;
  dirty = false;
  blocked = false;
  get('catalog-add-result').hidden = true;
  get<HTMLDetailsElement>('encounter-library').open = true;
  editVersion++;
  get('encounter-editor').hidden = true;
  activateGeneration(next);
  renderCreatureSelection();
  void refreshPlans();
}
async function refreshCatalogInfo() {
  if (!workspace || catalogContent !== 'monster' || info) return;
  if (infoPending) return infoPending;
  const token = workspace.token,
    g = editorSession.generation,
    request = ++infoRequest,
    credit = get('catalog-credit');
  const current = () => owned(token, g) && catalogContent === 'monster' && request === infoRequest;
  credit.textContent = 'Quellen- und Filterangaben werden geladen …';
  credit.setAttribute('role', 'status');
  // Defer dispatch until the shared promise exists, including synchronous bridge failures.
  infoPending = Promise.resolve().then(async () => {
    try {
      if (!current()) return;
      const response = await window.campaign.creatureInfo();
      if (!current() || info) return;
      info = unwrap(response);
      credit.textContent = info.notice;
      credit.removeAttribute('role');
      for (const [id, list] of [
        ['catalog-type', info.types],
        ['catalog-size', info.sizes],
        ['catalog-habitat', info.habitats],
        ['catalog-alignment', info.alignments],
        ['catalog-subtype', info.subtypes],
      ] as const)
        for (const v of list) option(get<HTMLSelectElement>(id), v, v);
    } catch (error) {
      if (current() && !info) {
        credit.textContent =
          'Quellen- und Filterangaben nicht verfügbar: ' + (error as Error).message;
        credit.setAttribute('role', 'alert');
        tell((error as Error).message, true);
      }
    } finally {
      if (request === infoRequest) infoPending = null;
    }
  });
  return infoPending;
}
// The bundled creature source is immutable for this run; keep its accepted page on return.
export async function openCatalog() {
  itemReference?.show(catalogContent === 'items');
  await Promise.all([
    refreshCatalogInfo(),
    catalogContent === 'monster' && !page ? search() : Promise.resolve(),
    refreshPlans(),
    refreshGeneration(),
  ]);
}
export async function openCreatureCatalog(current = () => true) {
  if (!current()) return;
  catalogContentView('monster');
  await openCatalog();
  if (current()) {
    get('catalog-browser').scrollIntoView({ block: 'start' });
    get<HTMLInputElement>('catalog-search').focus({ preventScroll: true });
  }
}
export async function openCatalogReference(
  ref: { kind: 'creature' | 'encounter'; id: string },
  stillCurrent = () => true,
) {
  if (!stillCurrent()) return;
  catalogContentView('monster');
  void openCatalog();
  if (ref.kind === 'creature') await selectCreature(ref.id);
  else await loadPlan(ref.id);
}
function option(select: HTMLSelectElement, id: string, text: string) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = text;
  select.append(o);
}
function normalizeChallengeRange(changed: HTMLInputElement | HTMLSelectElement) {
  if (changed.id !== 'catalog-cr-min' && changed.id !== 'catalog-cr-max') return;
  if (changed.value && Number.isFinite(Number(changed.value)) && Number(changed.value) < 0)
    changed.value = '0';
  const low = get<HTMLInputElement>('catalog-cr-min'),
    high = get<HTMLInputElement>('catalog-cr-max');
  if (
    !low.value ||
    !high.value ||
    !Number.isFinite(Number(low.value)) ||
    !Number.isFinite(Number(high.value)) ||
    Number(low.value) <= Number(high.value)
  )
    return;
  (changed === low ? high : low).value = changed.value;
}
function commitChallengeRange(changed: HTMLInputElement | HTMLSelectElement) {
  const before = [value('catalog-cr-min'), value('catalog-cr-max')].join('|');
  normalizeChallengeRange(changed);
  if (before !== [value('catalog-cr-min'), value('catalog-cr-max')].join('|'))
    changed.oninput?.call(changed, new Event('input'));
}
function query(): CreatureCatalogQuery {
  const q: CreatureCatalogQuery = {
    text: value('catalog-search'),
    offset,
    limit: 25,
    sort,
    direction: value('catalog-direction') as 'asc' | 'desc',
  };
  const fields = q as Record<string, unknown>;
  for (const [id, key, label] of [
    ['catalog-cr-min', 'crMin', 'HG von'],
    ['catalog-cr-max', 'crMax', 'HG bis'],
    ['catalog-ac-min', 'acMin', 'RK min.'],
    ['catalog-ac-max', 'acMax', 'RK max.'],
    ['catalog-hp-min', 'hpMin', 'HP min.'],
    ['catalog-hp-max', 'hpMax', 'HP max.'],
  ] as const) {
    const input = get<HTMLInputElement>(id),
      number = Number(input.value);
    // Native number controls expose incomplete input (e.g. "-") as an empty value.
    if (input.validity?.badInput || (input.value && (!Number.isFinite(number) || number < 0))) {
      input.setAttribute('aria-invalid', 'true');
      throw new Error(label + ': Eine gültige nichtnegative Zahl eingeben.');
    }
    input.removeAttribute('aria-invalid');
    if (input.value && !(key === 'crMin' && number === 0)) fields[key] = number;
  }
  if (q.crMin !== undefined && q.crMax !== undefined && q.crMin > q.crMax)
    throw new Error('HG-Bereich noch nicht bestätigt. Eingabe mit Tab oder Enter abschließen.');
  for (const [id, key] of [
    ['catalog-type', 'types'],
    ['catalog-subtype', 'subtypes'],
    ['catalog-size', 'sizes'],
    ['catalog-habitat', 'habitats'],
    ['catalog-alignment', 'alignments'],
  ])
    if (value(id!)) fields[key!] = [value(id!)];
  for (const [id, key] of [
    ['catalog-movement', 'movement'],
    ['catalog-senses', 'senses'],
    ['catalog-vulnerabilities', 'vulnerabilities'],
    ['catalog-resistances', 'resistances'],
    ['catalog-immunities', 'immunities'],
    ['catalog-condition-immunities', 'conditionImmunities'],
  ])
    if (value(id!)) fields[key!] = value(id!);
  return q;
}
// Reuse the catalog controls in the manager, but keep its lookups local to that task.
function beginTableLookup() {
  catalogContentView('monster');
  const token = workspace?.token,
    g = editorSession.generation,
    previousCreature = creature,
    previousReading = reading,
    previousHistory = [...readingHistory],
    previousPosition = readingPosition,
    previousOffset = offset,
    previousSort = sort;
  const fields = [
    ...get('catalog-form').querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'),
  ].map((node) => ({ node, value: node.value }));
  tableLookupQuery = structuredClone(query());
  creatureRequest++;
  return () => {
    tableLookupQuery = null;
    if (!owned(token, g)) return;
    clearSearchTimer();
    searchRequest++;
    creatureRequest++;
    offset = previousOffset;
    sort = previousSort;
    for (const field of fields) field.node.value = field.value;
    creature = previousCreature;
    reading = previousReading;
    readingHistory = previousHistory;
    readingPosition = previousPosition;
    renderCreatureSelection();
    void search();
  };
}
async function search() {
  if (catalogContent !== 'monster') return;
  renderCatalogControls();
  clearSearchTimer();
  const request = ++searchRequest,
    token = workspace?.token,
    g = editorSession.generation;
  clearResults('Kreaturen werden gesucht…', true);
  try {
    const response = await window.campaign.creatures(query());
    if (!owned(token, g) || request !== searchRequest) return;
    page = unwrap(response);
    renderRows();
  } catch (error) {
    if (owned(token, g) && request === searchRequest) {
      clearResults('Katalog konnte nicht geladen werden: ' + (error as Error).message, false, true);
      tell((error as Error).message, true);
    }
  }
}

function renderRows() {
  get('catalog-table').setAttribute('aria-busy', 'false');
  get('catalog-page').setAttribute('role', 'status');
  const body = get('catalog-rows');
  body.replaceChildren();
  for (const c of page?.rows ?? []) {
    const tr = document.createElement('tr'),
      td = document.createElement('td'),
      button = document.createElement('button');
    button.textContent = c.name;
    button.dataset.creatureId = c.id;
    button.setAttribute('aria-pressed', String(creature?.id === c.id));
    button.onclick = () => {
      void selectCreature(c.id);
    };
    td.append(button);
    tr.append(td);
    for (const text of [
      c.challengeRating,
      c.type,
      c.size,
      String(c.ac),
      String(c.hp),
      String(c.xp),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      tr.append(cell);
    }
    body.append(tr);
  }
  get('catalog-page').textContent = page?.total
    ? `${page.offset + 1}–${Math.min(page.total, page.offset + page.limit)} von ${page.total} Kreaturen`
    : 'Keine Kreaturen für diese Filter.';
  get<HTMLButtonElement>('catalog-prev').disabled = !page?.offset;
  get<HTMLButtonElement>('catalog-next').disabled = !page || page.offset + page.limit >= page.total;
}
function renderCreatureSelection(
  message = 'Wähle eine Kreatur, um ihren vollständigen Statblock anzusehen.',
  loading = false,
  error = false,
) {
  const root = get('catalog-detail');
  root.setAttribute('aria-busy', String(loading));
  const shown = reading?.kind === 'saved' ? reading.source : creature;
  if (shown) {
    root.removeAttribute('role');
    renderCreatureDetail(root, shown);
  } else {
    root.setAttribute('role', error ? 'alert' : 'status');
    root.textContent = message;
  }
  renderReadingControls(error);
  generationCreature(creature);
  for (const button of get('catalog-rows').querySelectorAll<HTMLButtonElement>(
    'button[data-creature-id]',
  ))
    button.setAttribute('aria-pressed', String(button.dataset.creatureId === creature?.id));
  renderCatalogPlan();
  get<HTMLButtonElement>('catalog-live-add').disabled = !creature || !workspace;
}
function revealCreatureDetail(fromPlan = false) {
  if (tableLookupQuery || (!fromPlan && !window.matchMedia?.('(max-width:1100px)').matches)) return;
  get('catalog-inspector').scrollIntoView({ block: 'start' });
  const detail = get('catalog-detail');
  detail.tabIndex = -1;
  detail.focus({ preventScroll: true });
}
async function selectCreature(id: string, fromPlan = false) {
  return showCreatureReading({ kind: 'catalog', id }, true, fromPlan);
}
async function showCreatureReading(next: CreatureReading, remember = true, fromPlan = false) {
  if (catalogContent !== 'monster') return;
  const token = workspace?.token,
    g = editorSession.generation,
    request = ++creatureRequest;
  reading = next;
  if (remember) rememberReading(next);
  creature = null;
  get('catalog-add-result').hidden = true;
  if (next.kind === 'saved') {
    renderCreatureSelection(
      next.source
        ? ''
        : 'Gespeicherter Statblock nicht verfügbar. Es wird kein heutiger Katalogwert als Vorlagenquelle eingesetzt.',
      false,
      !next.source,
    );
    revealCreatureDetail(fromPlan);
    return;
  }
  renderCreatureSelection('Statblock wird geladen …', true);
  revealCreatureDetail(fromPlan);
  try {
    const response = await window.campaign.creature(next.id);
    if (!owned(token, g) || request !== creatureRequest) return;
    const c = unwrap(response);
    if (c.id !== next.id) throw new Error('Statblock gehört zu einer anderen Kreatur.');
    creature = c;
    renderCreatureSelection();
  } catch (error) {
    if (owned(token, g) && request === creatureRequest) {
      creature = null;
      renderCreatureSelection(
        'Statblock nicht verfügbar: ' + (error as Error).message,
        false,
        true,
      );
      tell((error as Error).message, true);
    }
  }
}

async function refreshPlans() {
  const w = workspace,
    g = editorSession.generation,
    request = ++listRequest;
  if (!w) return;
  try {
    const response = await window.campaign.encounterPlans(w.token, value('encounter-search'));
    if (!owned(w.token, g) || request !== listRequest) return;
    const list = unwrap(response),
      select = get<HTMLSelectElement>('encounter-list'),
      old = select.value;
    select.replaceChildren();
    option(select, '', 'Vorlage auswählen');
    for (const p of list) option(select, p.id, p.name || 'Unbenannte Begegnung');
    select.value = plan?.id ?? old;
  } catch (error) {
    if (owned(w.token, g) && request === listRequest) tell((error as Error).message, true);
  }
}
function save(): Promise<boolean> {
  clearSaveTimer();
  if (savingWork.value) return savingWork.value;
  if (!workspace || !plan) return Promise.resolve(true);
  if (blocked) return Promise.resolve(false);
  if (!dirty && plan.revision) return Promise.resolve(true);
  const w = workspace,
    draft = plan,
    g = editorSession.generation;
  const task = Promise.resolve().then(async () => {
    try {
      while (owned(w.token, g) && plan === draft && (dirty || !draft.revision)) {
        clearSaveTimer();
        const version = editVersion,
          snapshot = structuredClone(draft);
        snapshot.sourceReferences = [...new Set(snapshot.entries.map((e) => e.creatureId))].map(
          (id) =>
            draft.sourceReferences?.find((r) => r.entryId === id) ??
            creatureCatalogReference(id, info?.hash ?? draft.catalogHash),
        );
        try {
          validateEncounterPlanInput(snapshot);
          assessEncounter(
            snapshot.party,
            snapshot.entries.map((e) => ({
              xp: snapshot.sources.find((c) => c.id === e.creatureId)?.xp,
              count: e.count,
            })),
          );
        } catch (error) {
          tell((error as Error).message, true);
          return false;
        }
        const response = await window.campaign.saveEncounterPlan({
          commandId: crypto.randomUUID(),
          campaignId: w.campaign.id,
          token: w.token,
          plan: snapshot,
          expectedRevision: snapshot.revision || null,
        });
        if (!owned(w.token, g) || plan !== draft) return false;
        const saved = unwrap(response);
        draft.revision = saved.revision;
        draft.catalogHash = saved.catalogHash;
        draft.sourceReferences = saved.sourceReferences;
        const sources = new Map([...saved.sources, ...draft.sources].map((c) => [c.id, c]));
        draft.sources = [...sources.values()];
        dirty = editVersion !== version;
      }
      if (!owned(w.token, g) || plan !== draft) return false;
      tell('Encounter-Vorlage gespeichert.');
      void refreshPlans();
      return true;
    } catch (error) {
      if (owned(w.token, g) && plan === draft) {
        blocked = true;
        renderCatalogPlan();
        tell(
          (error as Error).message +
            ' Entwurf bleibt offen. Lade den gespeicherten Stand oder erstelle eine Kopie.',
          true,
        );
      }
      return false;
    }
  });
  savingWork.value = task;
  return task;
}
async function flushPlan() {
  const gen = editorSession.generation;
  return (await save()) && gen === editorSession.generation;
}
export async function flushCatalog() {
  const gen = editorSession.generation;
  if (!(await flushGeneration()) || gen !== editorSession.generation) return false;
  return flushPlan();
}
function schedule() {
  dirty = true;
  editVersion++;
  clearSaveTimer();
  if (!blocked)
    timer = setTimeout(() => {
      timer = null;
      void save();
    }, 700);
  tell(
    blocked
      ? 'Encounter-Entwurf gesperrt. Gespeicherten Stand laden oder eine Kopie erstellen.'
      : 'Encounter-Eingabe offen.',
  );
  renderAssessment();
}
function report(fn: () => Promise<unknown>) {
  const token = workspace?.token,
    g = editorSession.generation;
  void fn().catch((error) => {
    if (owned(token, g)) tell((error as Error).message, true);
  });
}
async function loadPlan(id: string, reload = false) {
  const w = workspace,
    g = editorSession.generation,
    request = ++planRequest;
  if (!w || !id) return;
  try {
    if (!reload && !(await flushCatalog())) return;
    if (!owned(w.token, g) || request !== planRequest) return;
    const source = plan,
      version = editVersion,
      response = await window.campaign.encounterPlan(w.token, id);
    if (!owned(w.token, g) || request !== planRequest || plan !== source) return;
    if (version !== editVersion) {
      tell('Neue Eingabe bleibt offen. Vorlage bei Bedarf erneut laden.', true);
      void refreshPlans();
      return;
    }
    adoptPlan(unwrap(response));
  } catch (error) {
    if (owned(w.token, g) && request === planRequest) tell((error as Error).message, true);
  }
}
async function newPlan(
  copy = false,
  initial?: { creature: Creature; count: number; grouped: boolean },
) {
  const w = workspace,
    source = plan,
    g = editorSession.generation,
    request = ++planRequest;
  if (!w) {
    tell('Öffne eine Kampagne, um Encounter-Vorlagen zu speichern.', true);
    return;
  }
  if (copy && !source) return;
  if (copy && blocked) {
    if (!(await flushGeneration())) return;
  } else if (!(await flushCatalog())) return;
  if (!owned(w.token, g) || request !== planRequest) return;
  const next: EncounterPlan = copy
    ? {
        ...structuredClone(source!),
        id: crypto.randomUUID(),
        revision: 0,
        name: source!.name + ' (Kopie)',
        party: source!.party.map((p) => ({ ...p, id: crypto.randomUUID() })),
        entries: source!.entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
        ...(source!.items
          ? { items: source!.items.map((i) => ({ ...i, id: crypto.randomUUID() })) }
          : {}),
      }
    : {
        id: crypto.randomUUID(),
        revision: 0,
        name: 'Neue Begegnung',
        notes: '',
        party: [],
        entries: [],
        sources: [],
        catalogHash: info?.hash ?? '',
      };
  if (initial) {
    next.name = initial.creature.name + ' – Begegnung';
    next.entries.push({
      id: crypto.randomUUID(),
      creatureId: initial.creature.id,
      count: initial.count,
      grouped: initial.grouped,
    });
    next.sources.push(initial.creature);
  }
  adoptPlan(next);
  if (!initial) get('encounter-name').focus();
  await save();
}
async function readCurrentParty() {
  const w = workspace,
    g = editorSession.generation;
  if (!w) return null;
  const data = unwrap(await window.campaign.progress(w.token));
  if (!owned(w.token, g)) return null;
  return data.characters
    .filter((c) => c.active)
    .map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      level: c.xp === null ? null : xpLevel(c.xp).level,
      count: 1,
    }));
}
async function currentParty() {
  const w = workspace,
    source = plan,
    g = editorSession.generation,
    request = ++partyRequest;
  if (!w || !source) return;
  const party = JSON.stringify(source.party);
  try {
    const next = await readCurrentParty();
    if (!next || !owned(w.token, g) || plan !== source || request !== partyRequest) return;
    if (JSON.stringify(source.party) !== party) {
      tell('Neue Partyeingabe bleibt offen. Aktuelle Party bei Bedarf erneut übernehmen.', true);
      return;
    }
    source.party = next;
    renderPlan();
    schedule();
  } catch (error) {
    if (owned(w.token, g) && plan === source && request === partyRequest)
      tell((error as Error).message, true);
  }
}

function renderAssessment() {
  get('encounter-items').replaceChildren();
  for (const item of plan?.items ?? []) {
    const line = document.createElement('p');
    line.textContent =
      item.quantity +
      ' × ' +
      (plan?.resolvedItems?.find((d) => d.id === item.reference.entryId)?.name ??
        'Gegenstandsquelle nicht aufgelöst');
    get('encounter-items').append(line);
  }
  generationPlanningChanged(plan?.party ?? null, plan);
  get('encounter-party-summary').textContent =
    'Planungsparty · ' + (plan?.party.reduce((n, p) => n + p.count, 0) ?? 0) + ' Figuren';
  try {
    const assessment = plan
      ? assessEncounter(
          plan.party,
          plan.entries.map((e) => ({
            xp: plan!.sources.find((c) => c.id === e.creatureId)?.xp,
            count: e.count,
          })),
        )
      : null;
    get('encounter-assessment').textContent = assessment
      ? assessment.baseXp +
        ' Basis-XP · ×' +
        assessment.multiplier +
        ' · ' +
        assessment.adjustedXp +
        ' angepasste XP · ' +
        (assessment.difficulty ?? 'Schwierigkeit unbekannt: Party-Level fehlen') +
        (assessment.partySize
          ? ' · ' + assessment.partySize + ' geplante Figuren'
          : ' · Ohne Planungsparty')
      : '';
    get('encounter-thresholds').textContent =
      assessment && assessment.partySize && !assessment.unknownLevels
        ? 'Schwellen: Leicht ' +
          assessment.thresholds[0] +
          ' · Mittel ' +
          assessment.thresholds[1] +
          ' · Schwer ' +
          assessment.thresholds[2] +
          ' · Tödlich ' +
          assessment.thresholds[3]
        : '';
  } catch (error) {
    get('encounter-assessment').textContent = (error as Error).message;
    get('encounter-thresholds').textContent = '';
  }
  renderCatalogPlan();
}
function renderPlan() {
  get('encounter-editor').hidden = !plan;
  if (!plan) return;
  get<HTMLInputElement>('encounter-name').value = plan.name;
  get<HTMLTextAreaElement>('encounter-notes').value = plan.notes;
  const party = get('encounter-party');
  party.replaceChildren();
  for (const p of plan.party) {
    const row = document.createElement('div');
    row.className = 'encounter-party-row';
    const name = document.createElement('input'),
      level = document.createElement('input'),
      count = document.createElement('input'),
      remove = document.createElement('button');
    name.value = p.name;
    name.maxLength = 1000;
    name.setAttribute('aria-label', 'Geplanter Name');
    level.type = 'number';
    level.min = '1';
    level.max = '20';
    level.value = p.level === null ? '' : String(p.level);
    level.placeholder = 'Level unbekannt';
    level.setAttribute('aria-label', 'Geplantes Level');
    count.type = 'number';
    count.min = '1';
    count.max = '10000';
    count.value = String(p.count);
    count.setAttribute('aria-label', 'Anzahl geplanter Figuren');
    remove.textContent = 'Entfernen';
    remove.onclick = () => {
      plan!.party = plan!.party.filter((c) => c.id !== p.id);
      renderPlan();
      schedule();
    };
    name.oninput = () => {
      p.name = name.value;
      schedule();
    };
    level.oninput = () => {
      p.level = level.value ? Number(level.value) : null;
      schedule();
    };
    count.oninput = () => {
      p.count = Number(count.value);
      schedule();
    };
    row.append(name, level, count, remove);
    party.append(row);
  }
  const rows = get('encounter-entries');
  rows.replaceChildren();
  for (const e of plan.entries) {
    const c = plan.sources.find((c) => c.id === e.creatureId),
      row = document.createElement('div');
    row.className = 'encounter-entry-row';
    const name = document.createElement('button'),
      count = document.createElement('input'),
      label = document.createElement('label'),
      group = document.createElement('input'),
      remove = document.createElement('button');
    name.textContent =
      (e.worldActorIds ? encounterEntryLabel(e, plan.sources) : (c?.name ?? e.creatureId)) +
      ' · HG ' +
      (c?.challengeRating ?? '?');
    const sourcePlan = plan,
      token = workspace?.token,
      gen = editorSession.generation;
    name.onclick = () => {
      if (!name.isConnected || plan !== sourcePlan || !owned(token, gen)) return;
      catalogContentView('monster');
      void showCreatureReading(
        {
          kind: 'saved',
          id: e.creatureId,
          source: c ? structuredClone(c) : null,
          planId: sourcePlan.id,
          planName: sourcePlan.name,
          revision: sourcePlan.revision,
          pending: dirty || blocked || !sourcePlan.revision,
        },
        true,
        true,
      );
    };
    count.type = 'number';
    count.min = '1';
    count.max = '1000';
    count.value = String(e.count);
    count.min = String(Math.max(1, e.worldActorIds?.length ?? 0));
    count.disabled =
      !!e.worldActorIds?.length && e.worldActorIds.length === e.count && !e.allowAnonymous;
    count.setAttribute('aria-label', 'Anzahl ' + (c?.name ?? e.creatureId));
    count.oninput = () => {
      e.count = Number(count.value);
      schedule();
    };
    group.type = 'checkbox';
    group.checked = e.grouped;
    group.onchange = () => {
      e.grouped = group.checked;
      schedule();
    };
    label.className = 'check-label';
    label.append(group, document.createTextNode('Gemeinsame Initiative'));
    remove.textContent = 'Entfernen';
    remove.onclick = () => {
      plan!.entries = plan!.entries.filter((p) => p.id !== e.id);
      renderPlan();
      schedule();
    };
    const title = document.createElement('input');
    title.className = 'encounter-group-name';
    title.maxLength = 120;
    title.value = e.groupName ?? '';
    title.placeholder = 'Truppname (optional), z. B. Schützen';
    title.setAttribute('aria-label', 'Truppname ' + (c?.name ?? e.creatureId));
    title.oninput = () => {
      e.groupName = title.value;
      schedule();
    };
    row.append(name, count, label, remove, title);
    rows.append(row);
  }
  renderAssessment();
  renderCatalogPlan();
}
export function initCatalog(
  status: typeof tell,
  onPrepare: typeof prepare,
  onLiveAdd: (creatureId: string, count: number, grouped: boolean) => Promise<void>,
) {
  tell = status;
  prepare = onPrepare;
  itemReference = new ItemReferenceCatalog(get('catalog-item-reference'));
  for (const [id, step] of [
    ['creature-reading-back', -1],
    ['creature-reading-forward', 1],
  ] as const)
    get(id).onclick = () => {
      const position = readingPosition + step;
      if (position < 0 || position >= readingHistory.length) return;
      readingPosition = position;
      void showCreatureReading(readingHistory[position]!, false);
    };
  get('creature-reading-current').onclick = () => {
    if (reading?.kind === 'saved') void selectCreature(reading.id);
  };
  get('creature-reading-retry').onclick = () => {
    if (reading?.kind === 'catalog') void showCreatureReading(reading, false);
  };

  const showMonsters = () => {
    catalogContentView('monster');
    if (
      !page &&
      get('catalog-table').getAttribute('aria-busy') !== 'true' &&
      get('catalog-page').getAttribute('role') !== 'alert'
    )
      void search();
  };
  get('catalog-monsters-tab').onclick = showMonsters;
  get('catalog-items-tab').onclick = () => catalogContentView('items');
  get('catalog-content-strip').onkeydown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const target = get<HTMLButtonElement>(
      e.key === 'Home'
        ? 'catalog-monsters-tab'
        : e.key === 'End'
          ? 'catalog-items-tab'
          : catalogContent === 'monster'
            ? 'catalog-items-tab'
            : 'catalog-monsters-tab',
    );
    target.click();
    target.focus();
  };
  initGeneration(status, {
    currentParty: readCurrentParty,
    plan: async () => {
      if (!(await flushPlan()))
        throw new Error('Offene Encounter-Eingabe zuerst speichern oder wiederherstellen.');
      return plan ? structuredClone(plan) : null;
    },
    creature: () => creature,
    filters: () => tableLookupQuery ?? query(),
    beginTableLookup,
    info: () => info,
    accept: async (accepted) => {
      const gen = editorSession.generation;
      if (!(await flushPlan()))
        throw new Error('Offene Encounter-Eingabe zuerst speichern oder wiederherstellen.');
      if (gen !== editorSession.generation) return;
      adoptPlan(
        plan?.id === accepted.id && plan.revision > accepted.revision
          ? structuredClone(plan)
          : accepted,
        false,
      );
      await refreshPlans();
      if (gen === editorSession.generation)
        get('encounter-builder').scrollIntoView({ block: 'start' });
    },
  });
  get('catalog-form').onsubmit = (event) => {
    event.preventDefault();
    const active = document.activeElement;
    if (active?.id === 'catalog-cr-min' || active?.id === 'catalog-cr-max')
      commitChallengeRange(get<HTMLInputElement>(active.id));
    offset = 0;
    void search();
  };
  for (const c of get('catalog-filters').querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input,select',
  )) {
    c.oninput = () => {
      renderCatalogControls();
      if (!tableLookupQuery) generationCatalogFiltersChanged();
      clearSearchTimer();
      searchRequest++;
      offset = 0;
      clearResults('Kreaturen werden gesucht…', true);
      searchTimer = setTimeout(() => {
        searchTimer = null;
        void search();
      }, 200);
    };
    if (c.id === 'catalog-cr-min' || c.id === 'catalog-cr-max')
      c.onchange = () => commitChallengeRange(c);
  }
  get('catalog-reset').onclick = () => {
    const direction = value('catalog-direction');
    get<HTMLFormElement>('catalog-form').reset();
    get<HTMLInputElement>('catalog-direction').value = direction;
    offset = 0;
    if (!tableLookupQuery) generationCatalogFiltersChanged();
    void search();
  };
  get('catalog-prev').onclick = () => {
    offset = Math.max(0, offset - 25);
    void search();
  };
  get('catalog-next').onclick = () => {
    offset += 25;
    void search();
  };
  for (const button of get('catalog-table').querySelectorAll<HTMLButtonElement>('thead button'))
    button.onclick = () => {
      const next = button.dataset.sort as CreatureCatalogQuery['sort'];
      get<HTMLInputElement>('catalog-direction').value =
        sort === next && value('catalog-direction') === 'asc' ? 'desc' : 'asc';
      sort = next;
      offset = 0;
      void search();
    };
  get('catalog-plan-open').onclick = () => {
    get('encounter-builder').scrollIntoView({ block: 'start' });
    get<HTMLElement>(plan ? 'encounter-name' : 'encounter-new').focus({ preventScroll: true });
  };
  const returnToResults = () => {
    showMonsters();
    get('catalog-browser').scrollIntoView({ block: 'start' });
    get<HTMLInputElement>('catalog-search').focus({ preventScroll: true });
  };
  get('catalog-search-open').onclick = returnToResults;
  get('catalog-results-return').onclick = returnToResults;
  get('encounter-search').oninput = () => void refreshPlans();
  get('encounter-list').onchange = () => {
    void loadPlan(value('encounter-list'));
  };
  get('encounter-new').onclick = () => report(() => newPlan());
  get('encounter-save').onclick = () => void save();
  get('encounter-copy').onclick = () => report(() => newPlan(true));
  get('encounter-load').onclick = () => {
    if (plan?.revision) void loadPlan(plan.id, true);
  };
  get('encounter-name').oninput = () => {
    if (plan) {
      plan.name = value('encounter-name');
      schedule();
    }
  };
  get('encounter-notes').oninput = () => {
    if (plan) {
      plan.notes = value('encounter-notes');
      schedule();
    }
  };
  get('encounter-party-add').onclick = () => {
    if (plan) {
      plan.party.push({ id: crypto.randomUUID(), name: 'Geplante Figur', level: null, count: 1 });
      renderPlan();
      schedule();
    }
  };
  get('encounter-party-current').onclick = () => {
    void currentParty();
  };
  get('catalog-add').onclick = () => {
    const selected = creature,
      w = workspace,
      g = editorSession.generation;
    if (!selected || !w || blocked || startingPlan) return;
    const count = Number(value('catalog-quantity')),
      grouped = !!get<HTMLInputElement>('catalog-grouped').checked;
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000) {
      tell('Positive ganze Kreaturmenge eingeben.', true);
      return;
    }
    if (!plan) {
      startingPlan = true;
      renderCatalogPlan();
      report(async () => {
        try {
          await newPlan(false, { creature: selected, count, grouped });
        } finally {
          if (owned(w.token, g)) {
            startingPlan = false;
            renderCatalogPlan();
          }
        }
      });
      return;
    }
    plan.entries.push({ id: crypto.randomUUID(), creatureId: selected.id, count, grouped });
    if (!plan.sources.some((c) => c.id === selected.id)) plan.sources.push(selected);
    renderPlan();
    schedule();
    get('catalog-add-result').hidden = false;
    get('catalog-add-result').textContent =
      count + ' × ' + selected.name + ' zur Vorlage „' + plan.name + '“ hinzugefügt.';
  };
  get('catalog-live-add').onclick = () => {
    const selected = creature;
    if (selected)
      report(() =>
        onLiveAdd(
          selected.id,
          Number(value('catalog-quantity')),
          get<HTMLInputElement>('catalog-grouped').checked,
        ),
      );
  };
  get('encounter-prepare').onclick = () =>
    report(async () => {
      const w = workspace,
        source = plan,
        g = editorSession.generation,
        request = planRequest;
      if (!w || !source) return;
      if (
        !(await flushCatalog()) ||
        !owned(w.token, g) ||
        plan !== source ||
        request !== planRequest
      )
        return;
      await prepare(structuredClone(source));
    });
}

editorSession.onDeactivate(() => {
  if (timer) clearTimeout(timer);
  timer = null;
});

editorSession.observeDraft(() => ({
  openInput: dirty,
  retainedDraft: false,
  unresolvedCommand: blocked,
}));
