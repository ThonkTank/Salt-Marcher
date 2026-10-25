import { EditorSession } from '../shared/editor-session';
import { ScenePlaceBinder } from './scene-place-binder';
import { campaignLocalId } from '../../features/campaign/campaign-contracts';
import { worldNoteDocument } from '../../features/world/world-notes';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type {
  DeskRef,
  DeskContent,
  SceneDesk,
  SceneCreationInput,
  SceneCreationDraft,
} from './scene-desk-contracts';
import type {
  PreparationDraft,
  PreparationEdit,
  PreparationCommand,
} from '../campaign/preparation-contracts';
import type { LiveScene } from './live-contracts';
import { newLocation } from '../../features/location/location-schema';
import { showNarrative, flushNarrative } from './narrative-ui';
import { renderCreatureDetail } from '../catalog/creature-detail-ui';
import type { EncounterPlan } from '../catalog/encounter-contracts';
export const editorSession = new EditorSession();
const savingWork = editorSession.operation<Promise<boolean>>();
const applyingWork = editorSession.operation<Promise<boolean>>();
const creationSavingWork = editorSession.operation<Promise<boolean>>();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
let w: WorkspaceGeometry | null = null,
  scene: LiveScene | null = null,
  desk: SceneDesk | null = null,
  content: DeskContent | null = null,
  draft: PreparationDraft | null = null,
  writeId: string | null = null,
  dirty = false,
  key = '',
  request = 0,
  searchRequest = 0,
  next: number | null = null;
let placeBinder: ScenePlaceBinder | null = null,
  placeKey = '';
let searchPage: { kind: string; query: string } | null = null,
  searchBusy = false;
let timer: ReturnType<typeof setTimeout> | null = null,
  initialized = false;
type PlayerCues = {
  showNpc(id: string, current: () => boolean): Promise<boolean>;
  blank(): Promise<boolean>;
};
let playerCues: PlayerCues | undefined,
  playerCueIntent = 0;
let tell: (s: string, error?: boolean) => void,
  encounter: (p: EncounterPlan) => Promise<void>,
  creature: (id: string, count: number, grouped: boolean) => Promise<void>;
