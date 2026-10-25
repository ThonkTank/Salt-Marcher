import type { WorkspaceGeometry } from './contracts';
import type { LiveView } from './live-contracts';
import type { Preparation } from './preparation-contracts';
import {
  visitOutcomeLabel,
  type SessionProgress,
  type VisitOutcomeStatus,
} from './visit-outcome-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let locked = false,
  saving = false;
let workspace: WorkspaceGeometry | null = null,
  live: LiveView | null = null,
  sources: Preparation | null = null,
  view: SessionProgress | null = null,
  request = 0,
  key = '',
  planId = '';
const drafts = new Map<string, { status: VisitOutcomeStatus; text: string }>();
let navigate: (planId: string, visitId: string) => Promise<void>,
  save: (
    sceneId: string,
    adoptionId: string,
    status: VisitOutcomeStatus,
    text: string,
  ) => Promise<boolean>,
  tell: (s: string, e?: boolean) => void;
const draftKey = () =>
  workspace && live?.scene?.adoption
    ? workspace.token + ':' + live.scene.id + ':' + live.scene.adoption.id
    : null;
export function initSessionNavigator(
  status: typeof tell,
  openVisit: typeof navigate,
  saveOutcome: typeof save,
) {
  tell = status;
  navigate = openVisit;
  save = saveOutcome;
  const root = document.createElement('details');
  root.id = 'live-session-navigator';
  root.open = true;
  root.innerHTML =
    '<summary>Spielabend und Besuchsergebnisse</summary><label for="live-session-plan">Spielabendplan</label><select id="live-session-plan"></select><button id="live-session-progress-refresh" type="button">Besuchsstand aktualisieren</button><p id="live-session-progress-summary"></p><div id="live-session-visits"></div><section id="live-visit-outcome" hidden><h4>Ergebnis des übernommenen Besuchs</h4><p id="live-visit-outcome-saved"></p><form id="live-visit-outcome-form"><label>Besuchsstatus<select id="live-visit-outcome-status"><option value="completed">Abgeschlossen</option><option value="skipped">Übersprungen</option><option value="open">Wieder offen</option></select></label><label>Bestätigtes Ergebnis / Folgen<textarea id="live-visit-outcome-text" rows="4" placeholder="Was ist geschehen? Welche offenen Fäden bleiben?"></textarea></label><div class="toolbar live-visit-outcome-actions"><button id="live-visit-outcome-confirm" type="submit">Nur Ergebnis bestätigen</button><button id="live-visit-outcome-next" type="submit" hidden>Ergebnis bestätigen + nächsten Besuch prüfen…</button></div></form><p class="caption">Ergebnisse bleiben in Chronik und Spielabendmappe erhalten. Der Folgeschritt öffnet nur die Übernahmeprüfung; XP, Beute, Zeit und Besuchsübernahme bleiben separat bestätigt.</p></section>';
  // Keep both scene texts together before optional visit planning.
  root.querySelector('summary')!.after(root.querySelector('#live-visit-outcome')!);
  el('running-read-aloud-details').after(root);
  el('live-session-plan').onchange = () => {
    planId = el<HTMLSelectElement>('live-session-plan').value;
    void refresh();
  };
  el('live-session-progress-refresh').onclick = () => void refresh();
  for (const id of ['live-visit-outcome-status', 'live-visit-outcome-text'])
    el(id).oninput = () => {
      const k = draftKey();
      if (k)
        drafts.set(k, {
          status: el<HTMLSelectElement>('live-visit-outcome-status').value as VisitOutcomeStatus,
          text: el<HTMLTextAreaElement>('live-visit-outcome-text').value,
        });
      updateOutcomeActions();
    };
  el('live-visit-outcome-form').onsubmit = (e) => {
    e.preventDefault();
    const scene = live?.scene,
      a = scene?.adoption,
      k = draftKey(),
      token = workspace?.token;
    if (!scene || !a || !k || !token) return;
    const d = {
        status: el<HTMLSelectElement>('live-visit-outcome-status').value as VisitOutcomeStatus,
        text: el<HTMLTextAreaElement>('live-visit-outcome-text').value,
      },
      continueToNext = (e as SubmitEvent).submitter === el('live-visit-outcome-next'),
      next = continueToNext && d.status !== 'open' ? nextOpenVisit() : null;
    drafts.set(k, d);
    saving = true;
    updateOutcomeActions();
    void (async () => {
      const ok = await save(scene.id, a.id, d.status, d.text);
      if (!ok) return;
      if (drafts.get(k)?.text === d.text && drafts.get(k)?.status === d.status) {
        drafts.delete(k);
        renderOutcome();
      }
      if (
        next &&
        workspace?.token === token &&
        live?.scene?.id === scene.id &&
        live.scene.adoption?.id === a.id
      )
        await navigate(next.planId, next.visitId);
      else void refresh();
    })()
      .catch((e) => tell(e.message, true))
      .finally(() => {
        saving = false;
        updateOutcomeActions();
      });
  };
}
function nextOpenVisit() {
  const a = live?.scene?.adoption;
  if (!a || !view || view.planId !== a.planId) return null;
  const index = view.visits.findIndex((visit) => visit.id === a.visitId);
  if (index < 0) return null;
  const visit = view.visits
    .slice(index + 1)
    .find((visit) => !visit.focused?.outcome || visit.focused.outcome.status === 'open');
  return visit ? { planId: view.planId, visitId: visit.id, title: visit.title } : null;
}
function updateOutcomeActions() {
  const confirm = el<HTMLButtonElement>('live-visit-outcome-confirm'),
    next = el<HTMLButtonElement>('live-visit-outcome-next'),
    target = nextOpenVisit(),
    status = el<HTMLSelectElement>('live-visit-outcome-status').value as VisitOutcomeStatus;
  confirm.disabled = locked || saving;
  next.hidden = status === 'open' || !target;
  next.disabled = locked || saving;
  if (target)
    next.textContent = 'Ergebnis bestätigen + „' + target.title.slice(0, 80) + '“ prüfen…';
}
function renderOutcome() {
  const a = live?.scene?.adoption;
  el('live-visit-outcome').hidden = !a;
  if (!a) return;
  const k = draftKey()!,
    d = drafts.get(k),
    saved = a.outcome;
  el('live-visit-outcome-saved').textContent =
    (a.title || 'Unbenannter Besuch') +
    ' · ' +
    (saved
      ? visitOutcomeLabel(saved.status) + ' · ' + new Date(saved.recordedAt).toLocaleString('de-DE')
      : 'Übernommen, Ergebnis noch offen');
  el<HTMLSelectElement>('live-visit-outcome-status').value =
    d?.status ?? saved?.status ?? 'completed';
  el<HTMLTextAreaElement>('live-visit-outcome-text').value = d?.text ?? saved?.text ?? '';
  updateOutcomeActions();
}
export function sessionNavigatorContext(
  w: WorkspaceGeometry | null,
  l: LiveView | null,
  p: Preparation | null,
  active: boolean,
) {
  if (w?.token !== workspace?.token) {
    drafts.clear();
    planId = '';
  }
  workspace = w;
  live = l;
  const next = JSON.stringify([w?.token, l?.focusId, l?.scene?.adoption?.id]);
  const changed = next !== key;
  key = next;
  if (changed) planId = l?.scene?.adoption?.planId ?? planId;
  renderOutcome();
  sessionNavigatorPreparation(p, active);
}
// Late material must not rewrite the independent visit-outcome editor.
export function sessionNavigatorPreparation(p: Preparation | null, active: boolean) {
  sources = p;
  const picker = el<HTMLSelectElement>('live-session-plan');
  picker.replaceChildren();
  for (const plan of sources?.plans ?? []) {
    const o = document.createElement('option');
    o.value = plan.id;
    o.textContent = plan.name || 'Unbenannter Plan';
    picker.append(o);
  }
  if (sources && !sources.plans.some((p) => p.id === planId)) planId = sources.plans[0]?.id ?? '';
  if (!sources && planId) {
    const o = document.createElement('option');
    o.value = planId;
    o.textContent = 'Gewählter Plan · Vorbereitung nicht verfügbar';
    picker.append(o);
  }
  picker.disabled = locked || !sources;
  picker.value = planId;
  el('live-session-navigator').hidden =
    !active || (!sources?.plans.length && !live?.scene?.adoption);
  if (active && workspace && live?.scene) void refresh();
  else {
    request++;
    view = null;
    el('live-session-visits').replaceChildren();
  }
}

