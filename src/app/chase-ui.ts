import { EditorSession } from './editor-session';
import { openMaskHistory, closeMaskHistory } from './mask-history-ui';
import { ChaseDraftCache } from './chase-draft-cache';
import { chaseDraftFields, type ChaseWorkingDraft } from './chase-draft-contracts';
import type { WorkspaceGeometry } from './contracts';
import type { Character, LiveScene } from './live-contracts';
import {
  chaseActionControls,
  checkedChaseView,
  type ChaseCommand,
  type ChaseView,
} from './chase-contracts';
import {
  hasPendingCommit,
  onCommitResolved,
  onCommitState,
  writeConfirmed,
  type CommitResolution,
} from './commit-confirmation';
export const editorSession = new EditorSession();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => el<HTMLInputElement>(id).value;
let w: WorkspaceGeometry | null = null,
  scene: LiveScene | null = null,
  roster: Character[] = [],
  rosterBasis = '',
  view: ChaseView | null = null,
  tell: (s: string, e?: boolean) => void,
  busy = false,
  afterConfirmed: (() => Promise<void>) | undefined;
let clockText = '';
let requestedId: string | undefined,
  loading = false,
  loadError = '',
  rendered = '';
type Draft = {
  fields: Record<string, string>;
  rows: Record<string, { distance?: string; exhaustion?: string }>;
};
// Unconfirmed rounds remain explicit proposals, separate from the durable round counter.
// Persist raw input independently; a confirmed round consumes its fields atomically.
const drafts = new Map<string, Draft>();
const fieldIds: readonly string[] = chaseDraftFields;
const cache = new ChaseDraftCache(drawDraftStatus);
function drawDraftStatus() {
  const root = document.getElementById('chase-draft-status'),
    retry = document.getElementById('chase-draft-retry') as HTMLButtonElement | null;
  if (!root || !retry) return;
  const state = w && view?.chase ? cache.status(w.campaign.id, view.chase.id) : null;
  root.hidden =
    view?.chase?.status !== 'running' || !state || (!state.error && !state.dirty && !state.saved);
  root.setAttribute('role', state?.error ? 'alert' : 'status');
  root.textContent =
    state?.error ??
    (state?.dirty
      ? 'Entwurf wird gesichert …'
      : state?.saved
        ? 'Entwurf gesichert.' +
          (w &&
          view?.chase &&
          (cache.current(w.campaign.id, view.chase.id)?.rows.length ||
            Object.hasOwn(
              cache.current(w.campaign.id, view.chase.id)?.fields ?? {},
              'chase-complication',
            ))
            ? ' Runde noch nicht bestätigt.'
            : '')
        : '');
  retry.hidden = !state?.error;
  retry.disabled = busy || loading;
}
function queueDraft() {
  if (!w || !view?.chase) return;
  const d = draft();
  if (!d) return;
  const value: ChaseWorkingDraft = {
    version: 1,
    writeId: crypto.randomUUID(),
    chaseId: view.chase.id,
    sceneId: view.chase.sceneId,
    revision: view.chase.revision,
    fields: structuredClone(d.fields),
    rows: Object.entries(d.rows).map(([participantId, row]) => ({ participantId, ...row })),
  };
  void cache.put(w.token, w.campaign.id, value);
}
function acceptDraft(next: ChaseView) {
  if (!w || !next.chase) return;
  const d = cache.accept(w.campaign.id, next),
    key = next.chase.sceneId + ':' + next.chase.id;
  drafts.set(key, {
    fields: structuredClone(d?.fields ?? {}),
    rows: Object.fromEntries(
      (d?.rows ?? [])
        .filter((r) => next.chase!.participants.some((p) => p.id === r.participantId))
        .map(({ participantId, ...row }) => [participantId, row]),
    ),
  });
  if (d && d.revision !== next.chase.revision && next.chase.status === 'running') {
    const revised = {
      ...structuredClone(d),
      writeId: crypto.randomUUID(),
      revision: next.chase.revision,
      rows: d.rows.filter((r) => next.chase!.participants.some((p) => p.id === r.participantId)),
    };
    void cache.put(w.token, w.campaign.id, revised);
  }
  rendered = '';
}
const draftKey = () => (view?.chase ? scene!.id + ':' + view.chase.id : null);
function draft() {
  const key = draftKey();
  if (!key) return null;
  let d = drafts.get(key);
  if (!d) {
    d = { fields: {}, rows: {} };
    drafts.set(key, d);
  }
  return d;
}
function speedValid() {
  const text = val('chase-speed'),
    n = Number(text);
  return text.trim() !== '' && Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
}
function roundInputsValid() {
  return [
    ...el('chase-people').querySelectorAll<HTMLInputElement>('[data-distance],[data-exhaustion]'),
  ].every(
    (input) =>
      input.value.trim() !== '' &&
      Number.isSafeInteger(Number(input.value)) &&
      Number(input.value) >= (input.hasAttribute('data-distance') ? -1000000 : 0) &&
      Number(input.value) <= (input.hasAttribute('data-distance') ? 1000000 : 6),
  );
}
function pending() {
  return busy || (!!w && hasPendingCommit(w.campaign.id));
}
function ready() {
  return (
    !!w && !!scene && !loading && !loadError && (!requestedId || view?.chase?.id === requestedId)
  );
}
function clearWorkInput() {
  for (const id of fieldIds)
    el<HTMLInputElement>(id).value =
      id === 'chase-speed' ? '9' : id === 'chase-side' ? 'pursuer' : '';
}
function restoreWorkInput() {
  clearWorkInput();
  for (const [id, value] of Object.entries(draft()?.fields ?? {}))
    el<HTMLInputElement>(id).value = value;
  el<HTMLDetailsElement>('chase-completion').open = !!val('chase-outcome');
}
export function initChase(status: typeof tell, refreshScene?: () => Promise<void>) {
  tell = status;
  afterConfirmed = refreshScene;
  const root = document.createElement('section');
  root.id = 'chase-panel';
  root.hidden = true;
  root.innerHTML =
    '<div class="toolbar"><h2>Verfolgung führen</h2><button id="chase-new">Neue Verfolgung</button><button id="chase-history-open" type="button">Alle Verfolgungen suchen</button><button id="chase-refresh">Aktualisieren</button></div><p id="chase-load-status" role="status" hidden></p><label id="chase-recent-row" hidden>Verfolgung auswählen<select id="chase-recent"></select></label><div id="chase-create"><label>Titel<input id="chase-title" value="Verfolgungsjagd" maxlength="1000"></label><label>Ziel / Abbruchbedingung<input id="chase-goal" placeholder="Tor erreichen oder 60 m Abstand" maxlength="4000"></label><button id="chase-start">Verfolgung beginnen</button></div><div id="chase-work" hidden><p id="chase-status"></p><p id="chase-clock" role="status" hidden></p><fieldset id="chase-round-draft"><legend id="chase-round-label">Nächste Runde · Entwurf</legend><p id="chase-draft-status" role="status" hidden></p><button id="chase-draft-retry" type="button" hidden>Entwurf erneut sichern</button><div id="chase-people"></div><details id="chase-participant-add"><summary>Teilnehmer hinzufügen</summary><label>Name<input id="chase-name" maxlength="1000"></label><label>Rolle<select id="chase-side"><option value="pursuer">Verfolger</option><option value="quarry">Flüchtend</option></select></label><button id="chase-party" type="button">Scene-Gruppe als diese Rolle übernehmen</button><label>Tempo pro Runde (m)<input id="chase-speed" type="number" value="9" min="0" max="1000000"></label><button id="chase-add">Hinzufügen</button></details><label>Komplikation dieser Runde<input id="chase-complication" placeholder="Marktstand versperrt den Weg" maxlength="4000"></label><button id="chase-round">Runde bestätigen (+6 Sekunden)</button></fieldset><section id="chase-retained-draft" hidden><h3>Unbestätigte Eingaben</h3><p>Diese Eingaben wurden nicht in den bestätigten Stand übernommen. Sie bleiben zum Lesen und Kopieren erhalten.</p><textarea id="chase-retained-text" aria-label="Unbestätigte Eingaben" rows="8" readonly></textarea></section><details id="chase-completion"><summary>Verfolgung abschließen</summary><label>Ergebnis<textarea id="chase-outcome" maxlength="10000"></textarea></label><button id="chase-finish">Verfolgung abschließen</button></details></div>';
  document.querySelector('#combat-panel')!.after(root);
  onCommitState(draw);
  onCommitResolved(recovered);
  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    if (!ready() || pending()) return;
    const d = draft();
    if (!d) return;
    if (fieldIds.includes(input.id)) d.fields[input.id] = input.value;
    const row = input.closest<HTMLElement>('[data-id]');
    if (row && (input.hasAttribute('data-distance') || input.hasAttribute('data-exhaustion'))) {
      const r = (d.rows[row.dataset.id!] ??= {});
      r[input.hasAttribute('data-distance') ? 'distance' : 'exhaustion'] = input.value;
    }
    queueDraft();
    syncActions();
  });
  el('chase-side').onchange = () => {
    if (ready() && !pending()) {
      const d = draft();
      if (d) {
        d.fields['chase-side'] = val('chase-side');
        queueDraft();
      }
    }
  };
  el('chase-draft-retry').onclick = () =>
    void (async () => {
      if (!w || pending() || loading) return;
      const token = w.token,
        request = editorSession.generation;
      if (
        (await cache.retry(token, w.campaign.id)) &&
        w?.token === token &&
        editorSession.generation === request
      )
        await load(requestedId ?? view?.chase?.id);
    })();
  el('chase-new').onclick = () =>
    void (async () => {
      if (!w || !scene || pending() || loading) return;
      const currentToken = w.token,
        request = ++editorSession.generation;
      loading = true;
      draw();
      const saved = await cache.flush(w.campaign.id);
      if (editorSession.generation !== request || w?.token !== currentToken) return;
      loading = false;
      if (!saved) {
        draw();
        return;
      }
      requestedId = undefined;
      loadError = '';
      if (view) view = { ...view, chase: null, draft: null };
      rendered = '';
      clearWorkInput();
      draw();
    })();
  el('chase-history-open').onclick = () =>
    void (async () => {
      if (!w || !scene || pending() || loading) return;
      const token = w.token,
        campaignId = w.campaign.id,
        sceneId = scene.id,
        request = editorSession.generation;
      if (
        !(await flushChase()) ||
        w?.token !== token ||
        scene?.id !== sceneId ||
        editorSession.generation !== request
      )
        return;
      openMaskHistory({
        token,
        campaignId,
        sceneId,
        kind: 'chase',
        current: () =>
          w?.token === token && scene?.id === sceneId && editorSession.generation === request,
        select: (item) => load(item.id),
      });
    })();
  el('chase-refresh').onclick = () => {
    if (!pending()) void load(requestedId ?? view?.chase?.id);
  };
  el<HTMLSelectElement>('chase-recent').onchange = () => {
    if (!pending()) void load(val('chase-recent') || undefined);
  };
  el('chase-title').oninput = syncActions;
  el('chase-start').onclick = () =>
    void command({ kind: 'create', title: val('chase-title'), goal: val('chase-goal') });
  el('chase-party').onclick = () => void addSceneParty();
  el('chase-add').onclick = () =>
    void command({
      kind: 'participant',
      participant: {
        id: crypto.randomUUID(),
        characterId: null,
        name: val('chase-name'),
        side: val('chase-side') as 'pursuer' | 'quarry',
        distance: 0,
        speed: Number(val('chase-speed')),
        exhaustion: 0,
        notes: '',
      },
    });
  el('chase-round').onclick = () =>
    void command({
      kind: 'round',
      changes: [...el('chase-people').querySelectorAll<HTMLElement>('[data-id]')].map((row) => ({
        participantId: row.dataset.id!,
        distance: Number((row.querySelector('[data-distance]') as HTMLInputElement).value),
        exhaustion: Number((row.querySelector('[data-exhaustion]') as HTMLInputElement).value),
      })),
      complication: val('chase-complication'),
    });
  el('chase-finish').onclick = () =>
    void command({ kind: 'finish', outcome: val('chase-outcome') });
}
export function chaseContext(
  next: WorkspaceGeometry | null,
  current: LiveScene | null,
  characters: Character[] = [],
  formattedClock = '',
) {
  const workspaceChanged = next?.token !== w?.token,
    changed = workspaceChanged || current?.id !== scene?.id,
    nextBasis = JSON.stringify(
      characters
        .filter((c) => c.active && c.sceneId === current?.id)
        .map((c) => [c.id, c.membershipRevision]),
    ),
    partyChanged = nextBasis !== rosterBasis;
  if (workspaceChanged) {
    if (w) cache.release(w.campaign.id);
    drafts.clear();
  }
  w = next;
  scene = current;
  clockText = current ? formattedClock : '';
  roster = characters;
  rosterBasis = nextBasis;
  el('chase-panel').hidden = !current;
  if (changed) {
    closeMaskHistory();
    editorSession.generation++;
    requestedId = undefined;
    loading = false;
    loadError = '';
    rendered = '';
    clearWorkInput();
    el<HTMLInputElement>('chase-title').value = 'Verfolgungsjagd';
    el<HTMLInputElement>('chase-goal').value = '';
    view = null;
    draw();
    if (current) void load();
  } else {
    draw();
    if (partyChanged && current && view?.chase?.status === 'running' && !pending())
      void load(view.chase.id);
  }
}
function sceneCharacters() {
  const linked = new Set(view?.chase?.participants.map((p) => p.characterId).filter(Boolean));
  return roster.filter((c) => c.active && c.sceneId === scene?.id && !linked.has(c.id));
}
async function addSceneParty() {
  if (!ready() || pending()) return;
  const side = val('chase-side') as 'pursuer' | 'quarry',
    participants = sceneCharacters().map((c) => ({
      id: crypto.randomUUID(),
      characterId: c.id,
      name: c.profile.name,
      side,
      distance: 0,
      speed: Math.round((c.profile.speedFeet ?? 30) * 0.3),
      exhaustion: 0,
      notes: '',
    }));
  if (!participants.length) {
    tell('Alle Figuren dieser Scene sind bereits in der Verfolgung.', true);
    return;
  }
  await command({ kind: 'participants', participants });
}
async function load(id?: string) {
  if (!w || !scene) return;
  const token = w.token,
    campaignId = w.campaign.id,
    sceneId = scene.id,
    previousId = view?.chase?.id,
    request = ++editorSession.generation;
  requestedId = id;
  loading = true;
  loadError = '';
  draw();
  const current = () =>
    editorSession.generation === request && w?.token === token && scene?.id === sceneId;
  try {
    if (!(await cache.flush(campaignId))) {
      if (current()) {
        requestedId = previousId;
        loading = false;
        draw();
      }
      return;
    }
    if (!current()) return;
    const r = await window.campaign.chase(token, sceneId, id);
    if (!current()) return;
    if (!r.ok) throw new Error(r.error);
    const next = checkedChaseView(r.value);
    if (
      (next.chase && (next.chase.sceneId !== sceneId || (id && next.chase.id !== id))) ||
      (id && !next.chase)
    )
      throw new Error('Antwort gehört zu einer anderen Verfolgung. Erneut laden.');
    acceptDraft(next);
    view = next;
    requestedId = next.chase?.id;
    restoreWorkInput();
  } catch (e) {
    if (!current()) return;
    loadError = (e as Error).message;
    tell(loadError, true);
  } finally {
    if (current()) {
      loading = false;
      draw();
    }
  }
}
async function command(action: ChaseCommand['action'], ownerId = view?.chase?.id) {
  if (
    !ready() ||
    pending() ||
    (action.kind === 'round' && !roundInputsValid()) ||
    (action.kind === 'participant' && !speedValid())
  )
    return;
  const c = view?.chase,
    creating = action.kind === 'create';
  if (!creating && (!c || c.id !== ownerId || c.status !== 'running')) return;
  const token = w!.token,
    campaignId = w!.campaign.id,
    sceneId = scene!.id,
    requestNonce = editorSession.generation,
    request: ChaseCommand = {
      commandId: crypto.randomUUID(),
      campaignId,
      token,
      sceneId,
      chaseId: creating ? null : c!.id,
      expectedRevision: creating ? null : c!.revision,
      action,
    };
  const current = () =>
    w?.token === token && scene?.id === sceneId && editorSession.generation === requestNonce;
  busy = true;
  draw();
  try {
    if (!(await cache.flush(campaignId)))
      throw new Error('Verfolgungsentwurf zuerst sichern. Rohwerte bleiben offen.');
    if (!current()) return;
    const saved = !creating && c ? cache.current(campaignId, c.id) : null;
    if (saved) request.draftWriteId = saved.writeId;
    const result = checkedChaseView(
      await writeConfirmed('chase', request, () => window.campaign.executeChase(request), current, {
        owner: 'chase',
        token,
        sceneId,
        chaseId: request.chaseId,
        actionKind: action.kind,
      }),
    );
    if (!current()) return;
    if (
      !result.chase ||
      result.chase.sceneId !== sceneId ||
      (!creating && result.chase.id !== c!.id)
    ) {
      loadError = 'Buchungsantwort gehört zu einer anderen Verfolgung. Neu laden.';
      throw new Error(loadError);
    }
    if (creating) {
      el<HTMLInputElement>('chase-title').value = 'Verfolgungsjagd';
      el<HTMLInputElement>('chase-goal').value = '';
      clearWorkInput();
    }
    acceptDraft(result);
    view = result;
    requestedId = result.chase.id;
    restoreWorkInput();
    tell('Verfolgung gespeichert.');
    if (action.kind === 'finish' || action.kind === 'round') void afterConfirmed?.();
  } catch (e) {
    if (current()) tell((e as Error).message, true);
  } finally {
    busy = false;
    draw();
  }
}
async function recovered(event: CommitResolution) {
  if (event.ref.family !== 'chase' || w?.campaign.id !== event.ref.campaignId || !scene) return;
  const result = checkedChaseView(event.value as ChaseView),
    c = result.chase,
    meta = event.meta as
      | { token?: string; sceneId?: string; chaseId?: string; actionKind?: string }
      | undefined;
  if (!c || c.sceneId !== scene.id) return;
  const own =
    meta?.token === w.token &&
    meta.sceneId === scene.id &&
    (meta.chaseId === c.id || meta.actionKind === 'create');

  if (own && (meta.actionKind === 'finish' || meta.actionKind === 'round')) void afterConfirmed?.();
  if (requestedId === c.id || (own && meta.actionKind === 'create' && !requestedId))
    await load(c.id);
}
function syncActions() {
  const c = view?.chase,
    blocked = pending() || !ready(),
    closed = blocked || !c || c.status !== 'running',
    controls = chaseActionControls({
      title: val('chase-title'),
      participantName: val('chase-name'),
      participantCount: c?.participants.length ?? 0,
      outcome: val('chase-outcome'),
    });
  el<HTMLButtonElement>('chase-start').disabled =
    blocked || (!!c && c.status === 'running') || !controls.start;
  el<HTMLButtonElement>('chase-party').disabled = closed || !sceneCharacters().length;
  el<HTMLButtonElement>('chase-add').disabled = closed || !controls.addParticipant || !speedValid();
  el<HTMLButtonElement>('chase-round').disabled =
    closed || !controls.advanceRound || !roundInputsValid();
  el<HTMLButtonElement>('chase-finish').disabled = closed || !controls.finish;
}
function draw() {
  drawDraftStatus();
  const c = view?.chase,
    blocked = pending(),
    available = ready(),
    select = el<HTMLSelectElement>('chase-recent');
  el('chase-panel').setAttribute('aria-busy', String(loading));
  const message = el('chase-load-status');
  message.hidden = !loading && !loadError;
  message.setAttribute('role', loadError ? 'alert' : 'status');
  message.textContent = loading
    ? 'Verfolgung wird geladen …'
    : loadError
      ? loadError + ' Mit „Aktualisieren“ erneut laden.'
      : '';
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Verfolgung auswählen';
  select.append(empty);
  const recent = [...(view?.recent ?? [])];
  if (c && !recent.some((r) => r.id === c.id)) recent.unshift(c);
  if (requestedId && !recent.some((r) => r.id === requestedId))
    recent.push({ id: requestedId, title: 'Ausgewählte Verfolgung', status: 'running' });
  for (const r of recent) {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent =
      r.title +
      ' · ' +
      (r.status === 'running'
        ? 'laufend'
        : r.status === 'retired'
          ? 'archiviert'
          : 'abgeschlossen');
    select.append(option);
  }
  select.value = requestedId ?? c?.id ?? '';
  el('chase-recent-row').hidden = !recent.length;
  el('chase-create').hidden = !available || !!c;
  el('chase-work').hidden = !c || !available;
  for (const x of el('chase-panel').querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
  >('input,button,textarea,select'))
    x.disabled = blocked || !available;
  select.disabled = blocked || !scene;
  el<HTMLButtonElement>('chase-history-open').disabled = blocked || !scene || loading;
  el<HTMLButtonElement>('chase-refresh').disabled = blocked || !scene || loading;
  el<HTMLButtonElement>('chase-new').disabled = blocked || !scene || loading;
  el('chase-clock').textContent = clockText ? 'Gruppenzeit: ' + clockText : '';
  el('chase-clock').hidden = !c || !clockText;
  if (!c) {
    el('chase-people').replaceChildren();
    rendered = '';
    syncActions();
    return;
  }
  el('chase-round-label').textContent =
    c.status === 'running' ? 'Nächste Runde · Entwurf' : 'Bestätigter Teilnehmerstand';
  el('chase-complication').parentElement!.hidden = c.status !== 'running';
  el('chase-round').hidden = c.status !== 'running';
  el('chase-completion').hidden = c.status !== 'running';
  el('chase-participant-add').hidden = c.status !== 'running';
  el('chase-status').textContent =
    c.title +
    ' · Runde ' +
    c.round +
    ' · Ziel: ' +
    (c.goal || 'offen') +
    (c.complication ? ' · Letzte Komplikation: ' + c.complication : '') +
    (c.status === 'finished'
      ? ' · ' + c.outcome
      : c.status === 'retired'
        ? ' · archiviert; kein Ergebnis abgeleitet'
        : '');
  const identity = scene!.id + ':' + c.id + ':' + c.revision;
  if (rendered !== identity) {
    rendered = identity;
    const root = el('chase-people'),
      d = c.status === 'running' ? draft() : null,
      openManagement = new Set(
        root.dataset.chaseId === c.id
          ? [...root.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
              (detail) => detail.closest<HTMLElement>('[data-id]')!.dataset.id,
            )
          : [],
      );
    root.dataset.chaseId = c.id;
    root.replaceChildren();
    if (d)
      for (const id of Object.keys(d.rows))
        if (!c.participants.some((p) => p.id === id)) delete d.rows[id];
    for (const p of c.participants) {
      const row = document.createElement('div');
      row.className = 'chase-row';
      row.dataset.id = p.id;
      row.innerHTML =
        '<strong></strong><label>Abstand m<input data-distance type="number" min="-1000000" max="1000000"></label><label>Erschöpfung<input data-exhaustion type="number" min="0" max="6"></label><details data-management><summary>Teilnehmer verwalten</summary><button data-visibility type="button"></button><button data-remove type="button">Entfernen</button></details>';
      row.querySelector<HTMLDetailsElement>('details')!.open = openManagement.has(p.id);
      row.querySelector('strong')!.textContent =
        p.name +
        ' · ' +
        (p.side === 'pursuer' ? 'Verfolger' : 'Flüchtend') +
        ' · Tempo ' +
        p.speed +
        ' m' +
        (p.hiddenFromPlayers ? ' · auf Anzeige verborgen' : '');
      (row.querySelector('[data-distance]') as HTMLInputElement).value =
        d?.rows[p.id]?.distance ?? String(p.distance);
      (row.querySelector('[data-exhaustion]') as HTMLInputElement).value =
        d?.rows[p.id]?.exhaustion ?? String(p.exhaustion);
      const visibility = row.querySelector<HTMLButtonElement>('[data-visibility]')!;
      visibility.hidden = !!p.characterId;
      visibility.textContent = p.hiddenFromPlayers
        ? 'Auf Spieleranzeige zeigen'
        : 'Auf Spieleranzeige verbergen';
      visibility.onclick = () =>
        void command(
          { kind: 'visibility', participantId: p.id, hidden: !p.hiddenFromPlayers },
          c.id,
        );
      row.querySelector<HTMLButtonElement>('[data-remove]')!.onclick = () =>
        void command({ kind: 'remove', participantId: p.id }, c.id);
      root.append(row);
    }
  }
  const retained = el('chase-retained-draft'),
    raw = draft(),
    lines: string[] = [];
  if (c.status !== 'running' && raw) {
    const labels: Record<string, string> = {
      'chase-name': 'Neuer Teilnehmer',
      'chase-side': 'Rolle',
      'chase-speed': 'Tempo (m)',
      'chase-complication': 'Komplikation',
      'chase-outcome': 'Ergebnis',
    };
    for (const [id, value] of Object.entries(raw.fields)) {
      const shown =
        id === 'chase-side'
          ? value === 'pursuer'
            ? 'Verfolger'
            : value === 'quarry'
              ? 'Flüchtend'
              : value
          : value;
      lines.push(labels[id] + ': ' + (shown === '' ? '(leer)' : shown));
    }
    for (const [id, row] of Object.entries(raw.rows)) {
      lines.push('Teilnehmer: ' + (c.participants.find((p) => p.id === id)?.name ?? id));
      if (row.distance !== undefined)
        lines.push('Abstand (m): ' + (row.distance === '' ? '(leer)' : row.distance));
      if (row.exhaustion !== undefined)
        lines.push('Erschöpfung: ' + (row.exhaustion === '' ? '(leer)' : row.exhaustion));
    }
  }
  retained.hidden = !lines.length;
  el<HTMLTextAreaElement>('chase-retained-text').value = lines.join('\n');
  for (const detail of el('chase-people').querySelectorAll<HTMLElement>('[data-management]'))
    detail.hidden = c.status !== 'running';
  for (const x of el('chase-work').querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
  >('input,button,textarea,select'))
    x.disabled = blocked || !available || c.status !== 'running';
  el<HTMLTextAreaElement>('chase-retained-text').disabled = false;
  drawDraftStatus();
  syncActions();
}
export async function flushChase() {
  return !busy && (!w || (!hasPendingCommit(w.campaign.id) && (await cache.flush(w.campaign.id))));
}
export async function openExistingChase(id: string) {
  if (await flushChase()) await load(id);
}