function button(text: string, action: () => Promise<unknown>) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = () => void action().catch((e) => tell(e.message, true));
  return b;
}
const editorOwner = () => {
  const epoch = editorSession.generation;
  return () => epoch === editorSession.generation;
};
const owns = (token: string, id: string) => w?.token === token && scene?.id === id;
export function initSceneDesk(
  status: typeof tell,
  prepare: typeof encounter,
  add: typeof creature,
  player?: PlayerCues,
) {
  tell = status;
  playerCues = player;
  encounter = prepare;
  creature = add;
  if (initialized) return;
  initialized = true;
  placeBinder = new ScenePlaceBinder(el('desk-place-material'), open, (ref, current) =>
    pin(ref, true, current),
  );
  el('desk-create-check').onclick = () => void checkCreation();
  el('desk-create-reload').onclick = () => {
    if (!creationBusy && !creationRead) void loadCreation();
  };
  el('desk-create-edit').onclick = () => {
    if (creationBusy || !creation || el('desk-create-edit').hidden) return;
    creation.command = null;
    creationVersion++;
    void keepCreation();
    el('desk-create-edit').hidden = true;
    el('desk-create-status').textContent = 'Eingabe prüfen · noch nicht angelegt.';
    creationControls();
  };
  el('desk-create-form').addEventListener('input', () => {
    if (creationBusy || creationRead || creation?.command) return;
    creation = { input: creationInput(), command: null, writeId: crypto.randomUUID() };
    creationVersion++;
    if (creationTimer) clearTimeout(creationTimer);
    creationTimer = setTimeout(() => {
      creationTimer = null;
      void keepCreation();
    }, 250);
    creationControls();
    el('desk-create-status').textContent = 'Eingabe wird gesichert…';
  });
  el('desk-new-kind').addEventListener('change', creationControls);
  el('desk-search-form').onsubmit = (e) => {
    e.preventDefault();
    void search(false);
  };
  el('desk-more').onclick = () => void search(true);
  el('desk-search').addEventListener('input', () => invalidateSearch(true));
  el('desk-search-kind').addEventListener('change', () => invalidateSearch(true));
  el('desk-refresh').onclick = () => void refresh();
  el('desk-create-form').onsubmit = (e) => {
    e.preventDefault();
    void create().catch((e) => tell(e.message, true));
  };
  el('desk-save').onclick = () => void flushSceneDesk();
  el('desk-reload').onclick = () => void reloadContent().catch((e) => tell(e.message, true));
}
export function sceneDeskContext(workspace: WorkspaceGeometry | null, current: LiveScene | null) {
  w = workspace;
  scene = current;
  const placeContext = [workspace?.token, current?.id, current?.locationId].join(':'),
    placeChanged = placeContext !== placeKey;
  if (placeChanged) {
    placeKey = placeContext;
    placeBinder?.reset();
  }
  const changed = (workspace?.token ?? '') + ':' + (current?.id ?? '');
  el('scene-desk').hidden = !workspace || !current;
  if (changed === key) {
    if (placeChanged || (desk && (desk.place?.ref.id ?? null) !== (current?.locationId ?? null)))
      void refresh();
    return;
  }
  key = changed;
  const creationLoad = loadCreation(),
    creationOwner = creationEpoch;
  editorSession.generation++;
  editorSession.input.version = 0;
  editorSession.input.retained = 0;
  savingWork.value = null;
  applyingWork.value = null;
  request++;
  invalidateSearch();
  if (timer) clearTimeout(timer);
  timer = null;
  content = null;
  draft = null;
  writeId = null;
  dirty = false;
  desk = null;
  el('desk-editor').hidden = true;
  el('desk-results').replaceChildren();
  el('desk-pins').replaceChildren();
  el('desk-search-status').textContent = '';
  if (workspace && current)
    void creationLoad.then(() => {
      if (creationOwner === creationEpoch) void refresh();
    });
}
export async function refreshSceneDeskPins(id: string) {
  if (scene?.id === id) await refresh(false);
}
async function refresh(openInitial = true) {
  if (!w || !scene) return;
  const token = w.token,
    id = scene.id,
    n = ++request;
  try {
    const result = unwrap(await window.campaign.sceneDesk(token, id));
    if (!owns(token, id) || n !== request) return;
    desk = result;
    drawPins();
    const place = result.place,
      location = scene?.locationId;
    if (place && !place.unavailable && place.ref.id === location) {
      placeBinder?.show(
        w!,
        location!,
        place.title,
        () => owns(token, id) && scene?.locationId === location,
      );
    } else placeBinder?.reset();
    if (!content && openInitial) {
      const initial = result.pins.find((p) => !p.unavailable) ?? result.place;
      if (initial && !initial.unavailable) await open(initial.ref);
    }
  } catch (e) {
    if (owns(token, id) && n === request) tell((e as Error).message, true);
  }
}
function drawPins() {
  const root = el('desk-pins');
  root.replaceChildren();
  const entries = desk
    ? [
        ...(desk.place ? [desk.place] : []),
        ...desk.pins.filter(
          (p) => !(desk!.place?.ref.kind === p.ref.kind && desk!.place.ref.id === p.ref.id),
        ),
      ]
    : [];
  for (const p of entries) {
    const row = document.createElement('div');
    row.className = 'toolbar';
    const openButton = button(p.label + ' · ' + p.title, () => open(p.ref));
    openButton.disabled = !!p.unavailable;
    row.append(openButton);
    if (desk!.pins.some((r) => r.ref.kind === p.ref.kind && r.ref.id === p.ref.id))
      row.append(button('Vom Szenentisch nehmen', () => pin(p.ref, false)));
    root.append(row);
  }
  if (!entries.length)
    root.textContent =
      'Noch nichts angeheftet. Suche nach Kampagnenwissen oder lege einen Eintrag direkt hier an.';
}
async function pin(ref: DeskRef, on: boolean, stillCurrent: () => boolean = () => true) {
  if (!w || !scene || !desk) return;
  const current = editorOwner(),
    token = w.token,
    id = scene.id,
    revision = desk.revision;
  if (!(await flushSceneDesk()) || !current() || !stillCurrent()) return;
  const result = unwrap(await window.campaign.pinSceneDesk(token, id, revision, ref, on));
  if (!current()) return;
  desk = result;
  drawPins();
  if (on && stillCurrent()) await open(ref, stillCurrent);
}
function invalidateSearch(changed = false) {
  searchRequest++;
  searchPage = null;
  searchBusy = false;
  next = null;
  el('desk-results').replaceChildren();
  el('desk-more').hidden = true;
  el<HTMLButtonElement>('desk-more').disabled = false;
  el('desk-search-status').textContent = changed
    ? 'Suche geändert · mit Suchen oder Enter neue Treffer laden.'
    : '';
}
async function search(more: boolean) {
  if (!w || !scene) return;
  const kind = el<HTMLSelectElement>('desk-search-kind').value,
    query = el<HTMLInputElement>('desk-search').value;
  if (
    more &&
    (searchBusy || next === null || searchPage?.kind !== kind || searchPage.query !== query)
  )
    return;
  const offset = more ? next! : 0;
  if (!more) invalidateSearch();
  const token = w.token,
    id = scene.id,
    n = ++searchRequest;
  const current = () => owns(token, id) && n === searchRequest;
  searchBusy = true;
  el<HTMLButtonElement>('desk-more').disabled = true;
  el('desk-search-status').textContent = 'Suche läuft…';
  try {
    const r = unwrap(await window.campaign.searchDesk(token, kind as 'world', query, offset));
    if (!current()) return;
    for (const entry of r.entries) {
      const row = document.createElement('div');
      row.className = 'toolbar';
      row.append(
        button(entry.label + ' · ' + entry.title, () => open(entry.ref)),
        button('An Szene heften', () => pin(entry.ref, true)),
      );
      if (entry.preview && 'label' in entry.preview) {
        const preview = document.createElement('p');
        preview.className = 'desk-search-preview';
        preview.textContent = entry.preview.label + ' · ' + entry.preview.text;
        row.append(preview);
      }
      el('desk-results').append(row);
    }
    searchPage = { kind, query };
    next = r.next;
    el('desk-more').hidden = next === null;
    const count = el('desk-results').childElementCount;
    el('desk-search-status').textContent = count
      ? `${count} Treffer geladen · Titel und Notizen durchsucht.`
      : 'Keine passenden Inhalte.';
    if (r.notice) el('desk-search-status').textContent += ' · ' + r.notice;
  } catch (e) {
    if (!current()) return;
    el('desk-search-status').textContent =
      'Suche fehlgeschlagen · bitte erneut suchen. ' + (e as Error).message;
    tell((e as Error).message, true);
  } finally {
    if (current()) {
      searchBusy = false;
      el<HTMLButtonElement>('desk-more').disabled = false;
    }
  }
}
async function open(ref: DeskRef, stillCurrent: () => boolean = () => true) {
  if (!w || !scene) return;
  const current = editorOwner(),
    token = w.token,
    id = scene.id,
    n = ++request;
  if (!(await flushSceneDesk()) || !current() || n !== request || !stillCurrent()) return;
  const readVersion = editorSession.input.version;
  const read = await window.campaign.deskContent(token, ref);
  if (!current() || !owns(token, id) || n !== request || !stillCurrent()) return;
  const c = unwrap(read);
  let retained: PreparationDraft | null = null;
  if (c.note || c.location) {
    const read = await window.campaign.preparationDraft(
      token,
      c.note ? 'note' : 'location',
      ref.id,
    );
    if (!current() || n !== request) return;
    retained = unwrap(read);
  }
  if (!owns(token, id) || n !== request || !stillCurrent()) return;
  if (editorSession.input.version !== readVersion) return;
  editorSession.generation++;
  editorSession.input.version = 0;
  editorSession.input.retained = 0;
  content = c;
  draft = retained;
  writeId = retained?.writeId ?? null;
  dirty = !!retained;
  editorSession.input.retained = editorSession.input.version;
  drawEditor();
  await drawNarrative();
}
function edit(): PreparationEdit | null {
  if (!content) return null;
  if (draft) return draft.change;
  if (content.note)
    return {
      kind: 'note',
      note: structuredClone(content.note),
      expectedRevision: content.revision,
    };
  if (content.location)
    return {
      kind: 'location',
      document: structuredClone(content.location),
      expectedRevision: content.revision,
    };
  return null;
}
function mark() {
  dirty = true;
  editorSession.input.version++;
  if (timer) clearTimeout(timer);
  const current = editorOwner();
  timer = setTimeout(() => {
    if (current()) void keep();
  }, 250);
}
function drawPlayerActions(c: DeskContent) {
  const current = editorOwner(),
    npc = c.note?.kind === 'npc' && !c.unavailable ? c.note.id : null;
  el('desk-player-actions').hidden = !npc || !playerCues;
  el('desk-player-status').textContent = '';
  const show = el<HTMLButtonElement>('desk-player-show');
  show.disabled = false;
  show.onclick = () => {
    if (!npc || !playerCues || !current()) return;
    const intent = ++playerCueIntent,
      owns = () => current() && intent === playerCueIntent;
    show.disabled = true;
    void playerCues
      .showNpc(npc, owns)
      .then((ok) => {
        if (owns())
          el('desk-player-status').textContent = ok
            ? 'Porträt auf der Spieleranzeige geöffnet.'
            : 'Porträt nicht freigegeben. Meldung beachten.';
      })
      .catch((error) => {
        if (owns()) {
          el('desk-player-status').textContent = (error as Error).message;
          tell((error as Error).message, true);
        }
      })
      .finally(() => {
        if (owns()) show.disabled = false;
      });
  };
  // Blanking reduces disclosure immediately, including while a note save is pending.
  el('desk-player-blank').onclick = () => {
    if (!current() || !playerCues) return;
    const intent = ++playerCueIntent,
      owns = () => current() && intent === playerCueIntent;
    show.disabled = false;
    void playerCues
      .blank()
      .then((ok) => {
        if (owns())
          el('desk-player-status').textContent = ok
            ? 'Spieleranzeige geleert.'
            : 'Anzeige konnte nicht geleert werden. Meldung beachten.';
      })
      .catch((error) => {
        if (owns()) tell((error as Error).message, true);
      });
  };
}
function drawEditor() {
  const c = content!,
    root = el('desk-fields');
  root.replaceChildren();
  el('desk-editor').hidden = false;
  el('desk-title').textContent = c.label + ' · ' + c.title;
  el('desk-note-status').textContent = draft ? 'Gesicherte Eingabe wieder geöffnet.' : '';
  drawPlayerActions(c);
  const change = edit();
  const editing = el<HTMLDetailsElement>('desk-editing'),
    preview = el('desk-note-preview');
  editing.open = !c.note || !!draft;
  el('desk-edit-summary').hidden = !c.note;
  const showPreview = () => {
    preview.hidden = !c.note || editing.open;
    preview.replaceChildren();
    if (preview.hidden) return;
    const note = change?.kind === 'note' ? change.note : c.note!;
    el('desk-title').textContent = c.label + ' · ' + note.title;
    for (const [title, text] of [
      ['Zum Vorlesen', note.readAloud],
      ['GM-Notizen', note.gmNotes],
    ])
      if (text?.trim()) {
        const heading = document.createElement('h4'),
          p = document.createElement('p');
        heading.textContent = title!;
        p.textContent = text!;
        preview.append(heading, p);
      }
    if (!preview.children.length) preview.textContent = 'Noch keine Notizen.';
    if (dirty) {
      const hint = document.createElement('small');
      hint.textContent = 'Vorschau der Eingabe · noch nicht übernommen.';
      preview.append(hint);
    }
  };
  editing.ontoggle = showPreview;
  showPreview();
  if (change) {
    draft = {
      version: 1,
      writeId: writeId ?? crypto.randomUUID(),
      change,
      failedCommand: null,
    };
    const title = document.createElement('input'),
      label = document.createElement('label');
    label.textContent = c.note ? 'Titel' : 'Name';
    title.setAttribute('aria-label', 'Szenentisch-Titel');
    title.value =
      change.kind === 'note'
        ? change.note.title
        : change.kind === 'location'
          ? change.document.name
          : '';
    title.disabled = !!c.unavailable;
    title.oninput = () => {
      if (change.kind === 'note') change.note = { ...change.note, title: title.value };
      if (change.kind === 'location') change.document = { ...change.document, name: title.value };
      mark();
    };
    label.append(title);
    root.append(label);
    const field = (name: string, value: string, set: (v: string) => void) => {
      const label = document.createElement('label'),
        t = document.createElement('textarea');
      label.textContent = name;
      t.setAttribute('aria-label', name);
      t.rows = 5;
      t.value = value;
      t.disabled = !!c.unavailable;
      t.oninput = () => {
        set(t.value);
        mark();
      };
      label.append(t);
      root.append(label);
    };
    if (change.kind === 'note') {
      field('Zum Vorlesen', change.note.readAloud, (v) => {
        change.note = { ...change.note, readAloud: v };
      });
      field('GM-Notizen', change.note.gmNotes, (v) => {
        change.note = { ...change.note, gmNotes: v };
      });
      for (const r of change.note.relations) {
        const p = document.createElement('p');
        p.textContent = 'Beziehung: ' + r.label;
        root.append(
          p,
          button('Verknüpften Inhalt öffnen', () => open({ kind: 'note', id: r.targetId })),
        );
      }
    }
    if (change.kind === 'location')
      for (const [index, s] of change.document.sections.entries())
        field(s.title, s.markdown, (v) => {
          if (change.kind === 'location')
            change.document = {
              ...change.document,
              sections: change.document.sections.map((s, i) =>
                i === index ? { ...s, markdown: v } : s,
              ),
            };
        });
  } else if (c.creature) {
    renderCreatureDetail(root, c.creature);
    root.append(
      button('Eine Kreatur zur aktuellen Initiative hinzufügen', () =>
        creature(c.ref.id, 1, false),
      ),
    );
  } else if (c.encounter) {
    const p = document.createElement('p');
    p.textContent = c.encounter.notes;
    root.append(
      p,
      button('Diesen Encounter vorbereiten', () => encounter(c.encounter!)),
    );
  } else if (c.item) {
    const p = document.createElement('p');
    p.textContent = c.item.description + '\n' + c.item.properties.join(' · ');
    root.append(p);
  }
  el('desk-save').hidden = !change;
  el('desk-reload').hidden = !change;
}
async function drawNarrative() {
  await showNarrative(
    w,
    content?.note ?? null,
    !!content?.unavailable,
    () => flushSceneDesk(false),
    tell,
    el('desk-narrative'),
  );
}
async function keep(): Promise<boolean> {
  const current = editorOwner();
  if (savingWork.value) {
    if (!(await savingWork.value) || !current()) return false;
    return dirty && editorSession.input.retained !== editorSession.input.version ? keep() : true;
  }
  if (!dirty || editorSession.input.retained === editorSession.input.version || !draft || !w)
    return true;
  const token = w.token,
    n = editorSession.input.version,
    value = structuredClone(draft);
  value.writeId = crypto.randomUUID();
  const run = (async () => {
    try {
      unwrap(await window.campaign.keepDeskDraft(token, value, writeId));
      if (!current()) return false;
      writeId = value.writeId;
      editorSession.input.retained = n;
      el('desk-note-status').textContent = 'Eingabe gesichert.';
      return true;
    } catch (e) {
      if (current()) tell((e as Error).message, true);
      return false;
    }
  })();
  savingWork.value = run;
  const ok = await run;
  if (savingWork.value === run) savingWork.value = null;
  return (
    current() &&
    (ok && editorSession.input.retained !== editorSession.input.version ? await keep() : ok)
  );
}

