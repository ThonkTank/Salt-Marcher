import { EditorSession } from '../shared/editor-session';
import { renderEncounterComposition } from '../catalog/encounter-composition-ui';
import { requiredNpcPicker } from './required-npc-picker';
import { encounterEntryLabel } from '../catalog/encounter-contracts';
import {
  initWorldSourceUI,
  setWorldSources,
  worldSourceFilters,
  worldSourceOpen,
  openWorldSourceReference,
} from './world-source-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { Creature, CreatureCatalogQuery } from '../../features/catalog/creature-catalog';
import type { CatalogInfo, EncounterPlan } from '../catalog/encounter-contracts';
import {
  currentGenerationLoot,
  weightShares,
  integerWeights,
  encounterWeight,
  type EncounterTable,
  type LootTable,
  type GeneratorRegistry,
  type GenerationCommand,
  type GenerationRun,
  type GenerationRequest,
} from './generation-contracts';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T,
  value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
interface Bridge {
  currentParty?(): Promise<EncounterPlan['party'] | null>;
  plan(): Promise<EncounterPlan | null>;
  creature(): Creature | null;
  filters(): CreatureCatalogQuery;
  info(): CatalogInfo | null;
  accept(plan: EncounterPlan): Promise<void>;
  beginTableLookup?(): () => void;
}
let requiredPick: ReturnType<typeof requiredNpcPicker>;
let workspace: WorkspaceGeometry | null = null,
  tables: EncounterTable[] = [],
  lootTables: LootTable[] = [],
  registry: GeneratorRegistry | null = null,
  run: GenerationRun | null = null;
let previewRequest = 0,
  refreshRequest = 0,
  tableRequest = 0;
const owned = (token: string, g: number) =>
  workspace?.token === token && editorSession.generation === g;
const lockedControls = new Map<HTMLInputElement | HTMLButtonElement | HTMLSelectElement, boolean>();
let tableDraft: EncounterTable | null = null,
  lootDraft: LootTable | null = null,
  tableBaseline = '',
  lootBaseline = '',
  previewDirty = false;
let planningBasis: string | null = null,
  fillBasis: string | null = null;
let liveParty: EncounterPlan['party'] | null = null,
  usesPlanningParty = false;
const defaultKeys = ['difficulty', 'amount', 'balance', 'diversity'] as const;
const defaultOverrides = new Set<string>();
function applyPresetDefaults() {
  const preset = registry?.presets.find((p) => p.id === registry?.effectiveId),
    defaults = preset?.config?.generationDefaults;
  if (!defaults) return;
  let changed = false;
  for (const key of defaultKeys) {
    const control = get<HTMLSelectElement>('generation-' + key);
    if (!defaultOverrides.has(key) && control.value !== defaults[key]) {
      control.value = defaults[key];
      changed = true;
    }
  }
  get('generation-defaults-source').textContent =
    'Vorgaben: ' +
    preset!.name +
    (defaultOverrides.size ? ' · Eigene Auswahl bleibt erhalten.' : '');
  if (changed && run) {
    previewDirty = true;
    renderPreview();
  }
}
let retryWrite: (() => void) | null = null;
function resumeWrite() {
  const retry = retryWrite;
  retryWrite = null;
  get('generation-write-recovery').hidden = true;
  get<HTMLButtonElement>('generation-write-retry').disabled = true;
  retry?.();
}
let tell: (text: string, error?: boolean) => void, bridge: Bridge, discard: () => void;
let tableCreated: ((table: EncounterTable) => void) | null = null;
let catalogParent: Node | null = null,
  catalogNext: Node | null = null,
  restoreTableLookup: (() => void) | null = null;
