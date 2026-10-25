import { EditorSession } from '../shared/editor-session';
import { chooseRoomGroup } from './room-group-ui';
import { mapLabelEditor, readMapLabelEditor } from './map-label-editor';
import { atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import { writeAtlasCommit, atlasCityWrite } from './campaign-atlas-author';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type {
  CityView,
  CityUnit,
  CityPoint,
  CityCommand,
  CityOverview,
  CityPreview,
  CityRecipe,
  CityHousehold,
  CityJob,
  CityPersonMove,
} from './city-contracts';
import type { NpcPage } from '../campaign/npc-contracts';
import { CityActivityBinder } from './city-activity-ui';
import { chooseCityBuilding, confirmCityLifeMove } from './city-building-picker';
import { citySvg, generateCity, posed, roadPoints } from './city-model';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const el = <T extends Element = HTMLElement>(id: string) =>
    document.getElementById(id) as unknown as T,
  field = (id: string) => el<HTMLInputElement>(id),
  value = (id: string) => atlasFieldValue(field(id));
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
type CityEditorView = Omit<CityView, 'demographics' | 'factions'> & {
  demographics: CityView['demographics'] | null;
  factions: {
    id: string;
    name: string;
    available?: boolean;
    residentCount?: number;
    workerCount?: number;
    unitCount?: number;
  }[];
};
let workspace: WorkspaceGeometry | null = null,
  view: CityEditorView | null = null,
  overview: CityOverview | null = null,
  selected: string | null = null,
  path: CityPoint[] = [],
  preview: CityPreview | null = null,
  dirty = false,
  timer: ReturnType<typeof setTimeout> | null = null,
  tell: (s: string, error?: boolean) => void,
  openRelationships: (id: string) => Promise<void> | void = () => {};
let activity: CityActivityBinder | null = null;
let siteReadRequired = false;
let readRequest = 0,
  selectionRequest = 0,
  creating = false;
let generationJob: { token: string; epoch: number; cityId: string; cancelled: boolean } | null =
  null;
type PersonRow = NpcPage['rows'][number];
type PersonInfo = Pick<PersonRow, 'id' | 'name'> & Partial<PersonRow>;
let people: {
    moves: CityPersonMove[];
    unitId: string;
    residents: Set<string>;
    workers: Set<string>;
    households: CityHousehold[];
    jobs: CityJob[];
    rows: Map<string, PersonInfo>;
    visible: string[];
    total: number | null;
  } | null = null,
  knownPeople = new Map<string, PersonInfo>(),
  peopleRequest = 0,
  peopleTimer: ReturnType<typeof setTimeout> | null = null;
const owned = (token: string | undefined, g: number) =>
  editorSession.generation === g && workspace?.token === token;
const run = (f: () => Promise<unknown> | void) => {
  const token = workspace?.token,
    g = editorSession.generation;
  void Promise.resolve()
    .then(() => {
      if (owned(token, g)) return f();
    })
    .catch((e) => {
      if (owned(token, g)) tell(e.message, true);
    });
};
function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}
function edited() {
  dirty = true;
  clearTimer();
  timer = setTimeout(
    () =>
      run(async () => {
        await flushCity();
      }),
    700,
  );
}
function cancelGeneration() {
  if (generationJob) generationJob.cancelled = true;
  generationJob = null;
  el<HTMLButtonElement>('city-generate').disabled = false;
}