export async function flushSceneDesk(narrative = true): Promise<boolean> {
  const current = editorOwner();
  if (applyingWork.value) {
    const ok = await applyingWork.value;
    return ok && current() ? flushSceneDesk(narrative) : false;
  }
  if (!(await keepCreation()) || !current()) return false;
  if ((narrative && !(await flushNarrative())) || !current()) return false;
  if (timer) clearTimeout(timer);
  if (!(await keep()) || !current()) return false;
  if (!dirty || !draft || !w || !content) return true;
  const run = applyContent();
  applyingWork.value = run;
  return await run;
}
async function applyContent(): Promise<boolean> {
  const current = editorOwner();
  if (!draft || !w || !content) return true;
  const change = structuredClone(draft.change),
    valid =
      change.kind === 'note'
        ? change.note.title.trim()
        : change.kind === 'location'
          ? change.document.name.trim()
          : true;
  if (!valid) {
    el('desk-note-status').textContent =
      'Eingabe gesichert · Titel vor Übernahme vervollständigen.';
    return true;
  }
  const token = w.token,
    c = content,
    n = editorSession.input.version;
  try {
    const fresh = unwrap(
      await window.campaign.changePreparationContent({
        commandId: crypto.randomUUID(),
        campaignId: w.campaign.id,
        token,
        draftWriteId: writeId ?? undefined,
        change,
      }),
    );
    if (!current() || content !== c) return false;
    if (fresh.revision !== c.revision + 1)
      throw new Error('Inhalt nach Speicherung erneut geändert. Gesicherte Eingabe zuerst prüfen.');
    content = fresh;
    writeId = null;
    if (n === editorSession.input.version) {
      dirty = false;
      draft = null;
      drawEditor();
      // Status writes must refer to the note version now shown by the desk.
      // showNarrative retains older drafts for explicit review.
      await drawNarrative();
    } else if (draft) {
      draft.change.expectedRevision = fresh.revision;
      if (draft.change.kind === 'note')
        draft.change.note = { ...draft.change.note, revision: fresh.revision };
      editorSession.input.retained = -1;
      await keep();
    }
    if (desk) {
      desk.pins = desk.pins.map((p) =>
        p.ref.id === c.ref.id && p.ref.kind === c.ref.kind ? { ...p, title: fresh.title } : p,
      );
      drawPins();
    }
    return true;
  } catch (e) {
    if (current()) tell((e as Error).message, true);
    return false;
  }
}
async function reloadContent() {
  if (!w || !content) return;
  const current = editorOwner(),
    token = w.token,
    c = content;
  if (!(await keep()) || !current()) return;
  const n = editorSession.input.version;
  if (writeId)
    unwrap(
      await window.campaign.discardPreparationDraft(
        token,
        c.note ? 'note' : 'location',
        c.ref.id,
        writeId,
      ),
    );
  if (!current()) return;
  writeId = null;
  if (n !== editorSession.input.version) {
    editorSession.input.retained = -1;
    await keep();
    return;
  }
  dirty = false;
  draft = null;
  await open(c.ref);
}