async function refresh() {
  const token = workspace?.token,
    sceneId = live?.scene?.id,
    chosen = planId,
    n = ++request;
  view = null;
  el('live-session-visits').replaceChildren();
  updateOutcomeActions();
  if (!token || !sceneId || !chosen) {
    el('live-session-progress-summary').textContent = sources
      ? 'Noch kein Spielabendplan.'
      : 'Vorbereitungspläne nicht verfügbar.';
    return;
  }
  el('live-session-progress-summary').textContent = 'Besuchsstand wird geladen…';
  try {
    const result = await window.campaign.sessionProgress(token, chosen, sceneId);
    if (
      request !== n ||
      workspace?.token !== token ||
      live?.scene?.id !== sceneId ||
      planId !== chosen
    )
      return;
    if (!result.ok) throw new Error(result.error);
    if (
      result.value.planId !== chosen ||
      result.value.visits.some((v) => v.focused && v.focused.sceneId !== sceneId)
    )
      throw new Error('Besuchsstand gehört zu einer anderen Planung oder Gruppe.');
    view = result.value;
    draw();
  } catch (e) {
    if (request === n) el('live-session-progress-summary').textContent = (e as Error).message;
  }
}
function draw() {
  const root = el('live-session-visits');
  root.replaceChildren();
  if (!view) return;
  const current = live?.scene?.adoption,
    done = view.visits.filter((v) => v.focused?.outcome?.status === 'completed').length;
  el('live-session-progress-summary').textContent =
    done + ' von ' + view.visits.length + ' Besuchen für diese Gruppe abgeschlossen';
  for (const [i, v] of view.visits.entries()) {
    const row = document.createElement('article'),
      title = document.createElement('strong'),
      state = document.createElement('p'),
      b = document.createElement('button');
    row.className = 'live-session-visit';
    row.dataset.visitId = v.id;
    title.textContent = i + 1 + '. ' + v.title;
    const own = v.focused,
      isCurrent = current?.planId === view.planId && current.visitId === v.id;
    state.textContent =
      (isCurrent ? 'Aktueller Besuch · ' : '') +
      (own?.outcome
        ? visitOutcomeLabel(own.outcome.status)
        : own
          ? 'Übernommen, Ergebnis offen'
          : 'Für diese Gruppe noch nicht übernommen') +
      (v.count ? ' · ' + v.count + ' Übernahmen insgesamt' : '');
    b.type = 'button';
    b.disabled = locked;
    b.textContent = isCurrent ? 'Erneut übernehmen…' : 'Besuch übernehmen…';
    const target = view.planId;
    b.onclick = () => void navigate(target, v.id).catch((e) => tell(e.message, true));
    row.append(title, state, b);
    root.append(row);
  }
  updateOutcomeActions();
}

export function sessionNavigatorBusy(on: boolean) {
  locked = on;
  for (const control of el('live-session-navigator').querySelectorAll<
    HTMLButtonElement | HTMLSelectElement
  >('button,select'))
    control.disabled = on;
  el<HTMLSelectElement>('live-session-plan').disabled = on || !sources;
  updateOutcomeActions();
}
