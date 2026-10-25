import type {
  WorldSources,
  WorldSource,
  EncounterTable,
  GenerationCommand,
  GenerationRequest,
} from './generation-contracts';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let data: WorldSources = { sources: [], factions: [], locations: [] },
  tables: EncounterTable[] = [],
  draft: WorldSource | null = null;
let save: (action: GenerationCommand['action']) => Promise<boolean>,
  changed: () => void,
  discard: (close: () => void) => void;
let baseline = '',
  saving: WorldSource | null = null;
const fields = () =>
  JSON.stringify(
    [
      ...get('world-source-form').querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'input,select',
      ),
    ].map((c) => [c.id, c.value, 'checked' in c ? c.checked : false]),
  );
function closeSource(current: WorldSource | null) {
  if (draft !== current || saving) return;
  get<HTMLDialogElement>('world-source-manager').close();
  draft = null;
}
function requestClose() {
  if (saving) return;
  const current = draft;
  if (current && fields() !== baseline) discard(() => closeSource(current));
  else closeSource(current);
}
const values = (id: string) =>
  [...get(id).querySelectorAll<HTMLInputElement>('input:checked')].map((e) => e.value);
function options(id: string, items: { id: string; name: string }[], empty: string) {
  const select = get<HTMLSelectElement>(id),
    old = select.value;
  select.replaceChildren();
  for (const item of [{ id: '', name: empty }, ...items]) {
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = item.name;
    select.append(o);
  }
  select.value = items.some((i) => i.id === old) ? old : '';
}
function checks(
  id: string,
  items: { id: string; name: string }[],
  selected: string[],
  onchange: () => void,
) {
  const root = get(id);
  root.replaceChildren();
  for (const item of [
    ...items,
    ...selected
      .filter((id) => !items.some((item) => item.id === id))
      .map((id) => ({ id, name: 'Nicht verfügbare Verknüpfung' })),
  ]) {
    const l = document.createElement('label'),
      c = document.createElement('input');
    l.className = 'check-label';
    c.type = 'checkbox';
    c.value = item.id;
    c.checked = selected.includes(item.id);
    c.onchange = onchange;
    l.append(c, document.createTextNode(item.name));
    root.append(l);
  }
}
export function worldSourceFilters(): Pick<GenerationRequest, 'factionIds' | 'locationId'> {
  return {
    factionIds: values('generation-factions'),
    locationId: get<HTMLSelectElement>('generation-location').value || null,
  };
}
export function worldSourceOpen() {
  return !!draft;
}
export function initWorldSourceUI(
  onSave: typeof save,
  onChange: typeof changed,
  onDiscard: typeof discard,
  createTable: (accept: (table: EncounterTable) => void) => void,
) {
  save = onSave;
  changed = onChange;
  discard = onDiscard;
  const fields = get('generation-fields'),
    block = document.createElement('fieldset');
  block.innerHTML =
    '<legend>Weltkontext</legend><label>Ort <select id="generation-location"></select></label><div id="generation-factions"></div><p class="caption">Leer = frei. Ort, Fraktionen und ausgewählte Tabellen schneiden ihre Quellen. Vorschläge verbrauchen keinen Bestand.</p>';
  fields.prepend(block);
  const manager = document.createElement('section');
  manager.innerHTML =
    '<h3>Weltquellen und Fraktionsbestände</h3><p>Fraktionen und Orte in „Welt und Spielabend“ anlegen. Hier verknüpfst du ihre Encounter-Quellen.</p><div class="toolbar"><label>Fraktion <select id="source-faction"></select></label><button id="source-faction-edit" type="button">Fraktionsquelle bearbeiten…</button></div><div class="toolbar"><label>Ort <select id="source-location"></select></label><button id="source-location-edit" type="button">Ortsquellen bearbeiten…</button></div>';
  get('encounter-table-list').closest('section')!.append(manager);
  const dialog = document.createElement('dialog');
  dialog.id = 'world-source-manager';
  dialog.innerHTML =
    '<form id="world-source-form"><h2 id="source-title"></h2><div id="source-primary-label"><label>Haltung zur Party −100 bis 100 <input id="source-disposition" type="number" min="-100" max="100" value="0"></label><label>Haupttabelle <select id="source-primary"></select></label><button id="source-table-new" type="button">Neue Haupttabelle anlegen…</button><p class="caption">Beim Tabellenwechsel bleiben nur Bestände gemeinsamer Kreaturen erhalten.</p></div><div id="source-table-checks"></div><div id="source-faction-checks"></div><div id="source-stock"></div><p>Leerer Bestand = unbegrenzt, 0 = nicht verfügbar. Die Spielleitung ändert Bestände ausdrücklich nach bestätigten Weltfolgen.</p><div class="toolbar"><button type="submit">Quellen speichern</button><button id="source-close" type="button">Abbrechen</button></div></form>';
  document.body.append(dialog);
  get('source-faction-edit').onclick = () =>
    openSource('faction', get<HTMLSelectElement>('source-faction').value);
  get('source-location-edit').onclick = () =>
    openSource('location', get<HTMLSelectElement>('source-location').value);
  get('generation-location').onchange = changed;
  get('source-close').onclick = requestClose;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose();
  });
  get('source-disposition').oninput = () => {
    if (draft) draft.disposition = Number(get<HTMLInputElement>('source-disposition').value);
  };
  get('source-primary').onchange = () => {
    if (!draft) return;
    const id = get<HTMLSelectElement>('source-primary').value;
    draft.tableIds = id ? [id] : [];
    const allowed = new Set(
      tables.find((t) => t.id === id)?.entries.map((e) => e.creatureId) ?? [],
    );
    draft.stock = draft.stock.filter((e) => allowed.has(e.creatureId));
    renderStock(true);
  };
  get('source-table-new').onclick = () => {
    const owner = draft;
    if (!owner || owner.kind !== 'faction' || saving) return;
    createTable((table) => {
      if (draft !== owner || saving) return;
      tables = [...tables.filter((t) => t.id !== table.id), table];
      options(
        'source-primary',
        tables.map((t) => ({ ...t, name: t.name + (t.trashed ? ' · Papierkorb' : '') })),
        'Keine Haupttabelle',
      );
      get<HTMLSelectElement>('source-primary').value = table.id;
      owner.tableIds = [table.id];
      const allowed = new Set(table.entries.map((e) => e.creatureId));
      owner.stock = owner.stock.filter((e) => allowed.has(e.creatureId));
      renderStock(true);
    });
  };
  get<HTMLFormElement>('world-source-form').onsubmit = (event) => {
    event.preventDefault();
    if (!draft || saving) return;
    const current = draft;
    saving = current;
    void (async () => {
      try {
        const saved = await save({
          kind: 'source-save',
          source: current,
          expectedRevision: current.revision || null,
        });
        if (draft === current && saved) {
          saving = null;
          closeSource(current);
          changed();
        }
      } finally {
        if (saving === current) saving = null;
      }
    })();
  };
}
export function setWorldSources(next: WorldSources, nextTables: EncounterTable[], reset = false) {
  data = next;
  tables = nextTables;
  if (reset) {
    draft = null;
    saving = null;
    baseline = '';
    get<HTMLDialogElement>('world-source-manager').close();
    get<HTMLSelectElement>('generation-location').value = '';
    get('generation-factions').replaceChildren();
  }
  const selected = values('generation-factions');
  options('generation-location', data.locations, 'Alle Orte');
  checks('generation-factions', data.factions, selected, changed);
  options('source-faction', data.factions, 'Fraktion auswählen');
  options('source-location', data.locations, 'Ort auswählen');
}
export function openWorldSourceReference(kind: WorldSource['kind'], id: string) {
  if (draft) throw new Error('Offene Weltquellen zuerst speichern oder abbrechen.');
  if (!(kind === 'faction' ? data.factions : data.locations).some((s) => s.id === id))
    throw new Error('Weltquelle nicht verfügbar.');
  openSource(kind, id);
}
function openSource(kind: WorldSource['kind'], id: string) {
  if (!id) return;
  draft = structuredClone(
    data.sources.find((s) => s.id === id && s.kind === kind) ?? {
      kind,
      id,
      revision: 0,
      tableIds: [],
      factionIds: [],
      stock: [],
    },
  );
  get('source-title').textContent =
    (kind === 'faction' ? 'Fraktionsquelle: ' : 'Ortsquellen: ') +
    (kind === 'faction' ? data.factions : data.locations).find((x) => x.id === id)?.name;
  get('source-primary-label').hidden = kind !== 'faction';
  get<HTMLInputElement>('source-disposition').value = String(draft.disposition ?? 0);
  options(
    'source-primary',
    tables.map((t) => ({ ...t, name: t.name + (t.trashed ? ' · Papierkorb' : '') })),
    'Keine Haupttabelle',
  );
  get<HTMLSelectElement>('source-primary').value = draft.tableIds[0] ?? '';
  checks(
    'source-table-checks',
    kind === 'location'
      ? tables.map((t) => ({ ...t, name: t.name + (t.trashed ? ' · Papierkorb' : '') }))
      : [],
    kind === 'location' ? draft.tableIds : [],
    () => {
      draft!.tableIds = values('source-table-checks');
    },
  );
  checks(
    'source-faction-checks',
    kind === 'location' ? data.factions : [],
    draft.factionIds,
    () => {
      draft!.factionIds = values('source-faction-checks');
    },
  );
  renderStock();
  baseline = fields();
  get<HTMLDialogElement>('world-source-manager').showModal();
}
function renderStock(preserve = false) {
  const root = get('source-stock'),
    raw = new Map(
      preserve
        ? [...root.querySelectorAll<HTMLInputElement>('input')].map((input) => [
            input.dataset.creatureId!,
            input.value,
          ])
        : [],
    );
  root.replaceChildren();
  if (!draft || draft.kind !== 'faction') return;
  const table = tables.find((t) => t.id === draft!.tableIds[0]);
  for (const e of table?.entries ?? []) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    label.textContent = e.creatureId + ' · verfügbar ';
    void window.campaign.creature(e.creatureId).then((r) => {
      if (r.ok && label.isConnected) label.firstChild!.textContent = r.value.name + ' · verfügbar ';
    });
    input.type = 'number';
    input.min = '0';
    input.max = '1000000';
    input.placeholder = 'Unbegrenzt';
    input.dataset.creatureId = e.creatureId;
    input.value =
      raw.get(e.creatureId) ??
      String(draft.stock.find((s) => s.creatureId === e.creatureId)?.limit ?? '');
    input.oninput = () => {
      draft!.stock = draft!.stock.filter((s) => s.creatureId !== e.creatureId);
      if (input.value !== '')
        draft!.stock.push({ creatureId: e.creatureId, limit: Number(input.value) });
    };
    label.append(input);
    root.append(label);
  }
}