let creation: SceneCreationDraft | null = null,
  creationBusy = false,
  creationRead = false,
  creationEpoch = 0,
  creationStored: string | null = null,
  creationVersion = 0,
  creationSaved = 0;
let creationTimer: ReturnType<typeof setTimeout> | null = null;
function creationInput(): SceneCreationInput {
  return {
    kind: el<HTMLSelectElement>('desk-new-kind').value as SceneCreationInput['kind'],
    name: el<HTMLInputElement>('desk-new-title').value,
    notes: el<HTMLTextAreaElement>('desk-new-notes').value,
    pin: el<HTMLInputElement>('desk-new-pin').checked,
    contributors: el<HTMLInputElement>('desk-new-contributors').checked,
  };
}
function creationControls() {
  const pending = !!creation?.command;
  for (const id of [
    'desk-new-kind',
    'desk-new-title',
    'desk-new-notes',
    'desk-new-pin',
    'desk-new-contributors',
    'desk-create-submit',
  ])
    el<HTMLInputElement>(id).disabled = pending || creationBusy || creationRead;
  el<HTMLButtonElement>('desk-create-reload').disabled = creationBusy || creationRead;
  el('desk-create-check').hidden = !pending;
  el<HTMLButtonElement>('desk-create-check').disabled = creationBusy || creationRead;
  el('desk-new-contributors-label').hidden =
    el<HTMLSelectElement>('desk-new-kind').value !== 'quest';
}
function drawCreation() {
  const input = creation?.input ?? {
    kind: 'npc',
    name: '',
    notes: '',
    pin: true,
    contributors: false,
  };
  el<HTMLSelectElement>('desk-new-kind').value = input.kind;
  el<HTMLInputElement>('desk-new-title').value = input.name;
  el<HTMLTextAreaElement>('desk-new-notes').value = input.notes;
  el<HTMLInputElement>('desk-new-pin').checked = input.pin;
  el<HTMLInputElement>('desk-new-contributors').checked = input.contributors;
  creationControls();
}
let creationLoading: Promise<void> | null = null;
async function loadCreation() {
  const loading = readCreation();
  creationLoading = loading;
  try {
    await loading;
  } finally {
    if (creationLoading === loading) creationLoading = null;
  }
}
async function readCreation() {
  const epoch = ++creationEpoch,
    owner = w,
    source = scene;
  creationBusy = false;
  creation = null;
  creationRead = !!owner && !!source;
  creationStored = null;
  creationVersion = creationSaved = 0;
  creationSavingWork.value = null;
  el('desk-create-reload').hidden = true;
  if (creationTimer) clearTimeout(creationTimer);
  creationTimer = null;
  el('desk-create-edit').hidden = true;
  drawCreation();
  el('desk-create-status').textContent = creationRead ? 'Schnellanlage-Eingabe wird gelesen…' : '';
  if (!owner || !source) return;
  try {
    const d = unwrap(await window.campaign.sceneCreationDraft(owner.token, source.id));
    if (epoch !== creationEpoch) return;
    creation = d;
    creationStored = d?.writeId ?? null;
    drawCreation();
    el('desk-create-status').textContent = d?.command
      ? 'Ausgang offen · Originalauftrag prüfen.'
      : d
        ? 'Eingabe wieder geöffnet · noch nicht angelegt.'
        : '';
  } catch (e) {
    if (epoch === creationEpoch) {
      el('desk-create-reload').hidden = false;
      el('desk-create-status').textContent = 'Schnellanlage nicht lesbar. ' + (e as Error).message;
      tell(el('desk-create-status').textContent!, true);
    }
  } finally {
    if (epoch === creationEpoch) {
      creationRead = false;
      creationControls();
    }
  }
}
async function keepCreation(): Promise<boolean> {
  if (creationTimer) clearTimeout(creationTimer);
  creationTimer = null;
  const epoch = creationEpoch;
  if (creationRead) {
    const loading = creationLoading;
    if (!loading) return false;
    await loading;
    if (epoch !== creationEpoch || creationRead) return false;
  }
  if (!w || !scene || creationVersion === creationSaved) return true;
  if (creationSavingWork.value) {
    if (!(await creationSavingWork.value) || epoch !== creationEpoch) return false;
    return keepCreation();
  }
  const owner = w,
    source = scene,
    version = creationVersion,
    value = creation ? { ...structuredClone(creation), writeId: crypto.randomUUID() } : null,
    expected = creationStored;
  const task = Promise.resolve().then(async () => {
    try {
      unwrap(await window.campaign.keepSceneCreationDraft(owner.token, source.id, value, expected));
      if (epoch !== creationEpoch) return false;
      creationStored = value?.writeId ?? null;
      if (creation) creation.writeId = value!.writeId;
      creationSaved = version;
      if (!creation?.command)
        el('desk-create-status').textContent = 'Eingabe gesichert · noch nicht angelegt.';
      return true;
    } catch (e) {
      if (epoch === creationEpoch) {
        el('desk-create-reload').hidden = false;
        el('desk-create-status').textContent = 'Eingabe nicht gesichert. ' + (e as Error).message;
        tell(el('desk-create-status').textContent!, true);
      }
      return false;
    }
  });
  creationSavingWork.value = task;
  return await task;
}
async function finishCreation(
  command: PreparationCommand,
  input: SceneCreationInput,
  epoch: number,
) {
  if (epoch !== creationEpoch || !w || !scene) return;
  unwrap(await window.campaign.keepSceneCreationDraft(w.token, scene.id, null, creationStored));
  if (epoch !== creationEpoch) return;
  creation = null;
  creationStored = null;
  creationSaved = ++creationVersion;
  if (el<HTMLInputElement>('desk-new-title').value === input.name)
    el<HTMLInputElement>('desk-new-title').value = '';
  if (el<HTMLTextAreaElement>('desk-new-notes').value === input.notes)
    el<HTMLTextAreaElement>('desk-new-notes').value = '';
  el<HTMLInputElement>('desk-new-pin').checked = true;
  el<HTMLInputElement>('desk-new-contributors').checked = false;
  const message = input.pin
    ? 'Kampagneninhalt angelegt und an diese Szene geheftet.'
    : 'Kampagneninhalt angelegt · ohne Szenenbindung.';
  el('desk-create-status').textContent = message;
  el('desk-create-edit').hidden = true;
  tell(message);
  creationControls();
  await refresh(false);
  if (epoch !== creationEpoch) return;
  await open(
    command.change.kind === 'location'
      ? { kind: 'location', id: command.change.document.id }
      : {
          kind: 'note',
          id: (command.change as Extract<PreparationEdit, { kind: 'note' }>).note.id,
        },
  );
}
async function checkCreation() {
  const owner = creation,
    command = owner?.command,
    epoch = creationEpoch,
    token = w?.token;
  if (!command || !owner || !token || creationBusy) return;
  creationBusy = true;
  creationControls();
  try {
    const r = unwrap(await window.campaign.reconcilePreparationContent(command, token));
    if (epoch !== creationEpoch) return;
    if (r.outcome === 'applied') await finishCreation(command, owner.input, epoch);
    else if (r.outcome === 'not-applied') {
      el('desk-create-status').textContent =
        'Originalauftrag wurde nicht ausgeführt. Eingabe weiterbearbeiten und bewusst erneut anlegen.';
      el('desk-create-edit').hidden = false;
    } else
      el('desk-create-status').textContent =
        'Identität inzwischen verändert. Der Originalauftrag bleibt gesichert; Inhalt über die Suche prüfen.';
  } catch (e) {
    if (epoch === creationEpoch)
      el('desk-create-status').textContent = 'Auftrag noch nicht prüfbar. ' + (e as Error).message;
  } finally {
    if (epoch === creationEpoch) {
      creationBusy = false;
      creationControls();
    }
  }
}
async function create() {
  if (!w || !scene || creationBusy || creationRead || creation?.command) return;
  const epoch = creationEpoch,
    owner = w,
    input = creationInput();
  if (!input.name.trim()) throw new Error('Titel oder Name fehlt.');
  creation = { input, command: null, writeId: crypto.randomUUID() };
  creationVersion++;
  creationBusy = true;
  creationControls();
  try {
    if (!(await flushSceneDesk()) || epoch !== creationEpoch || !desk || !scene) return;
    const source = scene,
      newId = crypto.randomUUID();
    let change: PreparationEdit;
    if (input.kind === 'location') {
      const base = newLocation(newId, input.name, 'poi', [
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]);
      change = {
        kind: 'location',
        expectedRevision: null,
        document: {
          ...base,
          sections: base.sections.map((s, i) => (i === 0 ? { ...s, markdown: input.notes } : s)),
        },
      };
    } else
      change = {
        kind: 'note',
        expectedRevision: null,
        note: worldNoteDocument({
          version: 1,
          id: campaignLocalId(newId),
          revision: 1,
          kind: input.kind,
          title: input.name,
          readAloud: '',
          gmNotes: input.notes,
          relations: [],
          creatureId: null,
          deleted: false,
        }),
      };
    const command: PreparationCommand = {
      commandId: crypto.randomUUID(),
      token: owner.token,
      campaignId: owner.campaign.id,
      change,
      sceneCreation: {
        sceneId: source.id,
        expectedSceneRevision: source.revision,
        expectedMembershipRevision: source.membershipRevision,
        expectedDeskRevision: desk.revision,
        pin: input.pin,
        contributors: input.kind === 'quest' && input.contributors ? [...source.members] : [],
      },
    };
    creation = { input, command, writeId: crypto.randomUUID() };
    creationVersion++;
    if (!(await keepCreation()) || epoch !== creationEpoch) return;
    el('desk-create-status').textContent = 'Inhalt wird angelegt…';
    unwrap(await window.campaign.changePreparationContent(command));
    if (epoch === creationEpoch) await finishCreation(command, input, epoch);
  } catch (e) {
    if (epoch === creationEpoch) {
      el('desk-create-status').textContent = creation?.command
        ? 'Ausgang prüfen · keine erneute Anlage senden. ' + (e as Error).message
        : 'Anlage nicht abgeschlossen. ' + (e as Error).message;
      tell(el('desk-create-status').textContent!, true);
    }
  } finally {
    if (epoch === creationEpoch) {
      creationBusy = false;
      creationControls();
    }
  }
}

editorSession.onDeactivate(() => {
  if (timer) clearTimeout(timer);
  timer = null;
});

editorSession.observeDraft(() => ({
  openInput: dirty,
  retainedDraft: !!draft && !!writeId,
  unresolvedCommand: !!draft?.failedCommand,
}));