const names = new Map<string, string>();
export function activateGeneration(next: WorkspaceGeometry) {
  resumeWrite();
  lock(false);
  pendingWork.value = null;
  workspace = next;
  requiredPick.context(next.token, true);
  editorSession.generation++;
  previewRequest++;
  refreshRequest++;
  tableRequest++;
  setWorldSources({ sources: [], factions: [], locations: [] }, [], true);
  defaultOverrides.clear();
  tables = [];
  lootTables = [];
  registry = null;
  run = null;
  tableCreated = null;
  tableDraft = null;
  lootDraft = null;
  previewDirty = false;
  planningBasis = null;
  fillBasis = null;
  liveParty = null;
  usesPlanningParty = false;
  for (const id of ['table-manager', 'loot-table-manager', 'preset-manager', 'generation-discard'])
    if (get<HTMLDialogElement>(id).open) get<HTMLDialogElement>(id).close();
  generationPlanningChanged(null);
  get('generation-defaults-source').textContent = '';
  restoreCatalog();
  sourceRefreshNotice();
  get('generation-workspace').hidden = false;
  get('generation-feedback').textContent = '';
  renderPreview();
  void refreshGeneration();
}
export async function flushGeneration() {
  if (retryWrite) {
    tell('Speicherausgang zuerst im offenen Generatorbereich klären.', true);
    return false;
  }
  if (get<HTMLDialogElement>('preset-manager').open) {
    tell(
      'Schließe zuerst die Generator-Einstellungen. Ungespeicherte Änderungen bleiben dort erhalten.',
      true,
    );
    return false;
  }
  const w = workspace,
    g = editorSession.generation;
  if (!w) return true;
  if (worldSourceOpen()) {
    tell('Speichere oder schließe die offenen Weltquellen zuerst.', true);
    return false;
  }
  if (pendingWork.value && !(await pendingWork.value)) return false;
  if (!owned(w.token, g)) return false;
  if (
    (tableDraft &&
      get<HTMLDialogElement>('table-manager').open &&
      JSON.stringify(tableDraft) !== tableBaseline) ||
    (lootDraft &&
      get<HTMLDialogElement>('loot-table-manager').open &&
      JSON.stringify(lootDraft) !== lootBaseline)
  ) {
    tell('Speichere oder schließe den offenen Generator-Entwurf zuerst.', true);
    return false;
  }
  return true;
}
export async function openGenerationSource(kind: 'faction' | 'location', id: string) {
  const w = workspace,
    g = editorSession.generation;
  if (!w || !(await flushGeneration())) return;
  const [sources, nextTables] = await Promise.all([
    window.campaign.generationSources(w.token),
    window.campaign.encounterTables(w.token, true),
  ]);
  if (!owned(w.token, g)) return;
  setWorldSources(unwrap(sources), unwrap(nextTables));
  openWorldSourceReference(kind, id);
}
export async function refreshGeneration() {
  const w = workspace,
    g = editorSession.generation,
    request = ++refreshRequest;
  if (!w) return;
  try {
    const results = await Promise.all([
      window.campaign.encounterTables(w.token, true),
      window.campaign.lootTables(w.token, true),
      window.campaign.generatorRegistry(w.token),
      window.campaign.generationRuns(w.token),
      window.campaign.generationSources(w.token),
    ]);
    if (!owned(w.token, g) || request !== refreshRequest) return;
    const nextTables = unwrap(results[0]),
      nextLootTables = unwrap(results[1]),
      nextRegistry = unwrap(results[2]),
      history = unwrap(results[3]);
    if (!usesPlanningParty && bridge.currentParty) {
      const party = await bridge.currentParty();
      if (!owned(w.token, g) || request !== refreshRequest) return;
      if (!usesPlanningParty) {
        liveParty = party;
        generationPlanningChanged(null);
      }
    }
    setWorldSources(unwrap(results[4]), nextTables);
    sourceRefreshNotice();
    tables = nextTables;
    lootTables = nextLootTables;
    registry = nextRegistry;
    renderOverview();
    const runs = get<HTMLSelectElement>('generation-history'),
      selected = runs.value;
    runs.replaceChildren();
    option(runs, '', 'Frühere Vorschau auswählen');
    for (const r of history) option(runs, r.id, r.title + ' · ' + r.count + ' · Seed ' + r.seed);
    if (history.some((r) => r.id === selected)) runs.value = selected;
  } catch (error) {
    if (owned(w.token, g) && request === refreshRequest) {
      sourceRefreshNotice(
        'Tabellen und Weltquellen konnten nicht aktualisiert werden: ' + (error as Error).message,
      );
      tell((error as Error).message, true);
    }
  }
}
function sourceRefreshNotice(text = '') {
  const node = get('generation-source-status');
  node.hidden = !text;
  node.textContent = text;
}
function option(select: HTMLSelectElement, id: string, text: string) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = text;
  select.append(o);
}
function operation(fn: () => Promise<boolean>, report: typeof tell = tell): Promise<boolean> {
  const w = workspace,
    g = editorSession.generation;
  if (!w || pendingWork.value) return Promise.resolve(false);
  const task = Promise.resolve()
    .then(() => (owned(w.token, g) ? fn() : false))
    .catch((error) => {
      if (owned(w.token, g)) report((error as Error).message, true);
      return false;
    })
    .finally(() => {
      if (pendingWork.value === task) {
        pendingWork.clear(task);
        if (owned(w.token, g)) {
          lock(false);
          renderSourceActions();
          renderPreview();
          renderTableState();
        }
      }
    });
  pendingWork.value = task;
  lock(true);
  return task;
}
function command(action: GenerationCommand['action']) {
  const w = workspace,
    g = editorSession.generation;
  if (!w) return Promise.resolve(false);
  const request = {
    commandId: crypto.randomUUID(),
    campaignId: w.campaign.id,
    token: w.token,
    action: structuredClone(action),
  };
  return operation(async () => {
    refreshRequest++;
    let response;
    while (owned(w.token, g)) {
      try {
        response = await window.campaign.executeGeneration(request);
        break;
      } catch (error) {
        if (!owned(w.token, g)) return false;
        const recovery = get('generation-write-recovery'),
          host =
            ['table-manager', 'loot-table-manager', 'world-source-manager']
              .map((id) => get<HTMLDialogElement>(id))
              .find((dialog) => dialog.open) ?? get('generation-workspace');
        host.append(recovery);
        recovery.hidden = false;
        get<HTMLButtonElement>('generation-write-retry').disabled = false;
        tell(
          'Speicherausgang unbekannt: ' +
            (error as Error).message +
            '. Ursprüngliche Änderung zuerst klären.',
          true,
        );
        await new Promise<void>((resolve) => {
          retryWrite = resolve;
          get<HTMLButtonElement>('generation-write-retry').focus();
        });
      }
    }
    if (!response || !owned(w.token, g)) return false;
    const result = unwrap(response);
    tables = result.tables;
    lootTables = result.lootTables;
    registry = result.registry;
    renderOverview();
    // The write is confirmed. A later projection read cannot turn it into a failed save.
    try {
      const sources = unwrap(await window.campaign.generationSources(w.token));
      if (!owned(w.token, g)) return false;
      refreshRequest++;
      setWorldSources(sources, tables);
      sourceRefreshNotice();
    } catch (error) {
      if (!owned(w.token, g)) return false;
      const notice =
        'Änderung bestätigt; Weltquellen konnten nicht aktualisiert werden: ' +
        (error as Error).message +
        ' Über „Tabellen und Presets aktualisieren“ erneut lesen.';
      sourceRefreshNotice(notice);
      tell(notice, true);
      return true;
    }
    tell('Tabellen, Weltquellen und Generator gespeichert.');
    return true;
  });
}
function lock(on: boolean) {
  if (!on) {
    for (const [control, disabled] of lockedControls) control.disabled = disabled;
    lockedControls.clear();
    return;
  }
  for (const root of [
    'world-source-manager',
    'table-manager',
    'loot-table-manager',
    'preset-manager',
    'generation-workspace',
  ])
    for (const c of get(root).querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >('button,input,select,textarea')) {
      if (!lockedControls.has(c)) lockedControls.set(c, c.disabled);
      c.disabled = true;
    }
}
export function sourceActionAvailability(
  selectedId: string,
  sources: readonly { id: string; trashed: boolean }[],
) {
  const selected = sources.find((source) => source.id === selectedId);
  return { selected: !!selected, usable: !!selected && !selected.trashed };
}
function renderSourceActions() {
  const encounter = sourceActionAvailability(value('encounter-table-list'), tables),
    loot = sourceActionAvailability(value('loot-table-list'), lootTables);
  get<HTMLButtonElement>('encounter-table-open').disabled = !encounter.selected;
  get<HTMLButtonElement>('encounter-table-use').disabled = !!pendingWork.value || !encounter.usable;
  get<HTMLButtonElement>('encounter-table-trash').disabled = !encounter.selected;
  get<HTMLButtonElement>('loot-table-open').disabled = !loot.selected;
  get<HTMLButtonElement>('loot-table-trash').disabled = !loot.selected;
  get<HTMLButtonElement>('loot-table-roll').disabled = !loot.usable;
}
function renderOverview() {
  const list = get<HTMLSelectElement>('encounter-table-list'),
    old = list.value,
    selected = new Set(
      [...get('generation-tables').querySelectorAll<HTMLInputElement>('input:checked')].map(
        (c) => c.value,
      ),
    );
  list.replaceChildren();
  option(list, '', 'Tabelle auswählen');
  const root = get('generation-tables');
  root.replaceChildren();
  for (const t of tables) {
    if (!t.trashed || get<HTMLInputElement>('tables-trash-visible').checked)
      option(
        list,
        t.id,
        t.name +
          ' · ' +
          (t.scope === 'installation' ? 'Installation' : 'Kampagne') +
          (t.trashed ? ' · Papierkorb' : ''),
      );
    if (!t.trashed) {
      const label = document.createElement('label'),
        box = document.createElement('input');
      box.type = 'checkbox';
      box.value = t.id;
      box.checked = selected.has(t.id);
      box.onchange = () => {
        previewDirty = true;
        sourceLabel();
        renderPreview();
      };
      label.className = 'check-label';
      label.append(box, document.createTextNode(t.name));
      root.append(label);
    }
  }
  list.value = old;
  const lootList = get<HTMLSelectElement>('loot-table-list'),
    lootOld = lootList.value;
  lootList.replaceChildren();
  option(lootList, '', 'Beutetabelle auswählen');
  for (const t of lootTables)
    if (!t.trashed || get<HTMLInputElement>('loot-trash-visible').checked)
      option(lootList, t.id, t.name + (t.trashed ? ' · Papierkorb' : ''));
  if (
    lootTables.some(
      (t) =>
        t.id === lootOld && (!t.trashed || get<HTMLInputElement>('loot-trash-visible').checked),
    )
  )
    lootList.value = lootOld;
  sourceLabel();
  renderSourceActions();
  applyPresetDefaults();
  const presets = get<HTMLSelectElement>('generator-preset-list'),
    current = presets.value;
  presets.replaceChildren();
  for (const p of registry?.presets ?? [])
    option(presets, p.id, p.name + (p.system ? ' · geschützt' : ''));
  presets.value = current || registry?.effectiveId || '';
  get('generator-effective').textContent =
    'Wirksam für diese Kampagne: ' +
    (registry?.presets.find((p) => p.id === registry?.effectiveId)?.name ?? 'Systempreset');
  const habitat = get<HTMLSelectElement>('generation-habitat');
  if (habitat.options.length === 1)
    for (const h of bridge.info()?.habitats ?? []) option(habitat, h, h);
  if (pendingWork.value) lock(true);
}
function sourceLabel() {
  const world = worldSourceFilters();
  get('generation-source').textContent =
    world.locationId || world.factionIds?.length
      ? 'Nur gemeinsame Quellen des Weltkontexts, gewählter Tabellen, Umgebung und Katalogfilter.'
      : get('generation-tables').querySelectorAll('input:checked').length
        ? 'Nur die ausgewählten Tabellen, Umgebung und Katalogfilter.'
        : 'Keine Tabelle ausgewählt: normaler Monsterkatalog mit Umgebung und Katalogfiltern.';
  renderCatalogContext();
}
export function catalogFilterSummary(query: CreatureCatalogQuery): string[] {
  const labels = {
    text: 'Name',
    crMin: 'HG ab',
    crMax: 'HG bis',
    sizes: 'Größe',
    types: 'Typ',
    subtypes: 'Subtyp',
    habitats: 'Habitat',
    alignments: 'Gesinnung',
    acMin: 'RK ab',
    acMax: 'RK bis',
    hpMin: 'HP ab',
    hpMax: 'HP bis',
    movement: 'Bewegung',
    senses: 'Sinne',
    vulnerabilities: 'Verwundbarkeit',
    resistances: 'Resistenz',
    immunities: 'Schadensimmunität',
    conditionImmunities: 'Zustandsimmunität',
    sourceIds: 'Quellen',
  } satisfies Record<
    Exclude<keyof CreatureCatalogQuery, 'sort' | 'direction' | 'offset' | 'limit'>,
    string
  >;
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = query[key as keyof typeof labels],
      text = Array.isArray(value)
        ? value.join(', ')
        : value === undefined
          ? ''
          : String(value).trim();
    return text ? [label + ': ' + text] : [];
  });
}
function renderCatalogContext() {
  const summary = get('generation-catalog-summary');
  try {
    const filters = catalogFilterSummary(bridge.filters());
    summary.textContent = filters.length
      ? 'Aktive Katalogfilter: ' + filters.join(' · ')
      : 'Keine zusätzlichen Katalogfilter.';
    summary.removeAttribute('role');
    get('generation-clear-catalog').hidden = !filters.length;
  } catch (error) {
    summary.textContent = (error as Error).message;
    summary.setAttribute('role', 'alert');
    get('generation-clear-catalog').hidden = false;
  }
}
const partyBasis = (party: EncounterPlan['party'] | null) =>
  JSON.stringify(party?.map((p) => [p.name, p.level, p.count]) ?? null);