function opts(id: string, rows: { id: string; name: string }[], selectedId: string | null) {
  const s = el<HTMLSelectElement>(id);
  s.replaceChildren();
  for (const row of rows) {
    const o = document.createElement('option');
    o.value = row.id;
    o.textContent = row.name;
    s.append(o);
  }
  if (selectedId && rows.some((r) => r.id === selectedId)) s.value = selectedId;
}
function factionName(id: string) {
  return (
    overview?.factions.find((row) => row.id === id)?.name ??
    view?.factions.find((row) => row.id === id)?.name ??
    null
  );
}
function factionOptions(
  id: string,
  selectedId: string | null,
  emptyLabel: string,
  includeReferenced = true,
) {
  const select = el<HTMLSelectElement>(id),
    rows = [...(overview?.factions ?? [])],
    referenced =
      includeReferenced && selectedId ? view?.factions.find((row) => row.id === selectedId) : null;
  if (referenced && !rows.some((row) => row.id === referenced.id))
    rows.push({ id: referenced.id, name: referenced.name + ' (archiviert)' });
  if (includeReferenced && selectedId && !rows.some((row) => row.id === selectedId))
    rows.push({ id: selectedId, name: 'Unverfügbare Fraktion · Referenz bleibt erhalten' });
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);
  for (const row of rows) {
    const option = document.createElement('option');
    option.value = row.id;
    option.textContent = row.name;
    select.append(option);
  }
  select.value = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : '';
}
export function activateCity(w: WorkspaceGeometry) {
  cancelGeneration();
  clearTimer();
  if (peopleTimer) clearTimeout(peopleTimer);
  workspace = w;
  editorSession.generation++;
  siteReadRequired = false;
  creating = false;
  readRequest++;
  selectionRequest++;
  peopleRequest++;
  pendingWork.value = null;
  view = null;
  overview = null;
  selected = null;
  people = null;
  knownPeople = new Map();
  dirty = false;
  path = [];
  preview = null;
  el<HTMLDialogElement>('city-new-dialog').close();
  render();
}
async function readSelectedCity(id: string, token: string, g: number, request: number) {
  try {
    const response = await window.campaign.city(token, id);
    if (!owned(token, g) || request !== readRequest) return;
    if (dirty) {
      el<HTMLSelectElement>('city-select').value = view?.header.id ?? '';
      tell('Neue Eingabe bleibt offen. Stadt bei Bedarf erneut wählen.', true);
      return;
    }
    view = unwrap(response);
    factionOptions(
      'city-people-faction',
      value('city-people-faction') || null,
      'Alle Fraktionen',
      false,
    );
    selected = null;
    people = null;
    dirty = false;
    preview = null;
    path = [];
    render();
  } catch (error) {
    if (owned(token, g) && request === readRequest) tell((error as Error).message, true);
  }
}
export async function openCity() {
  const w = workspace,
    g = editorSession.generation,
    request = ++readRequest;
  if (!w) return;
  try {
    if (!(await flushCity()) || !owned(w.token, g) || request !== readRequest) return;
    const response = await window.campaign.cities(w.token);
    if (!owned(w.token, g) || request !== readRequest) return;
    overview = unwrap(response);
    factionOptions(
      'city-people-faction',
      value('city-people-faction') || null,
      'Alle Fraktionen',
      false,
    );
    for (const p of overview.assignedPeople) knownPeople.set(p.id, p);
    opts('city-select', overview.cities, view?.header.id ?? null);
    opts('city-location', overview.locations, view?.header.locationId ?? null);
    el('city-new-open').toggleAttribute('disabled', !overview.locations.length);
    el('city-empty').textContent = overview.locations.length
      ? 'Lege eine Stadt an oder öffne einen vorhandenen Stadtplan.'
      : 'Lege zuerst einen Ort unter „Welt und Spielabend“ an. Die Stadt verwendet dieselbe Ortsidentität.';
    if (overview.cities.length) await readSelectedCity(value('city-select'), w.token, g, request);
    else {
      view = null;
      render();
    }
  } catch (error) {
    if (owned(w.token, g) && request === readRequest) tell((error as Error).message, true);
  }
}
async function readCitySite(
  id: string,
  unitId: string | undefined,
  token: string,
  g: number,
  request: number,
  preserveDraft = false,
) {
  const response = await window.campaign.atlasCitySite(token, id, unitId);
  if (!owned(token, g) || request !== readRequest) return;
  const site = unwrap(response);
  siteReadRequired = false;
  view = {
    header: site.header,
    units: [...(site.unit ? [site.unit] : []), ...site.related],
    demographics: null,
    factions: site.factions,
    canUndo: site.canUndo,
    canRedo: site.canRedo,
  };
  selected = site.unit?.id ?? null;
  if (!preserveDraft) people = null;
  preview = null;
  opts('city-select', [site.header], id);
  render();
}
export async function openCityReference(
  id: string,
  unitId?: string,
  targeted = false,
  force = false,
) {
  const w = workspace,
    g = editorSession.generation;
  if (!w) return;
  if (!(await flushCity()) || !owned(w.token, g)) return;
  if (targeted) {
    if (!force && view?.header.id === id && (!unitId || selected === unitId)) {
      render();
      return;
    }
    await readCitySite(id, unitId, w.token, g, ++readRequest);
  } else {
    await openCity();
    if (!owned(w.token, g)) return;
    if (dirty) throw new Error('Neue Stadteingabe bleibt offen. Karte erneut wählen.');
    if (!unitId && view?.header.id === id) return;
    view = null;
    selected = null;
    people = null;
    preview = null;
    render();
    el<HTMLSelectElement>('city-select').value = id;
    await readSelectedCity(id, w.token, g, ++readRequest);
    if (!owned(w.token, g)) return;
    if (unitId) {
      const current = view as CityEditorView | null;
      if (current?.header.id !== id || !current.units.some((u) => u.id === unitId))
        throw new Error('Dieses Stadtelement ist nicht mehr verfügbar.');
      selected = unitId;
    }
  }
  if (!owned(w.token, g)) return;
  if (unitId) {
    el<HTMLSelectElement>('city-tool').value = 'select';
    if (Number(value('city-zoom')) < 2) el<HTMLInputElement>('city-zoom').value = '2';
    render();
    const panel = document.getElementById('atlas-panel');
    if (panel?.contains(el('city-inspector')))
      panel.scrollTop = el<HTMLElement>('city-inspector').offsetTop - panel.offsetTop;
    else el('city-inspector').scrollIntoView({ block: 'start' });
    el('city-unit-name').focus();
  }
}
export async function prepareCityPersonBinding(
  assignment: import('../campaign/npc-places-contracts').NpcBuildingAssignment,
) {
  const w = workspace,
    g = editorSession.generation;
  if (!w || !(await flushCity())) throw new Error('Offene Stadteingaben zuerst abschließen.');
  const { npcId, cityId, unitId, role, recordName } = assignment;
  const current = unwrap(await window.campaign.npcPlaces(w.token, npcId, 0)),
    prior = current.sites.find((s) => s.kind === role);
  if (
    prior &&
    prior.kind !== 'dungeon' &&
    (!assignment.from ||
      prior.cityId !== assignment.from.fromCityId ||
      prior.unitId !== assignment.from.fromUnitId)
  )
    throw new Error('Bisherige Gebäudebindung geändert. Hausauswahl erneut öffnen.');
  await openCityReference(cityId, unitId);
  if (
    !owned(w.token, g) ||
    view?.header.id !== cityId ||
    unit()?.id !== unitId ||
    !people ||
    people.unitId !== unitId
  )
    throw new Error('Hauskontext geändert.');
  const npc = unwrap(await window.campaign.npc(w.token, npcId));
  if (!owned(w.token, g) || people?.unitId !== unitId) throw new Error('Stadtkontext gewechselt.');
  if (recordName.trim() && (role === 'home' ? people.households.length : people.jobs.length) >= 100)
    throw new Error('Haus hat bereits 100 solche Einträge.');
  const person = {
    id: npc.id,
    name: npc.name,
    creatureId: npc.creatureId,
    lifecycle: npc.record.lifecycle,
    factionId: npc.record.factionId,
    locationId: npc.locationId,
    disposition: npc.disposition,
    role: npc.role,
  };
  knownPeople.set(npcId, person);
  people.rows.set(npcId, person);
  if (role === 'home') people.residents.add(npcId);
  else people.workers.add(npcId);
  if (assignment.from && assignment.from.fromCityId !== cityId)
    people.moves.push({ ...assignment.from, npcId, role });
  if (recordName.trim()) {
    if (role === 'home') {
      for (const h of people.households) h.memberIds = h.memberIds.filter((id) => id !== npcId);
      people.households.push({ id: crypto.randomUUID(), name: recordName, memberIds: [npcId] });
    } else {
      for (const j of people.jobs) j.workerIds = j.workerIds.filter((id) => id !== npcId);
      people.jobs.push({ id: crypto.randomUUID(), name: recordName, workerIds: [npcId] });
    }
  }
  peopleRequest++;
  if (peopleTimer) clearTimeout(peopleTimer);
  peopleTimer = null;
  people.visible = [npcId];
  people.total = null;
  el<HTMLInputElement>('city-people-search').value = npc.name;
  dirty = true;
  clearTimer();
  drawPeople();
  el('city-people-results')
    .querySelector<HTMLElement>('[data-city-person-id="' + CSS.escape(npcId) + '"]')
    ?.scrollIntoView({ block: 'center' });
  tell(
    assignment.from && assignment.from.fromCityId !== cityId
      ? 'Stadtwechsel vorbereitet. Hausangaben speichern ändert bisherige und neue Bindung gemeinsam.'
      : 'Personenbindung vorbereitet. Hausangaben speichern übernimmt die Änderung.',
  );
}
async function change(action: CityCommand['action']) {
  const w = workspace,
    g = editorSession.generation,
    source = view;
  if (!w) throw new Error('Kampagne öffnen.');
  const id = action.kind === 'create' ? action.header.id : source?.header.id;
  if (!id) throw new Error('Stadt öffnen.');
  const command = {
    commandId: crypto.randomUUID(),
    token: w.token,
    campaignId: w.campaign.id,
    cityId: id,
    expectedRevision: action.kind === 'create' ? 0 : source!.header.revision,
    action,
  };
  readRequest++;
  if (source?.demographics === null && action.kind !== 'create') {
    const ack = unwrap(
      await writeAtlasCommit({
        ...command,
        action: {
          kind: action.kind === 'undo' || action.kind === 'redo' ? action.kind : 'city',
          ...(action.kind === 'undo' || action.kind === 'redo' ? {} : { command }),
        } as import('./campaign-atlas-contracts').AtlasAction,
      }),
    );
    if (!owned(w.token, g) || view?.header.id !== source.header.id)
      throw new Error('Stadtkontext gewechselt.');
    try {
      await readCitySite(
        id,
        action.kind === 'change' && action.remove.includes(selected ?? '')
          ? undefined
          : (selected ?? undefined),
        w.token,
        g,
        ++readRequest,
        true,
      );
    } catch (error) {
      siteReadRequired = true;
      tell('Stadt gespeichert. Element erneut laden: ' + (error as Error).message, true);
      throw Object.assign(new Error('Gespeichert. Element vor weiterer Änderung neu laden.'), {
        committed: true,
        revision: ack.revision,
      });
    }
    tell('Stadt gespeichert.');
    return view!;
  }
  const response = await atlasCityWrite(command);
  if (!owned(w.token, g) || view?.header.id !== source?.header.id)
    throw new Error('Stadtkontext gewechselt.');
  const result = unwrap(response);
  readRequest++;
  view = result;
  preview = null;
  render();
  tell('Stadt gespeichert.');
  return result;
}
function unit() {
  return view?.units.find((u) => u.id === selected);
}
function personDraft(u: CityUnit) {
  if (u.kind !== 'building') {
    people = null;
    return;
  }
  if (people?.unitId === u.id) return;
  people = {
    moves: [],
    unitId: u.id,
    residents: new Set(u.residentIds ?? []),
    workers: new Set(u.workerIds ?? []),
    households: structuredClone(u.households ?? []),
    jobs: structuredClone(u.jobs ?? []),
    rows: new Map(knownPeople),
    visible: [],
    total: null,
  };
  run(refreshPeople);
}
async function relocateLifeRecord(role: 'home' | 'work', recordId: string) {
  if (!(await flushCity())) return;
  const w = workspace,
    g = editorSession.generation,
    source = view,
    u = unit();
  if (!w || !source || u?.kind !== 'building') return;
  const household = role === 'home' ? u.households?.find((h) => h.id === recordId) : null,
    job = role === 'work' ? u.jobs?.find((j) => j.id === recordId) : null,
    record = household ?? job;
  if (!record) throw new Error('Haushalt oder Beruf nicht mehr vorhanden.');
  const memberIds = household?.memberIds ?? job!.workerIds,
    title = (role === 'home' ? 'Haushalt' : 'Beruf') + ' „' + record.name + '“ umziehen';
  const destination = await chooseCityBuilding(w.token, title, u.id);
  if (!destination || !owned(w.token, g) || view?.header.id !== source.header.id) return;
  const targetView = unwrap(await window.campaign.city(w.token, destination.cityId));
  if (!owned(w.token, g) || view?.header.id !== source.header.id) return;
  const target = targetView.units.find((b) => b.id === destination.unitId && b.kind === 'building');
  if (!target) throw new Error('Zielhaus nicht mehr vorhanden.');
  const names = memberIds.map(
    (id) => knownPeople.get(id)?.name ?? people?.rows.get(id)?.name ?? id,
  );
  if (
    !(await confirmCityLifeMove(
      title,
      (u.name || 'Unbenanntes Haus') + ' · ' + source.header.name,
      destination.title + ' · ' + destination.cityTitle,
      names,
    )) ||
    !owned(w.token, g) ||
    view?.header.id !== source.header.id
  )
    return;
  const next = structuredClone(target);
  next.protected = true;
  if (household) {
    next.households = [...(next.households ?? []), structuredClone(household)];
    next.residentIds = [...new Set([...(next.residentIds ?? []), ...memberIds])];
  } else {
    next.jobs = [...(next.jobs ?? []), structuredClone(job!)];
    next.workerIds = [...new Set([...(next.workerIds ?? []), ...memberIds])];
  }
  const result = await atlasCityWrite({
    commandId: crypto.randomUUID(),
    token: w.token,
    campaignId: w.campaign.id,
    cityId: destination.cityId,
    expectedRevision: targetView.header.revision,
    action: {
      kind: 'change',
      upsert: [next],
      remove: [],
      label: role === 'home' ? 'Haushalt umziehen' : 'Berufsgruppe umziehen',
      lifeMoves: [
        {
          role,
          recordId,
          fromCityId: source.header.id,
          fromUnitId: u.id,
          expectedRevision: source.header.revision,
          toUnitId: target.id,
        },
      ],
    },
  });
  unwrap(result);
  if (!owned(w.token, g)) return;
  people = null;
  await openCityReference(destination.cityId, target.id);
  tell(
    (role === 'home' ? 'Haushalt' : 'Berufsgruppe') +
      ' mit ' +
      memberIds.length +
      ' NSC umgezogen. Rückgängig ist in beiden beteiligten Städten verfügbar.',
  );
}
const counted = (amount: number, one: string, many: string) =>
  amount + ' ' + (amount === 1 ? one : many);
