import type { WorkspaceGeometry, Result } from './contracts';
import type { DeskEntry } from './scene-desk-contracts';
import type { SceneRuleCommand, SceneRules } from './rule-reference-contracts';
import type { SceneCheck, SceneCheckCommand, SceneChecks } from './scene-check-contracts';
import { formatInstant } from './live-contracts';

type CheckAction = Extract<SceneCheckCommand['action'], { kind: 'roll' }>;
type FormulaAction = Extract<SceneCheckCommand['action'], { kind: 'formula' }>;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
let workspace: WorkspaceGeometry | null = null,
  sceneId: string | null = null,
  view: SceneRules | null = null,
  checks: SceneChecks | null = null,
  generation = 0,
  ruleReadRequest = 0,
  checkReadRequest = 0,
  searchRequest = 0,
  busy = false,
  searchTimer: ReturnType<typeof setTimeout> | null = null,
  tell: (text: string, error?: boolean) => void;

function ensure() {
  if (document.getElementById('live-rules-panel')) return;
  const section = document.createElement('section');
  section.id = 'live-rules-panel';
  section.innerHTML =
    '<div class="toolbar"><h3>Regeln und Proben am Tisch</h3><button id="live-rule-lookup-open" type="button">Regel nachschlagen…</button><button id="live-rules-refresh" type="button">Aktualisieren</button></div><div id="live-rule-pins"></div><form id="live-check-form"><h4>Schnelle d20-Probe</h4><label>Bezeichnung<input id="live-check-label" maxlength="1000" required placeholder="Wahrnehmung, Rettungswurf …"></label><div class="live-check-fields"><label>Regelbezug<select id="live-check-rule"><option value="">Freie Probe</option></select></label><label>Wurfart<select id="live-check-mode"><option value="normal">Normal</option><option value="advantage">Vorteil</option><option value="disadvantage">Nachteil</option></select></label><label>Modifikator<input id="live-check-modifier" type="number" min="-1000" max="1000" step="1" value="0" required></label><label>SG (optional)<input id="live-check-dc" type="number" min="-1000" max="1000" step="1"></label></div><button type="submit">Würfeln und protokollieren</button></form><p id="live-check-latest" role="status" aria-live="polite"></p><div id="live-check-history"></div>';
  const lookup = document.createElement('dialog');
  lookup.id = 'live-rule-lookup';
  lookup.setAttribute('aria-labelledby', 'live-rule-lookup-title');
  lookup.innerHTML =
    '<div class="toolbar"><h2 id="live-rule-lookup-title">Regel für diese Gruppe nachschlagen</h2><button id="live-rule-lookup-close" type="button">Zurück zur Gruppe</button></div><label>Regelreferenzen durchsuchen<input id="live-rule-search" type="search" placeholder="Aktion, Zustand, Hausregel …"></label><div id="live-rule-results" class="selection-list"></div>';
  section.append(lookup);
  el('scene-preparation-panel').before(section);
  el('live-rule-lookup-open').onclick = () => {
    el<HTMLDialogElement>('live-rule-lookup').showModal();
    el<HTMLInputElement>('live-rule-search').focus();
  };
  el('live-rule-lookup-close').onclick = () => el<HTMLDialogElement>('live-rule-lookup').close();
  el('live-rules-refresh').onclick = () => void refreshRuleReferences(sceneId);
  el('live-rule-search').oninput = () => {
    clearSearch('Suche geändert · passende Regeln werden gesucht…');
    searchTimer = setTimeout(() => {
      searchTimer = null;
      void search();
    }, 180);
  };
  el<HTMLSelectElement>('live-check-rule').onchange = () => {
    const pin = view?.pins.find((p) => p.noteId === el<HTMLSelectElement>('live-check-rule').value);
    if (pin && !el<HTMLInputElement>('live-check-label').value.trim())
      el<HTMLInputElement>('live-check-label').value = pin.title;
  };
  el<HTMLFormElement>('live-check-form').onsubmit = (event) => {
    event.preventDefault();
    void roll();
  };
}
function clearSearch(text = '') {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  searchRequest++;
  const root = el('live-rule-results');
  root.replaceChildren();
  if (text) message(root, text);
}
function message(root: HTMLElement, text: string, error = false) {
  const p = document.createElement('p');
  p.className = 'caption';
  p.textContent = text;
  if (error) p.setAttribute('role', 'alert');
  root.replaceChildren(p);
}
function button(text: string, click: () => void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = click;
  return b;
}
type Owner = { token: string; campaignId: string; sceneId: string; generation: number };
function owner(): Owner | null {
  return workspace && sceneId
    ? { token: workspace.token, campaignId: workspace.campaign.id, sceneId, generation }
    : null;
}
function current(o: Owner) {
  return (
    o.generation === generation &&
    o.token === workspace?.token &&
    o.campaignId === workspace?.campaign.id &&
    o.sceneId === sceneId
  );
}
function lock() {
  const panel = el('live-rules-panel');
  panel.inert = busy;
  for (const button of panel.querySelectorAll<HTMLButtonElement>('button')) button.disabled = busy;
  if (busy) panel.setAttribute('aria-busy', 'true');
  else panel.removeAttribute('aria-busy');
  for (const button of el('live-rules-panel').querySelectorAll<HTMLButtonElement>(
    '#live-rule-pins button,#live-rule-results button',
  ))
    button.disabled = busy || !view;
  el<HTMLButtonElement>('live-rule-lookup-open').disabled = busy || !view;
  el<HTMLButtonElement>('live-check-form').querySelector<HTMLButtonElement>('button')!.disabled =
    busy || !checks;
}
function accept(next: SceneRules, o: Owner) {
  if (next.sceneId !== o.sceneId) throw new Error('Regelantwort gehört zu einer anderen Scene.');
  if (
    !Number.isSafeInteger(next.revision) ||
    next.revision < 0 ||
    !Array.isArray(next.pins) ||
    next.pins.length > 50
  )
    throw new Error('Regelantwort hat einen ungültigen Stand.');
  if (view?.sceneId === next.sceneId && view.revision > next.revision) return;
  view = next;
  renderPins();
  renderCheckOptions();
  lock();
}
async function command(action: SceneRuleCommand['action']) {
  const o = owner(),
    basis = view;
  if (!o || !basis || busy) return;
  busy = true;
  ruleReadRequest++;
  lock();
  try {
    const result = await window.campaign.executeSceneRule({
      commandId: crypto.randomUUID(),
      campaignId: o.campaignId,
      token: o.token,
      sceneId: o.sceneId,
      expectedRevision: basis.revision,
      action,
    });
    if (!current(o)) return;
    ruleReadRequest++;
    accept(unwrap(result), o);
    await search();
    if (current(o)) tell('Regelreferenzen der Gruppe gespeichert.');
    return true;
  } catch (error) {
    if (current(o)) tell((error as Error).message, true);
    return false;
  } finally {
    if (current(o)) {
      busy = false;
      lock();
    }
  }
}
function renderPins() {
  const o = owner(),
    root = el('live-rule-pins');
  root.replaceChildren();
  if (!view?.pins.length) {
    const p = document.createElement('p');
    p.className = 'caption';
    p.textContent = 'Noch keine Regel für diese Gruppe angeheftet.';
    root.append(p);
    return;
  }
  for (const pin of view.pins) {
    const card = document.createElement('article'),
      title = document.createElement('h4'),
      status = document.createElement('p'),
      publicText = document.createElement('pre'),
      details = document.createElement('details'),
      summary = document.createElement('summary'),
      gm = document.createElement('pre'),
      actions = document.createElement('div');
    title.textContent = pin.title;
    status.className = 'caption';
    status.textContent = pin.unavailable
      ? 'Quelle nicht mehr verfügbar – eingefrorener Stand bleibt lesbar.'
      : pin.stale
        ? 'Quelle geändert – eingefrorener Stand bleibt aktiv.'
        : 'Quelle Revision ' + pin.sourceRevision;
    publicText.textContent = pin.readAloud;
    summary.textContent = 'GM-Details';
    gm.textContent = pin.gmNotes;
    details.append(summary, gm);
    actions.className = 'toolbar';
    if (pin.stale && !pin.unavailable)
      actions.append(
        button(
          'Aus Quelle aktualisieren',
          () =>
            void command({
              kind: 'refresh',
              noteId: pin.noteId,
              expectedSourceRevision: pin.currentRevision!,
            }),
        ),
      );
    const prepare = button('Probe vorbereiten', () => {
      if (!o || !current(o) || busy || !view?.pins.some((p) => p.noteId === pin.noteId)) return;
      el<HTMLSelectElement>('live-check-rule').value = pin.noteId;
      const label = el<HTMLInputElement>('live-check-label');
      if (!label.value.trim()) label.value = pin.title;
      label.focus();
      label.scrollIntoView({ block: 'center' });
    });
    prepare.dataset.ruleId = pin.noteId;
    actions.append(prepare);
    actions.append(
      button('Von Gruppe lösen', () => void command({ kind: 'unpin', noteId: pin.noteId })),
    );
    card.append(title, status, publicText, details, actions);
    root.append(card);
  }
}
/** Search and reading share the canonical note reader; inspecting a rule does not pin it. */
async function search() {
  const o = owner(),
    r = ++searchRequest,
    query = el<HTMLInputElement>('live-rule-search').value;
  if (!o || !view) return;
  const currentSearch = () =>
    current(o) && r === searchRequest && el<HTMLInputElement>('live-rule-search').value === query;
  const root = el('live-rule-results'),
    seen = new Set<string>();
  root.replaceChildren();
  const load = async (offset: number, more: HTMLButtonElement | null = null) => {
    if (!currentSearch()) return;
    if (more) more.disabled = true;
    try {
      const page = unwrap(await window.campaign.searchDesk(o.token, 'rule', query, offset));
      if (!currentSearch()) return;
      more?.remove();
      const pinned = new Set(view?.pins.map((p) => p.noteId));
      for (const entry of page.entries) {
        if (entry.ref.kind !== 'note' || pinned.has(entry.ref.id) || seen.has(entry.ref.id))
          continue;
        seen.add(entry.ref.id);
        root.append(ruleCandidate(entry, o, currentSearch));
      }
      if (page.notice) {
        const notice = document.createElement('p');
        notice.textContent = page.notice;
        notice.setAttribute('role', 'alert');
        root.append(notice);
      }
      if (page.next !== null) {
        const next = page.next;
        const b = button('Weitere Regeln anzeigen', () => void load(next, b));
        root.append(b);
      }
      if (!root.childNodes.length) message(root, 'Keine weitere Regelreferenz gefunden.');
      lock();
    } catch (error) {
      if (currentSearch()) {
        if (more) {
          more.disabled = false;
          more.textContent = 'Weitere Regeln erneut laden';
        } else message(root, (error as Error).message, true);
        tell((error as Error).message, true);
      }
    }
  };
  await load(0);
}
function ruleCandidate(entry: DeskEntry, o: Owner, currentSearch: () => boolean) {
  const card = document.createElement('article'),
    details = document.createElement('details'),
    summary = document.createElement('summary'),
    body = document.createElement('div');
  summary.textContent = entry.title + ' · Regel lesen';
  if (entry.preview) {
    const p = document.createElement('p'),
      preview = entry.preview;
    p.className = 'caption';
    p.textContent =
      'parts' in preview
        ? preview.owner + ' · ' + preview.parts.map((p) => p.text).join('')
        : preview.label + ' · ' + preview.text;
    summary.append(p);
  }
  details.append(summary, body);
  card.append(details);
  if (entry.unavailable) {
    body.textContent = 'Quelle nicht verfügbar. Erneut suchen.';
    return card;
  }
  let loading = false,
    loaded = false;
  const read = async () => {
    if (!currentSearch() || loading || loaded) return;
    loading = true;
    message(body, 'Regel wird gelesen…');
    try {
      const content = unwrap(await window.campaign.deskContent(o.token, entry.ref));
      if (!currentSearch() || !card.isConnected) return;
      if (
        content.unavailable ||
        content.ref.kind !== 'note' ||
        content.ref.id !== entry.ref.id ||
        !content.note ||
        content.note.kind !== 'rule' ||
        content.note.id !== entry.ref.id ||
        content.note.revision !== content.revision
      )
        throw Error('Regelquelle nicht verfügbar. Erneut suchen.');
      body.replaceChildren();
      const revision = document.createElement('p');
      revision.className = 'caption';
      revision.textContent = content.title + ' · Quelle Revision ' + content.revision;
      body.append(revision);
      for (const [label, value] of [
        ['Zum Vorlesen', content.note.readAloud],
        ['GM-Details', content.note.gmNotes],
      ])
        if (value) {
          const h = document.createElement('h5'),
            p = document.createElement('pre');
          h.textContent = label!;
          p.textContent = value!;
          p.className = 'rule-candidate-text';
          body.append(h, p);
        }
      const pin = button('Anheften', async () => {
        if (!currentSearch() || !loaded) return;
        const saved = await command({
          kind: 'pin',
          noteId: entry.ref.id,
          expectedSourceRevision: content.revision,
        });
        if (saved && current(o)) {
          el<HTMLDialogElement>('live-rule-lookup').close();
          const prepare = [
            ...el('live-rule-pins').querySelectorAll<HTMLButtonElement>('button[data-rule-id]'),
          ].find((b) => b.dataset.ruleId === entry.ref.id);
          prepare?.focus();
          prepare?.scrollIntoView({ block: 'center' });
        } else if (!saved && currentSearch()) {
          loaded = false;
          pin.disabled = true;
          body.append(button('Regel erneut lesen', () => void read()));
        }
      });
      body.append(pin);
      loaded = true;
      lock();
    } catch (error) {
      if (currentSearch() && card.isConnected) {
        message(body, (error as Error).message, true);
        body.append(button('Regel erneut lesen', () => void read()));
      }
    } finally {
      loading = false;
    }
  };
  details.ontoggle = () => {
    if (details.open) void read();
  };
  return card;
}