export function generationPlanningChanged(
  party: EncounterPlan['party'] | null,
  plan?: EncounterPlan | null,
) {
  usesPlanningParty = party !== null;
  const effective = party ?? liveParty,
    next = partyBasis(effective),
    base = plan
      ? JSON.stringify([plan.id, plan.revision, plan.name, plan.notes, plan.entries])
      : null,
    changed = fillBasis !== base;
  fillBasis = base;
  const partyChanged = planningBasis !== next;
  planningBasis = next;
  const label = usesPlanningParty ? 'Planungsparty' : 'Aktive Kampagnenparty';
  get('generation-party-context').textContent =
    effective === null
      ? 'Die aktive Kampagnenparty wird beim Erzeugen gelesen. Eine abweichende Planungsparty ist optional.'
      : !effective.length
        ? label +
          ' ist leer. Figuren über „Party und Leiten“ aktivieren oder eine Planungsparty eintragen.'
        : effective.some((p) => p.level === null)
          ? label + ': ' + effective.reduce((n, p) => n + p.count, 0) + ' Figuren · Level fehlen.'
          : label + ': ' + effective.map((p) => p.count + ' × Level ' + p.level).join(' · ');
  if (!partyChanged && !changed) return;
  get('generation-feedback').textContent = '';
  if (
    run &&
    (partyBasis(run.request.party) !== next ||
      (get<HTMLInputElement>('generation-fill').checked && changed))
  ) {
    previewDirty = true;
    renderPreview();
  }
}

export function generationCatalogFiltersChanged() {
  renderCatalogContext();
  if (!pendingWork.value) get('generation-feedback').textContent = '';
  if (run) {
    previewDirty = true;
    renderPreview();
  }
}
function generationNotice(text: string, error = false) {
  const node = get('generation-feedback');
  node.textContent = text;
  node.classList.toggle('generation-warning', error);
  tell(text, error);
}