function boundCityControls() {
  const partial = view?.demographics === null;
  for (const id of [
    'city-people-search',
    'city-people-faction',
    'city-household-add',
    'city-job-add',
  ])
    el<HTMLButtonElement>(id).disabled = partial;
  for (const id of ['city-people-results', 'city-households', 'city-jobs'])
    for (const control of el(id).querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input,button',
    ))
      control.disabled = partial;
}
function drawPeopleStatus() {
  if (!people) {
    el('city-people-status').textContent = '';
    return;
  }
  el('city-people-status').textContent =
    counted(people.residents.size, 'Bewohner', 'Bewohner') +
    ' in ' +
    counted(people.households.length, 'Haushalt', 'Haushalten') +
    ' · ' +
    counted(people.workers.size, 'Beschäftigter', 'Beschäftigte') +
    ' in ' +
    counted(people.jobs.length, 'Beruf', 'Berufen') +
    ' · aktuelle Position bleibt beim World-NPC.' +
    (view?.demographics === null ? ' · Für Bindungen Stadtwerkzeuge und Bewohner laden.' : '') +
    (people.total === null ? '' : ' · ' + people.total + ' Treffer, höchstens 50 angezeigt.');
}
function drawHouseholds() {
  const root = el('city-households');
  root.replaceChildren();
  if (!people) return;
  for (const household of people.households) {
    const row = document.createElement('div'),
      name = document.createElement('input'),
      title = document.createElement('label'),
      remove = document.createElement('button');
    row.className = 'party-card';
    title.append(document.createTextNode('Haushaltsname '));
    name.value = household.name;
    name.maxLength = 1000;
    name.dataset.cityHousehold = 'name';
    name.oninput = () => {
      household.name = name.value;
      edited();
    };
    title.append(name);
    row.append(title);
    for (const id of people.residents) {
      const choice = document.createElement('label'),
        box = document.createElement('input'),
        person = people.rows.get(id);
      box.type = 'checkbox';
      box.dataset.cityHousehold = 'member';
      box.checked = household.memberIds.includes(id);
      box.onchange = () => {
        if (box.checked) {
          for (const h of people!.households)
            h.memberIds = h.memberIds.filter((member) => member !== id);
          household.memberIds.push(id);
        } else household.memberIds = household.memberIds.filter((member) => member !== id);
        edited();
        drawHouseholds();
        drawPeopleStatus();
      };
      choice.append(box, document.createTextNode(' ' + (person?.name ?? id)));
      row.append(choice);
    }
    remove.type = 'button';
    remove.textContent = 'Haushalt auflösen';
    remove.onclick = () => {
      people!.households = people!.households.filter((h) => h.id !== household.id);
      edited();
      drawHouseholds();
      drawPeopleStatus();
    };
    const move = document.createElement('button');
    move.type = 'button';
    move.textContent = 'Haushalt umziehen…';
    move.dataset.cityHouseholdMove = household.id;
    move.onclick = () => run(() => relocateLifeRecord('home', household.id));
    row.append(move, remove);
    root.append(row);
  }
  if (!people.households.length) root.textContent = 'Noch kein Haushalt in diesem Haus.';
}
function drawJobs() {
  const root = el('city-jobs');
  root.replaceChildren();
  if (!people) return;
  for (const job of people.jobs) {
    const row = document.createElement('div'),
      name = document.createElement('input'),
      title = document.createElement('label'),
      remove = document.createElement('button');
    row.className = 'party-card';
    title.append(document.createTextNode('Berufsname '));
    name.value = job.name;
    name.maxLength = 1000;
    name.dataset.cityJob = 'name';
    name.oninput = () => {
      job.name = name.value;
      edited();
    };
    title.append(name);
    row.append(title);
    for (const id of people.workers) {
      const choice = document.createElement('label'),
        box = document.createElement('input'),
        person = people.rows.get(id);
      box.type = 'checkbox';
      box.dataset.cityJob = 'worker';
      box.checked = job.workerIds.includes(id);
      box.onchange = () => {
        if (box.checked) {
          for (const j of people!.jobs) j.workerIds = j.workerIds.filter((worker) => worker !== id);
          job.workerIds.push(id);
        } else job.workerIds = job.workerIds.filter((worker) => worker !== id);
        edited();
        drawJobs();
        drawPeopleStatus();
      };
      choice.append(box, document.createTextNode(' ' + (person?.name ?? id)));
      row.append(choice);
    }
    remove.type = 'button';
    remove.textContent = 'Beruf auflösen';
    remove.onclick = () => {
      people!.jobs = people!.jobs.filter((j) => j.id !== job.id);
      edited();
      drawJobs();
      drawPeopleStatus();
    };
    const move = document.createElement('button');
    move.type = 'button';
    move.textContent = 'Berufsgruppe umziehen…';
    move.dataset.cityJobMove = job.id;
    move.onclick = () => run(() => relocateLifeRecord('work', job.id));
    row.append(move, remove);
    root.append(row);
  }
  if (!people.jobs.length) root.textContent = 'Noch kein Beruf an diesem Arbeitsplatz.';
}
function drawPeople() {
  const root = el('city-people-results');
  root.replaceChildren();
  if (!people) {
    drawPeopleStatus();
    for (const id of ['city-households', 'city-jobs']) el(id).replaceChildren();
    return;
  }
  const ids = [...new Set([...people.visible, ...people.residents, ...people.workers])],
    home = new Map<string, CityUnit>(),
    work = new Map<string, CityUnit>();
  for (const b of view?.units.filter((u) => u.kind === 'building' && u.id !== people!.unitId) ??
    []) {
    for (const id of b.residentIds ?? []) home.set(id, b);
    for (const id of b.workerIds ?? []) work.set(id, b);
  }
  for (const id of ids) {
    const p = people.rows.get(id) ?? { id, name: id },
      row = document.createElement('div'),
      name = document.createElement('strong');
    row.className = 'party-card';
    row.dataset.cityPersonId = id;
    name.textContent = p.name;
    row.append(name);
    const detail = document.createElement('p');
    detail.className = 'caption';
    detail.textContent =
      [
        p.lifecycle === 'defeated' ? 'ausgeschieden' : null,
        p.factionId ? 'Fraktion: ' + (factionName(p.factionId) ?? 'nicht verfügbar') : null,
        p.locationId ? 'aktuell an einem World-Ort' : null,
        home.get(id) ? 'bisheriger Wohnort: ' + (home.get(id)!.name || 'anderes Haus') : null,
        work.get(id) ? 'bisheriger Arbeitsplatz: ' + (work.get(id)!.name || 'anderes Haus') : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'World-NPC';
    row.append(detail);
    for (const [role, label, set] of [
      ['resident', 'Wohnt hier', people.residents],
      ['worker', 'Arbeitet hier', people.workers],
    ] as const) {
      const choice = document.createElement('label'),
        box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.cityPerson = role;
      box.value = id;
      box.checked = set.has(id);
      box.onchange = () => {
        if (box.checked && set.size >= 200) {
          box.checked = false;
          tell('Höchstens 200 Bindungen dieser Art je Haus.', true);
          return;
        }
        if (box.checked) set.add(id);
        else {
          set.delete(id);
          if (role === 'resident')
            for (const h of people!.households)
              h.memberIds = h.memberIds.filter((member) => member !== id);
          else
            for (const j of people!.jobs)
              j.workerIds = j.workerIds.filter((worker) => worker !== id);
        }
        edited();
        drawPeople();
      };
      choice.append(box, document.createTextNode(' ' + label));
      row.append(choice);
    }
    const relationships = document.createElement('button');
    relationships.type = 'button';
    relationships.textContent = 'Beziehungen öffnen';
    relationships.setAttribute('aria-label', 'Beziehungen von ' + p.name + ' öffnen');
    relationships.dataset.cityRelationships = id;
    relationships.onclick = () => run(() => openRelationships(id));
    row.append(relationships);
    root.append(row);
  }
  if (!ids.length) root.textContent = 'Keine passenden World-NPCs.';
  drawPeopleStatus();
  drawHouseholds();
  drawJobs();
  boundCityControls();
}
async function refreshPeople() {
  const w = workspace,
    g = editorSession.generation,
    u = unit(),
    draft = people,
    request = ++peopleRequest;
  if (!w || u?.kind !== 'building' || !draft || draft.unitId !== u.id) return;
  const response = await window.campaign.npcs(w.token, {
    text: value('city-people-search'),
    lifecycle: 'all',
    factionId: value('city-people-faction') || null,
    locationId: null,
    offset: 0,
  });
  if (!owned(w.token, g) || request !== peopleRequest || people !== draft) return;
  const page = unwrap(response);
  for (const row of page.rows) {
    knownPeople.set(row.id, row);
    draft.rows.set(row.id, row);
  }
  draft.visible = page.rows.map((row) => row.id);
  draft.total = page.total;
  drawPeople();
}
function inspector() {
  const u = unit();
  el('city-inspector').hidden = !u;
  el('city-building-fields').hidden = u?.kind !== 'building';
  el('city-faction-field').hidden = !u || !['building', 'district'].includes(u.kind);
  if (!u || dirty) return;
  mapLabelEditor(el('city-unit-form'), 'city', u.label, edited);
  field('city-unit-name').value = u.name;
  field('city-unit-protected').checked = u.protected;
  if (['building', 'district'].includes(u.kind))
    factionOptions('city-unit-faction', u.factionId ?? null, 'Keine Fraktion');
  setAtlasFieldValue(field('city-unit-width'), String(u.width ?? 10));
  el('city-width-field').hidden = !['road', 'wall'].includes(u.kind);
  el('city-outline-field').hidden = ['building', 'node'].includes(u.kind);
  setAtlasFieldValue(
    el<HTMLTextAreaElement>('city-unit-points'),
    (['road', 'wall'].includes(u.kind) ? roadPoints(u, view!.units) : (u.outline ?? []))
      .map((p) => p.x + ', ' + p.y)
      .join('\n'),
  );
  if (u.kind === 'building') {
    personDraft(u);
    setAtlasFieldValue(field('city-x'), String(u.position!.x));
    setAtlasFieldValue(field('city-y'), String(u.position!.y));
    field('city-angle').value = String(((u.angle ?? 0) * 180) / Math.PI);
    const p = u.outline!;
    setAtlasFieldValue(
      field('city-house-width'),
      String(Math.max(...p.map((p) => p.x)) - Math.min(...p.map((p) => p.x))),
    );
    setAtlasFieldValue(
      field('city-house-depth'),
      String(Math.max(...p.map((p) => p.y)) - Math.min(...p.map((p) => p.y))),
    );
    field('city-ground-mode').value = u.terrain?.mode ?? 'ground';
    setAtlasFieldValue(field('city-ground-offset'), String(u.terrain?.offsetM ?? 0));
    setAtlasFieldValue(field('city-wall-height'), String(u.terrain?.wallM ?? 3));
    setAtlasFieldValue(field('city-roof-height'), String(u.terrain?.roofM ?? 2));
    field('city-unit-use').value = u.use ?? '';
    el<HTMLTextAreaElement>('city-unit-notes').value = u.notes ?? '';
    el('city-interior-status').textContent = 'Gemeinsame Raumgruppe · zum Bearbeiten hineinzoomen.';
    drawPeople();
  } else people = null;
  el('city-unit-type').textContent = {
    node: 'Straßenknoten',
    road: 'Straße',
    wall: 'Befestigung',
    district: 'Viertel',
    water: 'Wasserfläche',
    plaza: 'Platz',
    building: 'Haus',
  }[u.kind];
}
function drawDemographics() {
  if (!view) return;
  if (view.demographics === null) {
    el('city-demographics-summary').textContent =
      'Einzelauswahl · Bewohner und Stadtübersicht bei Bedarf laden.';
    el('city-demographics-breakdown').replaceChildren();
    return;
  }
  const d = view.demographics,
    summary = el('city-demographics-summary'),
    root = el('city-demographics-breakdown');
  summary.textContent =
    counted(d.residentCount, 'bestätigter Bewohner', 'bestätigte Bewohner') +
    ' · ' +
    counted(d.profiledCount, 'mit Demografieprofil', 'mit Demografieprofil');
  root.replaceChildren();
  const section = (title: string, rows: { label: string; count: number }[]) => {
    const block = document.createElement('section'),
      heading = document.createElement('h4');
    heading.textContent = title;
    block.append(heading);
    if (rows.length) {
      const list = document.createElement('ul');
      for (const row of rows) {
        const item = document.createElement('li');
        item.textContent = row.label + ': ' + row.count;
        list.append(item);
      }
      block.append(list);
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'Noch keine Angaben.';
      block.append(empty);
    }
    root.append(block);
  };
  section(
    'Herkunft / Spezies',
    d.ancestries.map((row) => ({ label: row.value, count: row.count })),
  );
  section(
    'Geschlecht',
    d.genders.map((row) => ({ label: row.value, count: row.count })),
  );
  section(
    'Alter',
    d.ages.map((row) => ({ label: row.years + ' Jahre', count: row.count })),
  );
}
function drawFactions() {
  if (!view) return;
  if (view.demographics === null) {
    el('city-factions-summary').textContent = 'Fraktionen der Einzelauswahl';
    el('city-factions-list').replaceChildren();
    return;
  }
  const root = el('city-factions-list'),
    factions = view.factions;
  el('city-factions-summary').textContent = factions.length
    ? counted(factions.length, 'referenzierte Fraktion', 'referenzierte Fraktionen')
    : 'Noch keine Fraktion in dieser Stadt referenziert.';
  root.replaceChildren();
  if (!factions.length) return;
  const list = document.createElement('ul');
  for (const faction of factions) {
    const item = document.createElement('li');
    item.textContent =
      faction.name +
      (faction.available ? '' : ' (archiviert)') +
      ' · ' +
      counted(faction.residentCount ?? 0, 'Bewohner', 'Bewohner') +
      ' · ' +
      counted(faction.workerCount ?? 0, 'Beschäftigter', 'Beschäftigte') +
      ' · ' +
      counted(faction.unitCount ?? 0, 'Haus oder Viertel', 'Häuser oder Viertel');
    list.append(item);
  }
  root.append(list);
}
function render() {
  document.dispatchEvent(new Event('atlas-draft'));
  const has = !!view;
  activity?.contextChanged();
  el('city-workbench').hidden = !has;
  el('city-empty').hidden = has;
  if (!view) return;
  el('city-title').textContent = view.header.name;
  el<HTMLButtonElement>('city-undo').disabled = !view.canUndo;
  el<HTMLButtonElement>('city-redo').disabled = !view.canRedo;
  el('city-refresh').textContent =
    view.demographics === null ? 'Stadtwerkzeuge und Bewohner laden' : 'Stadt aktualisieren';
  el('city-count').textContent =
    view.demographics === null
      ? 'Einzelauswahl'
      : view.units.filter((u) => u.kind === 'building').length +
        ' Häuser · ' +
        view.units.filter((u) => u.kind === 'building' && u.protected).length +
        ' geschützt';
  drawDemographics();
  drawFactions();
  opts(
    'city-district',
    view.units.filter((u) => u.kind === 'district'),
    el<HTMLSelectElement>('city-district').value || null,
  );
  field('city-paper').value = view.header.paper;
  field('city-roof').value = view.header.roof;
  const canvas = el<SVGSVGElement>('city-map');
  if (canvas.dataset.sharedAtlas !== 'true') {
    const all = preview
      ? {
          ...view,
          units: [
            ...view.units.filter((u) => !preview!.replaceIds.includes(u.id)),
            ...preview.buildings,
          ],
        }
      : view;
    const markup = citySvg(all),
      doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    canvas.setAttribute('viewBox', doc.documentElement.getAttribute('viewBox')!);
    canvas.replaceChildren(
      ...Array.from(doc.documentElement.children).map((n) => document.importNode(n, true)),
    );
    canvas.setAttribute('aria-label', view.header.name + ' in Metern');
    const z = Number(value('city-zoom')),
      focus =
        z > 1
          ? (unit()?.position ?? { x: view.header.width / 2, y: view.header.height / 2 })
          : { x: view.header.width / 2, y: view.header.height / 2 },
      vw = view.header.width / z,
      vh = view.header.height / z;
    canvas.setAttribute('viewBox', `${focus.x - vw / 2} ${focus.y - vh / 2} ${vw} ${vh}`);
    // Geometry stays native and individually selectable after acceptance.
    const ns = 'http://www.w3.org/2000/svg';
    for (const u of view.units
      .filter((u) => u.kind !== 'node')
      .sort(
        (a, b) =>
          Number(['road', 'wall'].includes(a.kind)) - Number(['road', 'wall'].includes(b.kind)),
      )) {
      let p: CityPoint[] = [],
        tag = 'polygon';
      if (['road', 'wall'].includes(u.kind)) {
        p = roadPoints(u, view.units);
        tag = 'polyline';
      } else p = u.kind === 'building' ? posed(u) : (u.outline ?? []);
      const hit = document.createElementNS(ns, tag);
      hit.setAttribute('points', p.map((p) => p.x + ',' + p.y).join(' '));
      hit.setAttribute('fill', tag === 'polyline' ? 'none' : 'transparent');
      hit.setAttribute('stroke', u.id === selected ? '#176c74' : 'transparent');
      hit.setAttribute(
        'stroke-width',
        String(tag === 'polyline' ? Math.max(8, u.width ?? 6) : 1.8),
      );
      hit.dataset.cityUnit = u.id;
      hit.addEventListener('click', (e) => {
        if (value('city-tool') !== 'select') return;
        e.stopPropagation();
        run(async () => {
          if (!(await flushCity())) return;
          selected = u.id;
          render();
        });
      });
      canvas.append(hit);
    }
    if (path.length) {
      const line = document.createElementNS(ns, 'polyline');
      line.setAttribute('points', path.map((p) => p.x + ',' + p.y).join(' '));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', '#176c74');
      line.setAttribute('stroke-width', '2');
      canvas.append(line);
      for (const p of path) {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', String(p.x));
        c.setAttribute('cy', String(p.y));
        c.setAttribute('r', '2');
        c.setAttribute('fill', '#176c74');
        canvas.append(c);
      }
    }
  }
  el('city-preview-actions').hidden = !preview;
  el('city-preview-summary').textContent = preview
    ? 'Seed ' +
      preview.recipe.seed +
      ' · ' +
      preview.buildings.length +
      ' vorgeschlagene Häuser · ' +
      preview.replaceIds.length +
      ' ungeschützte Häuser werden ersetzt · geschützte Häuser bleiben erhalten.'
    : '';
  el('city-path-hint').textContent = path.length
    ? path.length + ' Punkte · Enter/Abschließen übernimmt · Escape verwirft'
    : 'Wähle ein Werkzeug und klicke seine Punkte in die Karte.';
  inspector();
}
function inspectorFields() {
  const fields = [
    ...el('city-unit-form').querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input,textarea,select'),
  ]
    .filter(
      (i) =>
        !['city-people-search', 'city-people-faction'].includes(i.id) &&
        !i.dataset.cityPerson &&
        !i.dataset.cityHousehold &&
        !i.dataset.cityJob,
    )
    .map((i) => [
      i.id,
      i.type === 'checkbox' ? (i as HTMLInputElement).checked : atlasFieldValue(i),
    ]);
  if (people?.unitId === selected)
    fields.push(
      ['residentIds', [...people.residents].sort().join('\u0000')],
      ['workerIds', [...people.workers].sort().join('\u0000')],
      ['households', JSON.stringify(people.households)],
      ['jobs', JSON.stringify(people.jobs)],
    );
  return JSON.stringify(fields);
}
function collectUnit(u: CityUnit) {
  const next = {
      ...u,
      label: readMapLabelEditor(el('city-unit-form'), 'city'),
      name: value('city-unit-name'),
      protected: field('city-unit-protected').checked,
    },
    extra: CityUnit[] = [];
  if (['building', 'district'].includes(u.kind)) {
    next.factionId = value('city-unit-faction') || null;
    if (next.factionId) next.protected = true;
  }
  if (!['building', 'node'].includes(u.kind)) {
    const points = value('city-unit-points')
      .split(/\r?\n/)
      .filter((s) => s.trim())
      .map((s) => {
        const [x, y] = s.split(',').map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y))
          throw new Error('Ein Punkt pro Zeile: x, y.');
        return { x: x!, y: y! };
      });
    if (['road', 'wall'].includes(u.kind)) {
      if (points.length < 2) throw new Error('Straße benötigt zwei Enden.');
      for (const [i, p] of [
        [0, points[0]],
        [1, points.at(-1)],
      ] as const) {
        const n = view!.units.find((n) => n.id === u.nodeIds![i]);
        if (!n || !p) throw new Error('Straßenknoten fehlt.');
        extra.push({ ...n, point: p });
      }
      next.via = points.slice(1, -1);
    } else next.outline = points;
    next.protected = true;
  }
  if (['road', 'wall'].includes(u.kind)) next.width = Number(value('city-unit-width'));
  if (u.kind === 'building') {
    const oldWidth =
        Math.max(...u.outline!.map((p) => p.x)) - Math.min(...u.outline!.map((p) => p.x)),
      oldDepth = Math.max(...u.outline!.map((p) => p.y)) - Math.min(...u.outline!.map((p) => p.y)),
      sx = Number(value('city-house-width')) / oldWidth,
      sy = Number(value('city-house-depth')) / oldDepth;
    if (!Number.isFinite(sx + sy) || sx <= 0 || sy <= 0)
      throw new Error('Positive Hausmaße eingeben.');
    if (!people || people.unitId !== u.id) throw new Error('Bewohnerbindungen neu laden.');
    next.position = { x: Number(value('city-x')), y: Number(value('city-y')) };
    next.angle = (Number(value('city-angle')) * Math.PI) / 180;
    next.outline = u.outline!.map((p) => ({ x: p.x * sx, y: p.y * sy }));
    next.terrain = {
      mode: value('city-ground-mode') as 'ground' | 'fixed',
      offsetM: Number(value('city-ground-offset')),
      wallM: Number(value('city-wall-height')),
      roofM: Number(value('city-roof-height')),
    };
    next.use = value('city-unit-use');
    const notes = value('city-unit-notes');
    next.notes = notes === (u.notes ?? '').replace(/\r\n?/g, '\n') ? u.notes : notes;
    next.residentIds = [...people.residents].sort();
    next.workerIds = [...people.workers].sort();
    next.households = structuredClone(people.households);
    next.jobs = structuredClone(people.jobs);
    next.protected = true;
    for (const other of view!.units.filter((v) => v.kind === 'building' && v.id !== u.id)) {
      const residentIds = (other.residentIds ?? []).filter((id) => !people!.residents.has(id)),
        workerIds = (other.workerIds ?? []).filter((id) => !people!.workers.has(id)),
        households = (other.households ?? []).map((h) => ({
          ...h,
          memberIds: h.memberIds.filter((id) => residentIds.includes(id)),
        })),
        jobs = (other.jobs ?? []).map((j) => ({
          ...j,
          workerIds: j.workerIds.filter((id) => workerIds.includes(id)),
        }));
      if (
        residentIds.length !== (other.residentIds ?? []).length ||
        workerIds.length !== (other.workerIds ?? []).length
      )
        extra.push({ ...other, residentIds, workerIds, households, jobs, protected: true });
    }
  }
  return [...extra, next];
}
function saveInspector(): Promise<boolean> {
  if (pendingWork.value) return pendingWork.value;
  const w = workspace,
    g = editorSession.generation,
    id = view?.header.id,
    unitId = selected;
  if (!w || !id || !unitId || !dirty) return Promise.resolve(true);
  if (siteReadRequired) {
    tell('Gespeichert. Element vor weiterer Änderung neu laden.', true);
    return Promise.resolve(false);
  }
  const task = Promise.resolve().then(async () => {
    try {
      while (owned(w.token, g) && view?.header.id === id && selected === unitId && dirty) {
        clearTimer();
        const u = unit();
        if (!u) throw new Error('Stadtelement fehlt.');
        const fields = inspectorFields(),
          upsert = collectUnit(u);
        const draft = people,
          moves = (draft?.moves ?? []).filter((m) =>
            (m.role === 'home' ? draft!.residents : draft!.workers).has(m.npcId),
          );
        await change({
          kind: 'change',
          upsert,
          remove: [],
          label: moves.length ? 'Personenbindung zwischen Städten wechseln' : 'Element bearbeiten',
          bindingMoves: moves,
        });
        if (people === draft && draft) draft.moves = [];
        if (!owned(w.token, g) || view?.header.id !== id || selected !== unitId) return false;
        dirty = fields !== inspectorFields();
        inspector();
      }
      return owned(w.token, g) && view?.header.id === id && selected === unitId;
    } catch (error) {
      if (owned(w.token, g) && view?.header.id === id) tell((error as Error).message, true);
      return false;
    }
  });
  pendingWork.value = task;
  return task;
}
export async function flushCity() {
  const token = workspace?.token,
    g = editorSession.generation,
    id = view?.header.id;
  clearTimer();
  if (path.length) {
    tell('Schließe den begonnenen Stadtzug ab oder verwirf ihn.', true);
    return false;
  }
  if (generationJob) {
    tell('Bebauung läuft. Vorschau abschließen oder abbrechen.', true);
    return false;
  }
  return (await saveInspector()) && owned(token, g) && view?.header.id === id;
}
async function reloadInspector() {
  const w = workspace,
    g = editorSession.generation,
    id = view?.header.id,
    unitId = selected;
  if (!w || !id || !unitId) return;
  if (generationJob) {
    tell('Bebauung zuerst abschließen oder abbrechen.', true);
    return;
  }
  clearTimer();
  if (pendingWork.value) await pendingWork.value;
  if (!owned(w.token, g) || view?.header.id !== id || selected !== unitId) return;
  const fields = inspectorFields(),
    request = ++readRequest;
  if (view?.demographics === null) {
    const response = await window.campaign.atlasCitySite(w.token, id, unitId);
    if (!owned(w.token, g) || request !== readRequest || selected !== unitId) return;
    if (fields !== inspectorFields()) {
      tell('Neue Eingabe bleibt offen. Bei Bedarf erneut laden.', true);
      return;
    }
    const site = unwrap(response);
    view = {
      header: site.header,
      units: [...(site.unit ? [site.unit] : []), ...site.related],
      demographics: null,
      factions: site.factions,
      canUndo: site.canUndo,
      canRedo: site.canRedo,
    };
    siteReadRequired = false;
    dirty = false;
    clearTimer();
    people = null;
    preview = null;
    render();
    tell('Gespeichertes Element geladen.');
    return;
  }
  const response = await window.campaign.city(w.token, id);
  if (!owned(w.token, g) || request !== readRequest || selected !== unitId) return;
  if (fields !== inspectorFields()) {
    tell('Neue Eingabe bleibt offen. Bei Bedarf erneut laden.', true);
    return;
  }
  const saved = unwrap(response);
  view = saved;
  dirty = false;
  clearTimer();
  people = null;
  preview = null;
  if (!unit()) selected = null;
  render();
  tell('Gespeichertes Element geladen.');
}
async function finish() {
  if (!view) return;
  const kind = value('city-tool');
  if (['road', 'wall'].includes(kind)) {
    if (path.length < 2) throw new Error('Mindestens zwei Straßenpunkte anklicken.');
    const nodes: CityUnit[] = [];
    const end = (p: CityPoint) => {
      const n = view!.units.find(
        (u) => u.kind === 'node' && Math.hypot(u.point!.x - p.x, u.point!.y - p.y) < 4,
      );
      if (n) return n.id;
      const id = crypto.randomUUID();
      nodes.push({ id, kind: 'node', name: '', protected: true, point: { ...p } });
      return id;
    };
    const u: CityUnit = {
      id: crypto.randomUUID(),
      kind: kind as 'road' | 'wall',
      name: kind === 'road' ? 'Neue Straße' : 'Stadtmauer',
      protected: true,
      nodeIds: [end(path[0]!), end(path.at(-1)!)],
      via: path.slice(1, -1),
      width: Number(value('city-draw-width')),
    };
    await change({
      kind: 'change',
      upsert: [...nodes, u],
      remove: [],
      label: 'Straßenzug anlegen',
    });
    selected = u.id;
  } else {
    if (path.length < 3) throw new Error('Mindestens drei Flächenecken anklicken.');
    const u: CityUnit = {
      id: crypto.randomUUID(),
      kind: kind as 'district' | 'plaza' | 'water',
      name: kind === 'district' ? 'Neues Viertel' : kind === 'plaza' ? 'Neuer Platz' : 'Wasser',
      protected: true,
      outline: [...path],
      ...(kind === 'district' ? { factionId: null } : {}),
    };
    await change({ kind: 'change', upsert: [u], remove: [], label: 'Fläche anlegen' });
    selected = u.id;
  }
  path = [];
  field('city-tool').value = 'select';
  render();
}
async function createCity() {
  const w = workspace,
    g = editorSession.generation,
    sourceId = view?.header.id;
  if (!w || creating) return;
  const header = {
    id: crypto.randomUUID(),
    revision: 1,
    name: value('city-new-name'),
    locationId: value('city-location'),
    width: Number(value('city-new-width')),
    height: Number(value('city-new-height')),
    paper: '#e9dfc8',
    roof: '#9c604c',
  };
  creating = true;
  try {
    if (!(await flushCity()) || !owned(w.token, g) || view?.header.id !== sourceId) return;
    await change({ kind: 'create', header });
    if (!owned(w.token, g)) return;
    el<HTMLDialogElement>('city-new-dialog').close();
    await openCity();
  } finally {
    if (owned(w.token, g)) creating = false;
  }
}
export function atlasCityMeasurement() {
  if (!view) return null;
  let selectedUnit = unit(),
    units = view.units;
  if (selectedUnit && dirty) {
    try {
      const changes = collectUnit(selectedUnit);
      units = view.units.map((u) => changes.find((c) => c.id === u.id) ?? u);
      selectedUnit = units.find((u) => u.id === selected);
    } catch {
      return null;
    }
  }
  return {
    cityId: view.header.id,
    tool: value('city-tool'),
    path: [...path],
    unit: selectedUnit,
    units,
    width: Number(value('city-draw-width')),
    size: Number(value('city-size')),
  };
}
export function atlasCityState() {
  return view && view.demographics !== null && (preview || path.length)
    ? {
        view: preview
          ? {
              ...view,
              units: [
                ...view.units.filter((u) => !preview!.replaceIds.includes(u.id)),
                ...preview.buildings,
              ],
            }
          : view,
        path,
      }
    : null;
}
export function atlasCityUndoPoint() {
  path.pop();
  render();
}
export async function atlasCityPoint(at: CityPoint) {
  if (!view || value('city-tool') === 'select') return;
  if (dirty && !(await saveInspector())) return;
  if (value('city-tool') === 'building') {
    const size = Number(value('city-size')),
      owner = workspace,
      source = view;
    const recipe = await chooseRoomGroup({
      version: 1,
      profile: value('city-use') as import('./room-group-generator').GroupProfile,
      width: size,
      depth: size,
      seed: crypto.randomUUID().slice(0, 8),
    });
    if (!recipe || recipe === 'empty' || workspace !== owner || view !== source) return;
    const u: CityUnit = {
      id: crypto.randomUUID(),
      kind: 'building',
      name: '',
      groupRecipe: recipe,
      protected: true,
      position: at,
      angle: 0,
      outline: [
        { x: -recipe.width / 2, y: -recipe.depth / 2 },
        { x: recipe.width / 2, y: -recipe.depth / 2 },
        { x: recipe.width / 2, y: recipe.depth / 2 },
        { x: -recipe.width / 2, y: recipe.depth / 2 },
      ],
      use: recipe.profile,
      notes: '',
      districtId: value('city-district') || null,
      ownerId: null,
      factionId: null,
      residentIds: [],
      workerIds: [],
      households: [],
      jobs: [],
      interior: true,
    };
    await change({ kind: 'change', upsert: [u], remove: [], label: 'Haus anlegen' });
    selected = u.id;
    people = null;
    render();
  } else {
    path.push(at);
    render();
  }
}
export function initCity(
  status: typeof tell,
  relationships: (id: string) => Promise<void> | void = () => {},
  profile: (id: string, current: () => boolean) => Promise<void> = async () => {},
  location: (id: string, current: () => boolean) => Promise<void> = async () => {},
) {
  tell = status;
  openRelationships = relationships;
  activity = new CityActivityBinder(
    () => {
      const u = unit();
      return workspace && view
        ? {
            workspace,
            cityId: view.header.id,
            revision: view.header.revision,
            unit: u?.kind === 'building' ? { id: u.id, name: u.name } : null,
          }
        : null;
    },
    async (site, current) => {
      if (!(await flushCity()) || !current()) return;
      await openCityReference(site.cityId, site.unitId);
    },
    profile,
    location,
  );
  el('city-new-open').onclick = () => el<HTMLDialogElement>('city-new-dialog').showModal();
  el('city-new-cancel').onclick = () => el<HTMLDialogElement>('city-new-dialog').close();
  el<HTMLFormElement>('city-new-form').onsubmit = (e) => {
    e.preventDefault();
    run(createCity);
  };
  el<HTMLSelectElement>('city-select').onchange = () =>
    run(async () => {
      const w = workspace,
        g = editorSession.generation,
        target = value('city-select'),
        intent = ++selectionRequest;
      if (!w || !(await flushCity()) || !owned(w.token, g) || intent !== selectionRequest) return;
      await readSelectedCity(target, w.token, g, ++readRequest);
    });
  el('city-refresh').onclick = () =>
    run(async () => {
      if (await flushCity()) await openCity();
    });
  el('city-finish').onclick = () => run(finish);
  el('city-cancel-path').onclick = () => {
    path = [];
    render();
  };
  let selectedTool = value('city-tool');
  el('city-tool').onchange = () => {
    if (path.length) {
      field('city-tool').value = selectedTool;
      tell('Stadtzug zuerst abschließen oder verwerfen.', true);
      return;
    }
    selectedTool = value('city-tool');
    run(async () => {
      const tool = value('city-tool');
      if (tool !== 'select' && view?.demographics === null) {
        const id = view.header.id;
        if (!(await flushCity())) return;
        await openCityReference(id);
        field('city-tool').value = tool;
      }
      path = [];
      preview = null;
      render();
    });
  };
  el('city-map').addEventListener('click', (e) =>
    run(async () => {
      const canvas = el<SVGSVGElement>('city-map'),
        event = e as MouseEvent,
        point = canvas.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const p = point.matrixTransform(canvas.getScreenCTM()!.inverse());
      await atlasCityPoint({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    }),
  );
  el('city-zoom').oninput = () =>
    run(async () => {
      if (await flushCity()) render();
    });
  el('city-map').addEventListener('keydown', (e) => {
    const k = e as KeyboardEvent;
    if (k.key === 'Enter') {
      k.preventDefault();
      run(finish);
    }
    if (k.key === 'Escape') {
      path = [];
      render();
    }
  });
  el('city-generate').onclick = () =>
    run(async () => {
      const w = workspace,
        g = editorSession.generation,
        source = view;
      if (!w || !source) return;
      const recipe: CityRecipe = {
        seed: value('city-seed'),
        density: Number(value('city-density')),
        size: Number(value('city-size')),
        reach: Number(value('city-reach')),
        districtId: value('city-district'),
        use: value('city-use'),
      };
      if (!(await flushCity()) || !owned(w.token, g) || view?.header.id !== source.header.id)
        return;
      if (!view.demographics)
        throw new Error('Für Bebauung zuerst Stadtwerkzeuge und Bewohner laden.');
      const basis = view as CityView,
        job = { token: w.token, epoch: g, cityId: basis.header.id, cancelled: false };
      preview = null;
      generationJob = job;
      el<HTMLButtonElement>('city-generate').disabled = true;
      const active = () =>
        generationJob === job &&
        !job.cancelled &&
        owned(job.token, job.epoch) &&
        view?.header.id === job.cityId;
      try {
        const result = await generateCity(
          basis,
          recipe,
          () => !active(),
          (n) => {
            if (active()) el('city-preview-summary').textContent = n + ' Häuser in Vorbereitung…';
          },
        );
        if (!active()) return;
        if (view!.header.revision !== result.baseRevision)
          throw new Error('Stadt verändert. Neue Vorschau erzeugen.');
        preview = result;
        render();
        if (!preview.buildings.length)
          tell(
            'Keine Häuser passen zu diesen Vorgaben. Fläche, Straßenabstand oder Hausgröße anpassen.',
            true,
          );
      } catch (error) {
        if (active()) tell((error as Error).message, true);
      } finally {
        if (generationJob === job) {
          generationJob = null;
          el<HTMLButtonElement>('city-generate').disabled = false;
        }
      }
    });
  for (const id of [
    'city-seed',
    'city-density',
    'city-size',
    'city-reach',
    'city-use',
    'city-district',
  ])
    el(id).onchange = () => {
      cancelGeneration();
      if (preview) {
        preview = null;
        render();
      }
    };
  el('city-cancel-preview').onclick = () => {
    cancelGeneration();
    preview = null;
    render();
  };
  el('city-preview-accept').onclick = () =>
    run(async () => {
      if (!preview || !view) return;
      if (preview.baseRevision !== view.header.revision)
        throw new Error('Stadt verändert. Neue Vorschau erzeugen.');
      await change({
        kind: 'change',
        upsert: preview.buildings,
        remove: preview.replaceIds,
        label: 'Bebauung übernehmen',
      });
    });
  for (const id of ['city-undo', 'city-redo'])
    el(id).onclick = () =>
      run(async () => {
        if (await flushCity()) {
          people = null;
          await change({ kind: id === 'city-undo' ? 'undo' : 'redo' });
        }
      });
  const schedulePeopleSearch = () => {
    peopleRequest++;
    if (peopleTimer) clearTimeout(peopleTimer);
    peopleTimer = null;
    if (people) {
      people.visible = [];
      people.total = null;
      drawPeople();
      el('city-people-status').textContent = 'World-NSCs werden gesucht…';
    }
    peopleTimer = setTimeout(() => {
      peopleTimer = null;
      run(refreshPeople);
    }, 250);
  };
  el<HTMLInputElement>('city-people-search').oninput = schedulePeopleSearch;
  el<HTMLSelectElement>('city-people-faction').onchange = schedulePeopleSearch;
  el('city-household-add').onclick = () => {
    if (!people) return;
    if (people.households.length >= 100) {
      tell('Höchstens 100 Haushalte je Haus.', true);
      return;
    }
    const used = new Set(people.households.flatMap((h) => h.memberIds)),
      member = [...people.residents].find((id) => !used.has(id));
    people.households.push({
      id: crypto.randomUUID(),
      name: 'Neuer Haushalt ' + (people.households.length + 1),
      memberIds: member ? [member] : [],
    });
    edited();
    drawHouseholds();
    drawPeopleStatus();
  };
  el('city-job-add').onclick = () => {
    if (!people) return;
    if (people.jobs.length >= 100) {
      tell('Höchstens 100 Berufe je Haus.', true);
      return;
    }
    const used = new Set(people.jobs.flatMap((j) => j.workerIds)),
      worker = [...people.workers].find((id) => !used.has(id));
    people.jobs.push({
      id: crypto.randomUUID(),
      name: 'Neuer Beruf ' + (people.jobs.length + 1),
      workerIds: worker ? [worker] : [],
    });
    edited();
    drawJobs();
    drawPeopleStatus();
  };
  el<HTMLFormElement>('city-unit-form').onsubmit = (e) => {
    e.preventDefault();
    run(saveInspector);
  };
  el('city-unit-form').addEventListener('input', (e) => {
    if (['city-people-search', 'city-people-faction'].includes((e.target as HTMLElement).id))
      return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () =>
        run(async () => {
          await flushCity();
        }),
      700,
    );
  });
  el('city-unit-reload').onclick = () => run(reloadInspector);
  el('city-delete').onclick = () =>
    run(async () => {
      if (!(await flushCity()) || !view || !selected) return;
      const u = unit();
      if (u?.kind === 'district' && view.units.some((b) => b.districtId === u.id))
        throw new Error(
          'Viertel enthält gebundene Häuser. Diese zuerst verschieben oder entfernen.',
        );
      if (u?.kind === 'building' && u.households?.length)
        throw new Error('Haus enthält Haushalte. Diese zuerst verschieben oder auflösen.');
      if (u?.kind === 'building' && u.jobs?.length)
        throw new Error('Haus enthält Berufe. Diese zuerst verschieben oder auflösen.');
      await change({
        kind: 'change',
        upsert: [],
        remove: [selected],
        removeGroups: true,
        label: 'Element entfernen',
      });
      selected = null;
      people = null;
      render();
    });
  el('city-paper').onchange = el('city-roof').onchange = () =>
    run(async () => {
      if (!view || !(await flushCity())) return;
      await change({
        kind: 'change',
        upsert: [],
        remove: [],
        header: { ...view.header, paper: value('city-paper'), roof: value('city-roof') },
        label: 'Kartendarstellung',
      });
    });
  for (const format of ['svg', 'json'] as const)
    el('city-export-' + format).onclick = () =>
      run(async () => {
        if (!workspace || !view || !(await flushCity())) return;
        unwrap(await window.campaign.exportCity(workspace.token, view.header.id, format));
        tell('Stadtplan exportiert.');
      });
}

editorSession.onDeactivate(() => {
  if (timer) clearTimeout(timer);
  timer = null;
});

editorSession.observeDraft(() => ({
  openInput: dirty || path.length > 0,
  retainedDraft: false,
  unresolvedCommand: false,
}));