export function initRuleReferences(status: typeof tell) {
  tell = status;
  ensure();
}
export function activateRuleReferences(next: WorkspaceGeometry) {
  el<HTMLDialogElement>('live-rule-lookup').close();
  workspace = next;
  sceneId = null;
  view = null;
  checks = null;
  busy = false;
  generation++;
  ruleReadRequest++;
  checkReadRequest++;
  searchRequest++;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  el('live-rules-panel').hidden = true;
  el('live-rule-results').replaceChildren();
  el('live-rule-pins').replaceChildren();
  renderChecks();
  lock();
}
export async function refreshRuleReferences(nextSceneId: string | null) {
  ensure();
  if (sceneId !== nextSceneId) {
    el<HTMLDialogElement>('live-rule-lookup').close();
    generation++;
    searchRequest++;
    busy = false;
    view = null;
    checks = null;
    el('live-rule-results').replaceChildren();
    el('live-rule-pins').replaceChildren();
    renderCheckOptions();
    renderChecks();
    lock();
  }
  if (sceneId !== nextSceneId) clearSearch();
  sceneId = nextSceneId;
  el('live-rules-panel').hidden = !nextSceneId;
  const o = owner(),
    rulesRequest = ++ruleReadRequest,
    checksRequest = ++checkReadRequest;
  if (!o) return;
  // Each reader owns only its own view: one missing or slow source cannot hide the other.
  const readRules = async () => {
    try {
      const result = await window.campaign.sceneRules(o.token, o.sceneId);
      if (!current(o) || rulesRequest !== ruleReadRequest) return;
      accept(unwrap(result), o);
      await search();
    } catch (error) {
      if (current(o) && rulesRequest === ruleReadRequest) {
        view = null;
        clearSearch();
        renderCheckOptions();
        message(el('live-rule-pins'), (error as Error).message, true);
        lock();
        tell((error as Error).message, true);
      }
    }
  };
  const readChecks = async () => {
    try {
      const result = await window.campaign.sceneChecks(o.token, o.sceneId);
      if (!current(o) || checksRequest !== checkReadRequest) return;
      acceptChecks(unwrap(result), o);
    } catch (error) {
      if (current(o) && checksRequest === checkReadRequest) {
        checks = null;
        renderChecks();
        message(el('live-check-history'), (error as Error).message, true);
        lock();
        tell((error as Error).message, true);
      }
    }
  };
  await Promise.all([readRules(), readChecks()]);
}