function restoreCatalog() {
  const browser = get('catalog-browser');
  if (catalogParent) {
    catalogParent.insertBefore(browser, catalogNext);
    catalogParent = null;
    catalogNext = null;
  }
  const restore = restoreTableLookup;
  restoreTableLookup = null;
  restore?.();
}
function closeTable(created?: EncounterTable) {
  const accept = tableCreated;
  tableCreated = null;
  tableRequest++;
  get<HTMLDialogElement>('table-manager').close();
  restoreCatalog();
  tableDraft = null;
  if (created && accept) accept(created);
  get(
    accept
      ? 'source-table-new'
      : get<HTMLButtonElement>('encounter-table-open').disabled
        ? 'encounter-table-new'
        : 'encounter-table-open',
  ).focus();
}
function requestTableClose() {
  if (pendingWork.value) return;
  if (tableDraft && JSON.stringify(tableDraft) !== tableBaseline) {
    discard = closeTable;
    get<HTMLDialogElement>('generation-discard').showModal();
  } else closeTable();
}
export function generationCreature(creature: Creature | null) {
  if (creature) names.set(creature.id, creature.name);
  get('table-selected-creature').textContent = creature
    ? creature.name + ' · HG ' + creature.challengeRating + ' · ' + creature.xp + ' XP'
    : 'Keine Kreatur gewählt.';
  renderTableState();
}
async function openTable(table?: EncounterTable, accept?: (table: EncounterTable) => void) {
  const w = workspace,
    g = editorSession.generation,
    request = ++tableRequest;
  if (!w || pendingWork.value) return;
  try {
    const draft: EncounterTable = table
      ? structuredClone(table)
      : {
          id: crypto.randomUUID(),
          revision: 0,
          scope: 'campaign',
          name: '',
          description: '',
          entries: [],
          habitats: [],
          time: 'any',
          lootTableId: null,
          trashed: false,
        };
    tableCreated = accept ?? null;
    tableDraft = draft;
    tableBaseline = JSON.stringify(draft);
    get<HTMLInputElement>('table-name').value = draft.name;
    get<HTMLTextAreaElement>('table-description').value = draft.description;
    get<HTMLSelectElement>('table-scope').value = draft.scope;
    get<HTMLSelectElement>('table-scope').disabled = draft.revision > 0;
    get('table-scope-help').textContent =
      draft.revision > 0
        ? 'Für einen anderen Geltungsbereich eine neue Tabelle anlegen.'
        : 'Der Geltungsbereich gilt für die neue Tabelle.';
    get<HTMLInputElement>('table-habitats').value = draft.habitats.join(', ');
    get<HTMLSelectElement>('table-time').value = draft.time;
    const loot = get<HTMLSelectElement>('table-loot-link');
    loot.replaceChildren();
    option(loot, '', 'Keine Beutetabelle');
    for (const t of lootTables.filter((t) => !t.trashed)) option(loot, t.id, t.name);
    loot.value = draft.lootTableId ?? '';
    loot.disabled = draft.scope === 'installation';
    get<HTMLDetailsElement>('table-options').open = false;
    get('table-selected-creature').textContent = 'Wähle links eine Kreatur.';
    renderTableRows();
    const browser = get('catalog-browser');
    if (!catalogParent) {
      restoreTableLookup = bridge.beginTableLookup?.() ?? null;
      catalogParent = browser.parentNode;
      catalogNext = browser.nextSibling;
    }
    get('table-catalog-slot').append(browser);
    get<HTMLDialogElement>('table-manager').showModal();
    get('table-name').focus();
    if (bridge.creature()) generationCreature(bridge.creature()!);
    for (const e of draft.entries) {
      if (!owned(w.token, g) || request !== tableRequest || tableDraft !== draft) return;
      if (names.has(e.creatureId)) continue;
      let name: string,
        problem: string | null = null;
      try {
        const c = unwrap(await window.campaign.creature(e.creatureId));
        name = c.name;
      } catch (error) {
        name = e.creatureId + ' · Name nicht verfügbar';
        problem = (error as Error).message;
      }
      if (!owned(w.token, g) || request !== tableRequest || tableDraft !== draft) return;
      if (problem === null) names.set(e.creatureId, name);
      const label = [...get('table-entries').querySelectorAll<HTMLLabelElement>('label')].find(
        (label) => label.dataset.creatureId === e.creatureId,
      );
      if (label) {
        label.textContent = name;
        label.title = problem ?? '';
        label.parentElement?.querySelector('input')?.setAttribute('aria-label', 'Gewicht ' + name);
      }
    }
  } catch (error) {
    if (owned(w.token, g) && request === tableRequest) throw error;
  }
}
function refreshWeightShares(root: HTMLElement, weights: string[]) {
  let shares: string[];
  try {
    shares = weightShares(weights);
  } catch {
    shares = weights.map(() => 'Ungültig');
  }
  root.querySelectorAll<HTMLElement>('.table-share').forEach((node, index) => {
    node.textContent = shares[index] ?? '—';
  });
}
function renderTableRows() {
  const root = get('table-entries');
  root.replaceChildren();
  if (!tableDraft) return;
  for (const e of tableDraft.entries) {
    const row = document.createElement('div');
    row.className = 'table-entry-row';
    const label = document.createElement('label'),
      input = document.createElement('input'),
      share = document.createElement('span'),
      remove = document.createElement('button');
    label.dataset.creatureId = e.creatureId;
    label.textContent = names.get(e.creatureId) ?? e.creatureId;
    input.value = e.weight;
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', 'Gewicht ' + label.textContent);
    input.oninput = () => {
      e.weight = input.value;
      refreshWeightShares(
        root,
        tableDraft!.entries.map((e) => e.weight),
      );
      renderTableState();
    };
    share.className = 'table-share';
    remove.textContent = 'Entfernen';
    remove.type = 'button';
    remove.onclick = () => {
      tableDraft!.entries = tableDraft!.entries.filter((item) => item.creatureId !== e.creatureId);
      renderTableRows();
    };
    row.append(label, input, share, remove);
    root.append(row);
  }
  refreshWeightShares(
    root,
    tableDraft.entries.map((e) => e.weight),
  );
  if (!tableDraft.entries.length) {
    const hint = document.createElement('p');
    hint.className = 'caption';
    hint.textContent = 'Noch keine Kreaturen. Wähle links eine Kreatur und füge sie hinzu.';
    root.append(hint);
  }
  renderTableState();
}
function tableProblem() {
  if (!tableDraft?.name.trim()) return 'Gib der Tabelle einen Namen.';
  if (!tableDraft.entries.length) return 'Füge mindestens eine Kreatur hinzu.';
  try {
    const previous = JSON.parse(tableBaseline) as EncounterTable,
      weights = new Map(previous.entries.map((e) => [e.creatureId, e.weight]));
    for (const entry of tableDraft.entries)
      encounterWeight(entry.weight, weights.get(entry.creatureId));
    if (!integerWeights(tableDraft.entries.map((e) => e.weight)).some((w) => w > 0n))
      return 'Mindestens ein Gewicht muss größer als 0 sein.';
  } catch (error) {
    return (error as Error).message;
  }
  return '';
}
function renderTableState() {
  if (!tableDraft) return;
  const problem = tableProblem(),
    selected = bridge.creature(),
    included = !!selected && tableDraft.entries.some((e) => e.creatureId === selected.id),
    add = get<HTMLButtonElement>('table-add-creature');
  add.disabled = !!pendingWork.value || !selected || included;
  add.textContent = included
    ? 'Bereits in der Tabelle'
    : selected
      ? selected.name + ' hinzufügen'
      : 'Gewählte Kreatur hinzufügen';
  get<HTMLButtonElement>('table-save').disabled = !!pendingWork.value || !!problem;
  get('table-save-status').textContent =
    problem ||
    tableDraft.entries.length +
      ' Kreatur' +
      (tableDraft.entries.length === 1 ? '' : 'en') +
      ' · bereit zum Speichern';
}
function renderPreview() {
  const root = get('generation-preview');
  root.replaceChildren();
  const proposal = run;
  if (!proposal) return;
  if (previewDirty) {
    const warning = document.createElement('p');
    warning.className = 'generation-warning';
    warning.textContent =
      'Einstellungen geändert. Erzeuge die Vorschau neu, bevor du sie übernimmst.';
    root.append(warning);
  }
  if (proposal.fixedRoster) {
    const fixed = document.createElement('p');
    fixed.className = 'generation-fixed-basis';
    fixed.textContent =
      'Feste Basis: ' +
      proposal.fixedRoster.name +
      ' r' +
      proposal.fixedRoster.revision +
      ' · ' +
      proposal.fixedRoster.entries.reduce((n, e) => n + e.count, 0) +
      ' Gegner. Jede Übernahme legt eine unabhängige neue Vorlage an.';
    root.append(fixed);
  }
  const basis = document.createElement('p');
  basis.className = 'caption';
  basis.textContent =
    'Katalogfilter dieser Vorschau: ' +
    (catalogFilterSummary(proposal.request.filters).join(' · ') || 'keine');
  root.append(basis);
  const p = document.createElement('p');
  p.textContent =
    'Seed ' +
    proposal.seed +
    ' · Preset ' +
    proposal.preset.name +
    ' · Revision ' +
    proposal.preset.revision +
    ' · ' +
    proposal.candidates.length +
    ' Kreaturtypen';
  root.append(p);
  for (const text of proposal.warnings) {
    const w = document.createElement('p');
    w.textContent = text;
    w.className = 'generation-warning';
    root.append(w);
  }
  const linkedLoot = currentGenerationLoot(proposal.lootTables, lootTables);
  if (proposal.lootTables?.length === 1 && !linkedLoot) {
    const warning = document.createElement('p');
    warning.className = 'generation-warning';
    warning.textContent =
      'Die verknüpfte Beutetabelle wurde geändert oder liegt im Papierkorb. Erzeuge die Vorschau neu.';
    root.append(warning);
  }
  for (const [index, plan] of proposal.plans.entries()) {
    const card = document.createElement('article');
    card.className = 'generation-card';
    const title = document.createElement('h3');
    title.textContent = plan.name;
    card.append(title);
    const metrics = plan.composition?.metrics,
      target = metrics ? metrics.adjustedXp - metrics.xpDelta : null,
      outside =
        target !== null &&
        target > 0 &&
        Math.abs(plan.assessment.adjustedXp - target) * 100 > target * 5;
    if (target !== null) {
      const asked = document.createElement('p');
      asked.textContent =
        'Angefragt: ' +
        {
          weighted: 'gewichtet',
          trivial: 'Trivial',
          easy: 'Leicht',
          medium: 'Mittel',
          hard: 'Schwer',
          deadly: 'Tödlich',
        }[proposal.request.difficulty] +
        ' · Ziel ' +
        target +
        ' angepasste XP.';
      card.append(asked);
      if (outside) {
        const delta = Math.round(((plan.assessment.adjustedXp - target) / target) * 100),
          warning = document.createElement('p');
        warning.className = 'generation-warning';
        warning.textContent =
          'Kein Treffer im ±5%-Zielband. Dieser Vorschlag liegt ' +
          Math.abs(delta) +
          ' % ' +
          (delta > 0 ? 'über' : 'unter') +
          ' dem XP-Ziel. Schwierigkeit, Quellen oder Preset prüfen.';
        card.append(warning);
      }
    }
    const facts = document.createElement('p');
    facts.textContent =
      plan.assessment.baseXp +
      ' Basis-XP · ' +
      plan.assessment.adjustedXp +
      ' angepasste XP · ' +
      plan.assessment.difficulty;
    const entries = document.createElement('p');
    entries.textContent = plan.entries.map((e) => encounterEntryLabel(e, plan.sources)).join(', ');
    if (proposal.fixedRoster) {
      const fixed = document.createElement('p'),
        added = document.createElement('p');
      fixed.textContent =
        'Beibehalten: ' +
        plan.entries
          .slice(0, proposal.fixedRoster.entries.length)
          .map((e) => encounterEntryLabel(e, plan.sources))
          .join(', ');
      added.textContent =
        'Ergänzung: ' +
        (plan.entries
          .slice(proposal.fixedRoster.entries.length)
          .map((e) => encounterEntryLabel(e, plan.sources))
          .join(', ') || 'keine ausgewählt');
      card.append(fixed, added);
    }
    const button = document.createElement('button');
    button.textContent = proposal.acceptedPlanIds[index]
      ? 'Gespeicherte Vorlage öffnen'
      : outside
        ? 'Abweichenden Vorschlag als Vorlage übernehmen'
        : 'Diesen Vorschlag als Vorlage übernehmen';
    button.disabled =
      pendingWork.value !== null || (!proposal.acceptedPlanIds[index] && previewDirty);
    button.onclick = () => {
      void accept(index, proposal);
    };
    card.append(facts, entries);
    renderEncounterComposition(card, plan.composition, proposal.request, !!proposal.fixedRoster);
    card.append(button);
    if (linkedLoot) {
      const lootButton = document.createElement('button');
      lootButton.textContent = 'Verknüpfte Beute auswürfeln';
      lootButton.disabled = previewDirty || pendingWork.value !== null;
      lootButton.onclick = () => {
        if (run === proposal && !previewDirty)
          rollLootTable(linkedLoot, plan.name + ' · Beute', proposal.seed + '|loot|' + index);
      };
      card.append(lootButton);
    }
    root.append(card);
  }
}
function accept(index: number, proposal: GenerationRun) {
  const w = workspace,
    r = registry,
    g = editorSession.generation,
    savedId = proposal.acceptedPlanIds[index];
  if (!w || run !== proposal || (!savedId && (!r || previewDirty))) return Promise.resolve(false);
  return operation(async () => {
    await bridge.plan();
    if (!owned(w.token, g) || run !== proposal) return false;
    const response = savedId
      ? await window.campaign.encounterPlan(w.token, savedId)
      : await window.campaign.acceptGeneration({
          commandId: crypto.randomUUID(),
          campaignId: w.campaign.id,
          token: w.token,
          runId: proposal.id,
          index,
          expectedRegistryRevision: r!.revision,
        });
    if (!owned(w.token, g)) return false;
    const plan = unwrap(response);
    if (savedId && plan.id !== savedId) throw new Error('Vorlage gehört nicht zur Auswahl.');
    if (run !== proposal) return true;
    if (!savedId) proposal.acceptedPlanIds[index] = plan.id;
    await bridge.accept(plan);
    if (!owned(w.token, g)) return false;
    if (run === proposal) {
      renderPreview();
      generationNotice(
        savedId
          ? 'Gespeicherte Encounter-Vorlage geöffnet.'
          : 'Generierte Encounter-Vorlage übernommen.',
      );
    }
    return true;
  }, generationNotice);
}
function generationFields() {
  const fields = [
    ...get('generation-fields').querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input,select',
    ),
  ].map((c) => [c.id, c.type === 'checkbox' ? c.checked : c.value]);
  try {
    return JSON.stringify({ fields, filters: bridge.filters() });
  } catch (error) {
    return JSON.stringify({ fields, filterError: (error as Error).message });
  }
}
function generate() {
  const w = workspace,
    g = editorSession.generation;
  if (!w || pendingWork.value) return;
  let filters: CreatureCatalogQuery;
  try {
    filters = structuredClone(bridge.filters());
  } catch (error) {
    generationNotice((error as Error).message, true);
    return;
  }
  generationNotice('Vorschläge werden berechnet …');
  const requestId = ++previewRequest,
    fields = generationFields();
  const filling = get<HTMLInputElement>('generation-fill').checked;
  const request: GenerationRequest = {
    requiredNpcIds: requiredPick.ids(),
    includeNpcs: get<HTMLInputElement>('generation-npc-mixed').checked,
    npcOnly: get<HTMLInputElement>('generation-npc-only').checked,
    ...worldSourceFilters(),
    seed: value('generation-seed'),
    title: value('generation-title'),
    count: Number(value('generation-count')),
    xpCeiling: value('generation-xp-ceiling') ? Number(value('generation-xp-ceiling')) : null,
    tableIds: [...get('generation-tables').querySelectorAll<HTMLInputElement>('input:checked')].map(
      (c) => c.value,
    ),
    filters,
    habitat: value('generation-habitat'),
    time: value('generation-time') as GenerationRequest['time'],
    party: [],
    difficulty: value('generation-difficulty') as GenerationRequest['difficulty'],
    amount: value('generation-amount') as GenerationRequest['amount'],
    balance: value('generation-balance') as GenerationRequest['balance'],
    diversity: value('generation-diversity') as GenerationRequest['diversity'],
  };
  void operation(async () => {
    const plan = await bridge.plan();
    if (!owned(w.token, g) || requestId !== previewRequest) return false;
    const party = plan?.party ?? (await bridge.currentParty?.());
    if (!owned(w.token, g) || requestId !== previewRequest) return false;
    if (!party) {
      generationNotice(
        'Es fehlt eine Encounter-Vorlage mit Planungsparty. Öffne „Zur Planungsparty“ und lege eine Vorlage an.',
        true,
      );
      return false;
    }
    if (!plan) {
      liveParty = party;
      generationPlanningChanged(null);
    } else generationPlanningChanged(plan.party, plan);
    if (!party.length) {
      generationNotice(
        (plan ? 'Planungsparty' : 'Aktive Kampagnenparty') +
          ' ist leer. Figuren und Level eintragen, bevor du Vorschläge erzeugst.',
        true,
      );
      return false;
    }
    request.party = structuredClone(party);
    if (filling) {
      if (!plan?.entries.length) {
        generationNotice('Zum Auffüllen zuerst Gegner in der aktuellen Vorlage ergänzen.', true);
        return false;
      }
      request.fillPlan = { id: plan.id, revision: plan.revision };
    }
    const response = await window.campaign.generateEncounters(w.token, request);
    if (!owned(w.token, g) || requestId !== previewRequest) return false;
    run = unwrap(response);
    previewDirty = fields !== generationFields();
    renderPreview();
    await refreshGeneration();
    if (!owned(w.token, g) || requestId !== previewRequest) return false;
    generationNotice('Encounter-Vorschau erzeugt. Noch keine Vorlage oder Kampf übernommen.');
    return true;
  }, generationNotice);
}
async function loadHistory() {
  const w = workspace,
    g = editorSession.generation;
  if (!w || pendingWork.value) return;
  const id = value('generation-history'),
    request = ++previewRequest;
  run = null;
  previewDirty = false;
  renderPreview();
  generationNotice(id ? 'Vorschau wird geladen …' : 'Keine gespeicherte Vorschau gewählt.');
  if (!id) return;
  try {
    const response = await window.campaign.generationRun(w.token, id);
    if (!owned(w.token, g) || request !== previewRequest) return;
    const next = unwrap(response);
    if (next.id !== id) throw new Error('Vorschau gehört nicht zur Auswahl.');
    run = next;
    renderPreview();
    generationNotice('Gespeicherte Vorschau geladen. Noch keine Vorlage übernommen.');
  } catch (error) {
    if (owned(w.token, g) && request === previewRequest)
      generationNotice((error as Error).message, true);
  }
}
function report(fn: () => Promise<unknown>) {
  const w = workspace,
    g = editorSession.generation;
  void fn().catch((error) => {
    if (w && owned(w.token, g)) tell(error.message, true);
  });
}