function acceptChecks(next: SceneChecks, o: Owner) {
  if (
    next.sceneId !== o.sceneId ||
    !Number.isSafeInteger(next.revision) ||
    next.revision < 0 ||
    !Array.isArray(next.checks) ||
    next.checks.length > 100
  )
    throw new Error('Probenantwort hat einen ungültigen Stand.');
  if (checks?.sceneId === next.sceneId && checks.revision > next.revision) return;
  checks = next;
  renderChecks();
  lock();
}
function renderCheckOptions() {
  const select = el<HTMLSelectElement>('live-check-rule'),
    selected = select.value;
  select.replaceChildren(checkOption('Freie Probe', ''));
  for (const pin of view?.pins ?? [])
    select.append(checkOption(pin.title + (pin.stale ? ' · eingefroren' : ''), pin.noteId));
  select.value = [...select.querySelectorAll('option')].some((option) => option.value === selected)
    ? selected
    : '';
}
export function describeSceneCheck(check: SceneChecks['checks'][number]) {
  const modifier =
      check.modifier === 0
        ? ''
        : check.modifier > 0
          ? ' + ' + check.modifier
          : ' − ' + Math.abs(check.modifier),
    decision =
      check.outcome === null
        ? ''
        : check.rollKind === 'formula' && check.formulaKind === 'attack'
          ? (check.outcome === 'success' ? ' · Treffer gegen RK ' : ' · Verfehlt gegen RK ') +
            check.dc
          : check.outcome === 'success'
            ? ' · Erfolg gegen SG ' + check.dc
            : ' · Fehlschlag gegen SG ' + check.dc;
  if (check.rollKind === 'formula')
    return (
      (check.actor ? check.actor + ' · ' : '') +
      check.label +
      ': ' +
      check.formula +
      ' → ' +
      check.rolls.join(' + ') +
      modifier +
      ' = ' +
      check.total +
      decision
    );
  const kept =
      check.mode === 'advantage'
        ? Math.max(...check.rolls)
        : check.mode === 'disadvantage'
          ? Math.min(...check.rolls)
          : check.rolls[0]!,
    rolls =
      check.mode === 'normal'
        ? String(kept)
        : check.rolls.join(' / ') +
          ' · ' +
          (check.mode === 'advantage' ? 'Vorteil' : 'Nachteil') +
          ' wählt ' +
          kept;
  return (
    (check.actor ? check.actor + ' · ' : '') +
    check.label +
    ': ' +
    rolls +
    modifier +
    ' = ' +
    check.total +
    decision
  );
}
function renderChecks() {
  const root = el('live-check-history'),
    latest = el('live-check-latest');
  root.replaceChildren();
  latest.textContent = '';
  if (!checks?.checks.length) {
    const p = document.createElement('p');
    p.className = 'caption';
    p.textContent = 'Noch keine Probe für diese Gruppe protokolliert.';
    root.append(p);
    return;
  }
  const [newest, ...history] = checks.checks;
  latest.className =
    newest!.outcome === null
      ? ''
      : newest!.outcome === 'success'
        ? 'check-success'
        : 'check-failure';
  latest.textContent =
    'Letztes Ergebnis · ' +
    describeSceneCheck(newest!) +
    (newest!.ruleTitle
      ? ' · Regelbasis: ' + newest!.ruleTitle + ' · Regelrevision ' + newest!.ruleSourceRevision
      : '');
  const details = document.createElement('details'),
    summary = document.createElement('summary'),
    list = document.createElement('ol');
  summary.textContent =
    'Probenverlauf (' + checks.checks.length + (checks.truncated ? '+' : '') + ')';
  for (const check of [newest!, ...history.slice(0, 29)]) {
    const item = document.createElement('li'),
      strong = document.createElement('strong'),
      context = document.createElement('span');
    strong.textContent = describeSceneCheck(check);
    context.textContent =
      ' · ' +
      formatInstant(check.sceneInstantMs) +
      (check.ruleTitle
        ? ' · ' + check.ruleTitle + ' · Regelrevision ' + check.ruleSourceRevision
        : '');
    item.append(strong, context);
    list.append(item);
  }
  details.append(summary, list);
  root.append(details);
}
function checkOption(text: string, value: string) {
  const option = document.createElement('option');
  option.textContent = text;
  option.value = value;
  return option;
}
async function sendCheck(
  action: SceneCheckCommand['action'],
  onResult?: (check: SceneCheck) => void,
) {
  const o = owner(),
    basis = checks;
  if (!o || !basis || busy) return false;
  const command: SceneCheckCommand = {
    commandId: crypto.randomUUID(),
    campaignId: o.campaignId,
    token: o.token,
    sceneId: o.sceneId,
    expectedRevision: basis.revision,
    action,
  };
  busy = true;
  checkReadRequest++;
  lock();
  try {
    const result = await window.campaign.executeSceneCheck(command);
    if (!current(o)) return false;
    const next = unwrap(result);
    checkReadRequest++;
    acceptChecks(next, o);
    if (onResult && next.checks[0]) onResult(next.checks[0]);
    if (action.kind === 'roll' && !action.actor) el<HTMLInputElement>('live-check-label').select();
    tell(
      action.kind === 'roll'
        ? 'GM-Probe gewürfelt und bei der Gruppe gespeichert.'
        : 'Statblock-Wurf ausgeführt und bei der Gruppe gespeichert.',
    );
    return true;
  } catch (error) {
    if (current(o)) tell((error as Error).message, true);
    return false;
  } finally {
    if (current(o)) {
      busy = false;
      lock();
    }
  }
}
async function roll() {
  const dcText = el<HTMLInputElement>('live-check-dc').value;
  const ruleNoteId = el<HTMLSelectElement>('live-check-rule').value || null,
    pin = view?.pins.find((p) => p.noteId === ruleNoteId);
  if (ruleNoteId && !pin) {
    tell('Regelstand erneut laden und Regel prüfen.', true);
    return;
  }
  await sendCheck({
    kind: 'roll',
    label: el<HTMLInputElement>('live-check-label').value,
    ruleNoteId,
    ...(pin ? { expectedRuleSourceRevision: pin.sourceRevision } : {}),
    mode: el<HTMLSelectElement>('live-check-mode').value as Extract<
      SceneCheckCommand['action'],
      { kind: 'roll' }
    >['mode'],
    modifier: Number(el<HTMLInputElement>('live-check-modifier').value),
    dc: dcText === '' ? null : Number(dcText),
  });
}
export async function rollSceneFormula(
  action: Omit<FormulaAction, 'kind'>,
  onResult?: (check: SceneCheck) => void,
) {
  return sendCheck({ kind: 'formula', ...action }, onResult);
}

export async function rollSceneCheck(
  action: Omit<CheckAction, 'kind' | 'ruleNoteId'>,
  onResult?: (check: SceneCheck) => void,
) {
  return sendCheck({ kind: 'roll', ruleNoteId: null, ...action }, onResult);
}