function ensureLootUI() {
  if (document.getElementById('loot-table-list')) return;
  const section = get('encounter-table-list').closest('section')!,
    heading = [...section.querySelectorAll('h3')].find(
      (h) => h.textContent === 'Wirksames Generatorpreset',
    )!,
    fragment = document.createDocumentFragment();
  const title = document.createElement('h3');
  title.textContent = 'Gewichtete Beutetabellen';
  const label = document.createElement('label');
  label.htmlFor = 'loot-table-list';
  label.textContent = 'Beutetabelle';
  const select = document.createElement('select');
  select.id = 'loot-table-list';
  const actions = document.createElement('div');
  actions.className = 'toolbar';
  for (const [id, text] of [
    ['loot-table-new', 'Neue Beutetabelle…'],
    ['loot-table-open', 'Bearbeiten…'],
    ['loot-table-trash', 'Papierkorb / Wiederherstellen'],
  ] as const) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.textContent = text;
    actions.append(b);
  }
  const roll = document.createElement('button');
  roll.id = 'loot-table-roll';
  roll.type = 'button';
  roll.textContent = 'Auswürfeln und als unverteilte Beute anlegen';
  const trashLabel = document.createElement('label');
  trashLabel.className = 'check-label';
  const trash = document.createElement('input');
  trash.id = 'loot-trash-visible';
  trash.type = 'checkbox';
  trashLabel.append(trash, document.createTextNode(' Beutetabellen im Papierkorb zeigen'));
  const result = document.createElement('p');
  result.id = 'loot-roll-result';
  result.className = 'caption';
  fragment.append(title, label, select, actions, roll, trashLabel, result);
  section.insertBefore(fragment, heading);
  const old = get<HTMLInputElement>('table-loot-link'),
    replacement = document.createElement('select');
  replacement.id = old.id;
  old.replaceWith(replacement);
  const lootLabel = document.querySelector<HTMLLabelElement>('label[for="table-loot-link"]');
  if (lootLabel) lootLabel.textContent = 'Beutetabelle (optional)';
}
function closeLoot() {
  get<HTMLDialogElement>('loot-table-manager').close();
  lootDraft = null;
  get('loot-table-open').focus();
}
function requestLootClose() {
  if (pendingWork.value) return;
  if (lootDraft && JSON.stringify(lootDraft) !== lootBaseline) {
    discard = closeLoot;
    get<HTMLDialogElement>('generation-discard').showModal();
  } else closeLoot();
}
function lootEntry(): LootTable['entries'][number] {
  return {
    id: crypto.randomUUID(),
    weight: '1',
    minimum: 1,
    maximum: 1,
    item: { name: '', valueGold: '0', category: 'other' },
  };
}
function openLoot(table?: LootTable) {
  if (pendingWork.value) return;
  lootDraft = table
    ? structuredClone(table)
    : {
        id: crypto.randomUUID(),
        revision: 0,
        name: '',
        description: '',
        rolls: 1,
        entries: [lootEntry()],
        trashed: false,
      };
  lootBaseline = JSON.stringify(lootDraft);
  get<HTMLInputElement>('loot-name').value = lootDraft.name;
  get<HTMLTextAreaElement>('loot-description').value = lootDraft.description;
  get<HTMLInputElement>('loot-rolls').value = String(lootDraft.rolls);
  renderLootRows();
  get<HTMLDialogElement>('loot-table-manager').showModal();
  get('loot-name').focus();
}
function renderLootRows() {
  const root = get('loot-entries');
  root.replaceChildren();
  if (!lootDraft) return;
  for (const [index, e] of lootDraft.entries.entries()) {
    const row = document.createElement('fieldset'),
      legend = document.createElement('legend');
    legend.textContent = 'Eintrag ' + (index + 1) + ' · ';
    const share = document.createElement('span');
    share.className = 'table-share';
    legend.append(share);
    row.append(legend);
    const field = (
      text: string,
      type: string,
      current: string,
      update: (value: string) => void,
    ) => {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = text;
      input.type = type;
      input.value = current;
      input.oninput = () => update(input.value);
      label.append(input);
      row.append(label);
    };
    field('Name', 'text', e.item.name, (v) => (e.item.name = v));
    field('Wert in Gold', 'text', e.item.valueGold, (v) => (e.item.valueGold = v));
    const category = document.createElement('select');
    for (const [id, text] of [
      ['coins', 'Münzen'],
      ['equipment', 'Ausrüstung'],
      ['trade-goods', 'Handelsware'],
      ['magic', 'Magisch'],
      ['other', 'Sonstiges'],
    ] as const)
      option(category, id, text);
    category.value = e.item.category;
    category.oninput = () => {
      e.item.category = category.value as typeof e.item.category;
    };
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = 'Kategorie';
    categoryLabel.append(category);
    row.append(categoryLabel);
    field('Minimum', 'number', String(e.minimum), (v) => (e.minimum = Number(v)));
    field('Maximum', 'number', String(e.maximum), (v) => (e.maximum = Number(v)));
    field('Gewicht', 'text', e.weight, (v) => {
      e.weight = v;
      refreshWeightShares(
        root,
        lootDraft!.entries.map((e) => e.weight),
      );
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Eintrag entfernen';
    remove.onclick = () => {
      lootDraft!.entries.splice(index, 1);
      renderLootRows();
    };
    row.append(remove);
    root.append(row);
  }
  refreshWeightShares(
    root,
    lootDraft.entries.map((e) => e.weight),
  );
}
function rollLootTable(table: LootTable, title: string, seed: string) {
  const w = workspace,
    g = editorSession.generation;
  if (!w || table.trashed) return;
  void operation(async () => {
    const response = await window.campaign.rollLoot({
      commandId: crypto.randomUUID(),
      campaignId: w.campaign.id,
      token: w.token,
      tableId: table.id,
      expectedRevision: table.revision,
      seed,
      title,
    });
    if (!owned(w.token, g)) return false;
    const rolled = unwrap(response);
    get('loot-roll-result').textContent =
      rolled.items.map((i) => i.quantity + ' × ' + i.name).join(', ') +
      ' · als unverteilte Beute gespeichert';
    tell('Beute reproduzierbar ausgewürfelt und unverteilten Schätzen hinzugefügt.');
    return true;
  });
}
function rollSelectedLoot() {
  const table = lootTables.find((t) => t.id === value('loot-table-list'));
  if (table) rollLootTable(table, table.name, value('generation-seed'));
}

export function initGeneration(status: typeof tell, callbacks: Bridge) {
  for (const [a, b] of [
    ['generation-npc-only', 'generation-npc-mixed'],
    ['generation-npc-mixed', 'generation-npc-only'],
  ])
    get(a!).addEventListener('change', () => {
      if (get<HTMLInputElement>(a!).checked) get<HTMLInputElement>(b!).checked = false;
    });
  tell = status;
  bridge = callbacks;
  requiredPick = requiredNpcPicker('generation-required-npcs', tell);
  const recovery = document.createElement('div');
  recovery.id = 'generation-write-recovery';
  recovery.hidden = true;
  recovery.setAttribute('role', 'alert');
  recovery.innerHTML =
    '<p>Speicherausgang unbekannt. Die ursprüngliche Änderung wird beim Klären bestätigt oder einmalig gespeichert. Entwurf und Schließen bleiben bis dahin gesperrt.</p><button id="generation-write-retry" type="button">Speicherausgang klären</button>';
  get('generation-workspace').append(recovery);
  get('generation-write-retry').onclick = resumeWrite;
  ensureLootUI();
  get('encounter-generate').onclick = () => {
    get<HTMLDetailsElement>('generation-tools').open = true;
    get('generation-actions').scrollIntoView({ block: 'center' });
    get<HTMLFormElement>('generation-form')
      .querySelector<HTMLButtonElement>('button[type=submit]')!
      .focus({ preventScroll: true });
  };
  get('generation-clear-catalog').onclick = () => {
    get('catalog-reset').click();
  };
  get('generation-plan-open').onclick = () => {
    get('generation-feedback').textContent = '';
    const withoutPlan = get('encounter-editor').hidden;
    get<HTMLDetailsElement>(withoutPlan ? 'encounter-library' : 'encounter-party-details').open =
      true;
    const target = withoutPlan
      ? get('encounter-new')
      : (get('encounter-party').querySelector<HTMLElement>('input') ?? get('encounter-party-add'));
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
  };
  get('catalog-tables').onclick = () => {
    get<HTMLDetailsElement>('generation-tools').open = true;
    get('generation-workspace').scrollIntoView({ block: 'start' });
    get('encounter-table-new').focus({ preventScroll: true });
  };
  initWorldSourceUI(
    command,
    () => {
      previewDirty = true;
      sourceLabel();
      renderPreview();
    },
    (close) => {
      discard = close;
      get<HTMLDialogElement>('generation-discard').showModal();
    },
    (accept) => report(() => openTable(undefined, accept)),
  );
  get('encounter-table-use').onclick = () => {
    const id = value('encounter-table-list');
    if (pendingWork.value || !sourceActionAvailability(id, tables).usable) return;
    const boxes = [...get('generation-tables').querySelectorAll<HTMLInputElement>('input')],
      selected = boxes.find((box) => box.value === id);
    if (!selected) return;
    const changed = boxes.some((box) => box.checked !== (box === selected));
    for (const box of boxes) box.checked = box === selected;
    if (changed) previewDirty = true;
    sourceLabel();
    renderPreview();
    get<HTMLDetailsElement>('generation-tools').open = true;
    get('generation-actions').scrollIntoView({ block: 'center' });
    selected.focus({ preventScroll: true });
  };
  get('encounter-table-list').oninput = renderSourceActions;
  get('loot-table-list').oninput = renderSourceActions;
  renderSourceActions();
  get('encounter-table-new').onclick = () => {
    report(() => openTable());
  };
  get('encounter-table-open').onclick = () => {
    const t = tables.find((t) => t.id === value('encounter-table-list'));
    if (t) report(() => openTable(t));
  };
  get('table-close').onclick = requestTableClose;
  get<HTMLDialogElement>('table-manager').addEventListener('cancel', (event) => {
    event.preventDefault();
    requestTableClose();
  });
  get<HTMLDialogElement>('table-manager').addEventListener('close', restoreCatalog);
  for (const id of [
    'table-name',
    'table-description',
    'table-scope',
    'table-habitats',
    'table-time',
    'table-loot-link',
  ])
    get(id).oninput = () => {
      if (!tableDraft) return;
      // Browser text controls normalize line endings; leave untouched fields in their original form.
      if (id === 'table-name') tableDraft.name = value(id);
      if (id === 'table-description') tableDraft.description = value(id);
      if (id === 'table-habitats')
        tableDraft.habitats = value(id)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      if (id === 'table-time') tableDraft.time = value(id) as EncounterTable['time'];
      if (id === 'table-scope' && tableDraft.revision === 0) {
        tableDraft.scope = value(id) as EncounterTable['scope'];
        const loot = get<HTMLSelectElement>('table-loot-link');
        loot.disabled = tableDraft.scope === 'installation';
        if (loot.disabled) {
          loot.value = '';
          tableDraft.lootTableId = null;
        }
      }
      if (id === 'table-loot-link') tableDraft.lootTableId = value(id) || null;
      renderTableState();
    };
  get('table-add-creature').onclick = () => {
    const c = bridge.creature();
    if (!c || !tableDraft) return;
    if (tableDraft.entries.some((e) => e.creatureId === c.id)) {
      tell('Diese Kreatur steht bereits in der Tabelle.');
      return;
    }
    tableDraft.entries.push({ creatureId: c.id, weight: '1' });
    names.set(c.id, c.name);
    renderTableRows();
  };
  get('table-form').onsubmit = (event) => {
    event.preventDefault();
    report(async () => {
      const draft = tableDraft,
        w = workspace,
        g = editorSession.generation;
      if (!draft || !w || pendingWork.value) return;
      const problem = tableProblem();
      if (problem) {
        renderTableState();
        return;
      }
      if (
        (await command({
          kind: 'table-save',
          table: draft,
          expectedRevision: draft.revision || null,
        })) &&
        owned(w.token, g) &&
        tableDraft === draft
      ) {
        get<HTMLSelectElement>('encounter-table-list').value = draft.id;
        renderSourceActions();
        closeTable(tables.find((t) => t.id === draft.id));
      }
    });
  };
  get('tables-trash-visible').oninput = renderOverview;
  get('encounter-table-trash').onclick = () => {
    const t = tables.find((t) => t.id === value('encounter-table-list'));
    if (t)
      void command({
        kind: 'table-trash',
        id: t.id,
        expectedRevision: t.revision,
        trashed: !t.trashed,
      });
  };
  get('loot-table-new').onclick = () => openLoot();
  get('loot-table-open').onclick = () => {
    const t = lootTables.find((t) => t.id === value('loot-table-list'));
    if (t) openLoot(t);
  };
  get('loot-close').onclick = requestLootClose;
  get<HTMLDialogElement>('loot-table-manager').addEventListener('cancel', (event) => {
    event.preventDefault();
    requestLootClose();
  });
  get('loot-entry-add').onclick = () => {
    lootDraft?.entries.push(lootEntry());
    renderLootRows();
  };
  get('loot-form').oninput = () => {
    if (lootDraft) {
      lootDraft.name = value('loot-name');
      lootDraft.description = value('loot-description');
      lootDraft.rolls = Number(value('loot-rolls'));
    }
  };
  get('loot-form').onsubmit = (event) => {
    event.preventDefault();
    report(async () => {
      const draft = lootDraft,
        w = workspace,
        g = editorSession.generation;
      if (!draft || !w) return;
      if (
        (await command({
          kind: 'loot-save',
          table: draft,
          expectedRevision: draft.revision || null,
        })) &&
        owned(w.token, g) &&
        lootDraft === draft
      )
        closeLoot();
    });
  };
  get('loot-trash-visible').oninput = renderOverview;
  get('loot-table-trash').onclick = () => {
    const t = lootTables.find((t) => t.id === value('loot-table-list'));
    if (t)
      void command({
        kind: 'loot-trash',
        id: t.id,
        expectedRevision: t.revision,
        trashed: !t.trashed,
      });
  };
  get('loot-table-roll').onclick = rollSelectedLoot;
  get('generator-settings').onclick = () => {
    void import('./preset-settings-ui')
      .then((ui) =>
        ui.openPresetSettings(workspace?.campaign.id ?? null, value('generator-preset-list')),
      )
      .catch((e) => tell(e.message, true));
  };
  window.addEventListener('generator-registry-changed', () => void refreshGeneration());
  get('generation-discard-keep').onclick = () =>
    get<HTMLDialogElement>('generation-discard').close();
  get('generation-discard-confirm').onclick = () => {
    get<HTMLDialogElement>('generation-discard').close();
    discard();
  };
  get('generation-refresh').onclick = () => {
    void refreshGeneration();
  };
  for (const control of get('generation-fields').querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >('input,select'))
    control.oninput = () => {
      const key = control.id.replace('generation-', '');
      if (defaultKeys.some((k) => k === key)) {
        defaultOverrides.add(key);
        applyPresetDefaults();
      }
      previewDirty = true;
      renderPreview();
    };
  get('generation-use-defaults').onclick = () => {
    defaultOverrides.clear();
    applyPresetDefaults();
  };
  get('generation-form').onsubmit = (event) => {
    event.preventDefault();
    generate();
  };
  get('generation-history').onchange = () => {
    void loadHistory();
  };
}
