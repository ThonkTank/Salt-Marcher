import { EditorSession } from '../shared/editor-session';
import { renderAutonomyDecision } from './autonomy-decision-ui';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type {
  AutonomyView,
  AutonomyActor,
  AutonomyJob,
  AutonomyAction,
  NpcRoute,
} from './autonomy-contracts';
import { standardNeeds } from './autonomy-contracts';
export const editorSession = new EditorSession();
const pendingWork = editorSession.operation<Promise<boolean>>();

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T,
  field = (id: string) => el<HTMLInputElement>(id),
  value = (id: string) => field(id).value,
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
let context: WorkspaceGeometry | null = null,
  data: AutonomyView | null = null,
  draft: AutonomyActor | null = null,
  jobDraft: AutonomyJob | null = null,
  routeDraft: NpcRoute | null = null,
  tell: (s: string, error?: boolean) => void,
  dirty = false,
  dirtyJob = false,
  dirtyRoute = false,
  activeRun: { cancelled: boolean } | null = null;
let viewRequest = 0,
  catchupRequest = 0;
let edits = { actor: 0, job: 0, route: 0 };
let decisionRequest = 0;
function clearDecision() {
  decisionRequest++;
  const root = document.getElementById('autonomy-decision');
  if (root) {
    root.replaceChildren();
    root.hidden = true;
  }
}
async function inspectDecision(id: string) {
  if (!context) return;
  const token = context.token,
    request = ++decisionRequest,
    root = el('autonomy-decision');
  root.hidden = false;
  root.textContent = 'Entscheidung wird geprüft …';
  const response = await window.campaign.autonomyDecision(token, id);
  if (context?.token !== token || request !== decisionRequest) return;
  if (!response.ok) {
    root.textContent = response.error;
    return;
  }
  renderAutonomyDecision(
    root,
    response.value,
    data?.actors.find((a) => a.id === id)?.name ?? 'NPC',
    () => inspectDecision(id),
  );
  root.scrollIntoView({ block: 'start' });
}
const run = (f: () => Promise<unknown> | void) => {
  const owner = editorSession.generation;
  void Promise.resolve()
    .then(() => {
      if (owner === editorSession.generation) return f();
    })
    .catch((e) => {
      if (owner === editorSession.generation) tell(e.message, true);
    });
};
function option(
  id: string,
  list: { id: string; name: string }[],
  selected: string | null,
  empty = true,
) {
  const s = el<HTMLSelectElement>(id);
  s.replaceChildren();
  for (const row of [...(empty ? [{ id: '', name: 'Keine Auswahl' }] : []), ...list]) {
    const o = document.createElement('option');
    o.value = row.id;
    o.textContent = row.name;
    s.append(o);
  }
  if (selected && list.some((x) => x.id === selected)) s.value = selected;
}
function button(text: string, action: () => Promise<unknown> | void) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = () => run(action);
  return b;
}
function pendingFacts(a: AutonomyActor) {
  return (
    data?.logs.find((entry) => entry.actorId === a.id && entry.kind === 'decision')?.facts ?? {}
  );
}
function timeConflictText(a: AutonomyActor) {
  const facts = pendingFacts(a),
    actor =
      typeof facts.actorInstantMs === 'string' && /^(0|[1-9][0-9]*)$/.test(facts.actorInstantMs)
        ? BigInt(facts.actorInstantMs)
        : null,
    scene =
      typeof facts.sceneInstantMs === 'string' && /^(0|[1-9][0-9]*)$/.test(facts.sceneInstantMs)
        ? BigInt(facts.sceneInstantMs)
        : null;
  if (actor === null || scene === null || actor <= scene) return '';
  const minutes = Number((actor - scene) / 60000n);
  return (
    'Zeitvergleich: Der bestätigte NPC-Stand liegt ' +
    minutes +
    ' Minuten nach der Zeit dieser Gruppe.'
  );
}
function decisionFacts(entry: AutonomyView['logs'][number]) {
  if (!['job', 'wait'].includes(entry.kind)) return null;
  const facts = entry.facts,
    considered = Array.isArray(facts.considered)
      ? facts.considered.filter(
          (value): value is { name: string; priority: number; reason: string } =>
            !!value &&
            typeof value === 'object' &&
            typeof value.name === 'string' &&
            typeof value.priority === 'number' &&
            typeof value.reason === 'string',
        )
      : [],
    excluded = Array.isArray(facts.excluded)
      ? facts.excluded.filter((value): value is string => typeof value === 'string')
      : [];
  if (!considered.length && !excluded.length) return null;
  const details = document.createElement('details'),
    summary = document.createElement('summary');
  summary.textContent = 'Entscheidungsfakten';
  details.append(summary);
  if (considered.length) {
    const heading = document.createElement('p'),
      list = document.createElement('ul');
    heading.textContent = 'Zulässige Jobs, nach Auswahlreihenfolge:';
    for (const candidate of considered) {
      const item = document.createElement('li');
      item.textContent =
        candidate.name + ' · Priorität ' + candidate.priority + ' · ' + candidate.reason;
      list.append(item);
    }
    details.append(heading, list);
  }
  if (typeof facts.consideredRemaining === 'number' && facts.consideredRemaining > 0) {
    const more = document.createElement('p');
    more.textContent =
      facts.consideredRemaining + ' weitere zulässige Jobs nicht dauerhaft geloggt.';
    details.append(more);
  }
  if (excluded.length) {
    const heading = document.createElement('p'),
      list = document.createElement('ul');
    heading.textContent = 'Abgelehnte Jobs:';
    for (const reason of excluded) {
      const item = document.createElement('li');
      item.textContent = reason;
      list.append(item);
    }
    details.append(heading, list);
  }
  if (typeof facts.excludedRemaining === 'number' && facts.excludedRemaining > 0) {
    const more = document.createElement('p');
    more.textContent = facts.excludedRemaining + ' weitere Ablehnungen nicht dauerhaft geloggt.';
    details.append(more);
  }
  if (typeof facts.tieBreak === 'string') {
    const tie = document.createElement('p');
    tie.textContent = 'Gleichstand: ' + facts.tieBreak + '.';
    details.append(tie);
  }
  return details;
}
async function resolvePending(a: AutonomyActor, resolution: 'resume' | 'skip') {
  const reason = value('autonomy-decision-reason').trim();
  if (!reason) throw new Error('GM-Entscheidung begründen.');
  await command({
    kind: 'accept-pending',
    actorId: a.id,
    expectedRevision: a.revision,
    resolution,
    reason,
  });
}
function drawActors() {
  if (!data) return;
  const query = value('autonomy-filter').trim().toLocaleLowerCase('de'),
    state = value('autonomy-state-filter') || 'all',
    shown = data.actors.filter(
      (a) =>
        (!query ||
          [a.name, a.role, a.locationName].some((text) =>
            text.toLocaleLowerCase('de').includes(query),
          )) &&
        (state === 'all' ||
          (state === 'active' && a.enabled && !a.paused) ||
          (state === 'remaining' && a.remaining > 0) ||
          (state === 'pending' && !!a.pending) ||
          (state === 'paused' && a.enabled && a.paused) ||
          (state === 'disabled' && !a.enabled)),
    );
  el('autonomy-actor-result').textContent =
    shown.length === data.actors.length
      ? shown.length + ' NPCs angezeigt.'
      : shown.length + ' von ' + data.actors.length + ' NPCs angezeigt.';
  const actors = el('autonomy-actors');
  actors.replaceChildren();
  for (const a of shown) {
    const card = document.createElement('article');
    card.className = 'autonomy-card';
    const title = document.createElement('h3');
    title.textContent = a.name;
    const status = document.createElement('p');
    status.textContent =
      (a.enabled ? (a.paused ? 'Pausiert' : 'Aktiv') : 'Ausgeschaltet') +
      ' · ' +
      a.locationName +
      (a.dungeonPosition
        ? ' · Raum ' + (data!.rooms.find((r) => r.id === a.dungeonPosition!.roomId)?.name ?? '?')
        : '') +
      ' · ' +
      a.remaining +
      ' ausstehende Intervalle' +
      (a.dungeonTravel
        ? ' · unterwegs ' + a.dungeonTravel.nextIndex + '/' + a.dungeonTravel.route.length
        : '');
    const needs = document.createElement('p');
    needs.textContent = a.needs
      .filter((n) => n.enabled)
      .map((n) => n.name + ' ' + Math.round(n.value) + '/100')
      .join(' · ');
    const job = data.jobs.find((j) => j.id === a.jobId),
      assigned = data.jobs.find((j) => j.id === a.assignedJobId),
      work = document.createElement('p');
    work.textContent = job
      ? 'Aktueller Job: ' +
        job.name +
        ' · ' +
        Math.round(a.progressSeconds / 60) +
        ' / ' +
        Math.round(job.durationSeconds / 60) +
        ' min'
      : assigned
        ? 'Direkter Auftrag: ' + assigned.name + ' · derzeit kein laufender Job'
        : 'Kein laufender Job.';
    card.append(
      title,
      status,
      work,
      needs,
      button('Entscheidung ansehen', () => inspectDecision(a.id)),
      button('Konfigurieren', async () => {
        if (!(await flushAutonomy())) return;
        draft = structuredClone(a);
        drawActor();
      }),
    );
    if (!a.pending)
      card.append(
        button(a.paused ? 'Fortsetzen' : 'Pausieren', async () => {
          await command({
            kind: 'pause',
            actorId: a.id,
            paused: !a.paused,
            expectedRevision: a.revision,
          });
        }),
      );
    if (a.dungeonPosition)
      card.append(button('Dungeon-Kontext öffnen', () => el('dungeon-tab').click()));
    if (a.pending) {
      const p = document.createElement('p'),
        time = document.createElement('p'),
        world = document.createElement('p');
      p.className = 'error';
      p.textContent = a.pending;
      time.textContent = timeConflictText(a);
      world.textContent =
        'Aktueller Worldstand: ' +
        a.locationName +
        (a.dungeonPosition
          ? ' · Raum ' + (data!.rooms.find((r) => r.id === a.dungeonPosition!.roomId)?.name ?? '?')
          : '');
      card.append(
        p,
        ...(time.textContent ? [time] : []),
        world,
        button('Scene-/Party-Kontext öffnen', () => el('live-tab').click()),
        button('Mit aktuellem Worldstand fortsetzen', () => resolvePending(a, 'resume')),
        button('Zeitraum als GM auslassen', () => resolvePending(a, 'skip')),
      );
    }
    actors.append(card);
  }
}
export function activateAutonomy(w: WorkspaceGeometry) {
  clearDecision();
  editorSession.generation++;
  viewRequest++;
  catchupRequest++;
  if (activeRun) activeRun.cancelled = true;
  activeRun = null;
  pendingWork.value = null;
  context = w;
  data = null;
  draft = null;
  jobDraft = null;
  routeDraft = null;
  dirty = dirtyJob = dirtyRoute = false;
  edits = { actor: 0, job: 0, route: 0 };
  el<HTMLButtonElement>('autonomy-catchup').disabled = false;
  el('autonomy-progress').textContent = '';
  for (const kind of ['actor', 'job', 'route']) el('autonomy-' + kind + '-form').hidden = true;
  for (const kind of ['actors', 'groups', 'jobs', 'routes', 'log'])
    el('autonomy-' + kind).replaceChildren();
  el('autonomy-summary').textContent = 'NPC-Verhalten wird geladen …';
}
export async function openAutonomy(actorId?: string) {
  if (!context) return;
  const token = context.token,
    owner = editorSession.generation,
    request = ++viewRequest;
  const response = await window.campaign.autonomy(token);
  if (owner !== editorSession.generation || request !== viewRequest) return;
  data = unwrap(response);
  render();
  if (actorId) {
    if (!data.available.some((a) => a.id === actorId))
      throw new Error('NPC-Verhalten nicht verfügbar.');
    el<HTMLSelectElement>('autonomy-actor').value = actorId;
    el<HTMLSelectElement>('autonomy-actor').dispatchEvent(new Event('change'));
    el('autonomy-actor-form').scrollIntoView({ block: 'start' });
  }
}
async function command(action: AutonomyAction) {
  clearDecision();
  if (!context) throw new Error('Kampagne öffnen.');
  const owner = editorSession.generation,
    workspace = context;
  viewRequest++;
  const response = await window.campaign.executeAutonomy({
    commandId: crypto.randomUUID(),
    token: workspace.token,
    campaignId: workspace.campaign.id,
    action,
  });
  if (owner !== editorSession.generation) throw new Error('Autonomie-Kontext wurde gewechselt.');
  const r = unwrap(response);
  data = r.view;
  render();
  return r;
}
function render() {
  if (!data) return;
  el('autonomy-summary').textContent =
    data.actors.filter((a) => a.enabled).length +
    ' aktivierte NPCs · ' +
    data.pendingActors +
    ' Akteure mit bestätigter ausstehender Zeit';
  option('autonomy-actor', data.available, draft?.id ?? null);
  option(
    'autonomy-context',
    data.locations,
    el<HTMLSelectElement>('autonomy-context').value || null,
  );
  option('autonomy-initial-place', data.locations, dirty ? value('autonomy-initial-place') : null);
  option(
    'autonomy-job-place',
    data.locations,
    dirtyJob ? value('autonomy-job-place') : (jobDraft?.locationId ?? null),
  );
  option(
    'autonomy-route-from',
    data.locations,
    dirtyRoute ? value('autonomy-route-from') : (routeDraft?.fromLocationId ?? null),
  );
  option(
    'autonomy-route-to',
    data.locations,
    dirtyRoute ? value('autonomy-route-to') : (routeDraft?.toLocationId ?? null),
  );
  option(
    'autonomy-job-route',
    data.routes,
    dirtyJob ? value('autonomy-job-route') : (jobDraft?.routeId ?? null),
  );
  option(
    'autonomy-job-target',
    data.available,
    dirtyJob ? value('autonomy-job-target') : (jobDraft?.targetActorId ?? null),
  );
  option(
    'autonomy-job-feature',
    data.features,
    dirtyJob ? value('autonomy-job-feature') : (jobDraft?.featureId ?? null),
  );
  option(
    'autonomy-job-room',
    data.rooms,
    dirtyJob ? value('autonomy-job-room') : (jobDraft?.roomId ?? null),
  );
  option(
    'autonomy-patrol-room',
    data.rooms,
    dirtyJob ? value('autonomy-patrol-room') : (jobDraft?.patrolRoomId ?? null),
  );
  option(
    'autonomy-direct-place',
    data.locations,
    data.actors.find((a) => a.id === draft?.id)?.locationId ?? null,
  );
  option(
    'autonomy-assign-job',
    data.jobs.map((j) => ({ id: j.id, name: j.name })),
    draft?.assignedJobId ?? null,
  );
  drawActors();
  const groups = el('autonomy-groups');
  groups.replaceChildren();
  for (const g of data.groups)
    groups.append(
      button(g.name + ' – Gruppenautonomie aktivieren', async () => {
        await command({
          kind: 'group-enable',
          groupId: g.id,
          expectedRevision: g.revision,
          enabled: true,
        });
      }),
      button(g.name + ' – deaktivieren', async () => {
        await command({
          kind: 'group-enable',
          groupId: g.id,
          expectedRevision: g.revision,
          enabled: false,
        });
      }),
    );
  const jobs = el('autonomy-jobs');
  jobs.replaceChildren();
  for (const j of data.jobs)
    jobs.append(
      button(
        j.name +
          ' · ' +
          j.kind +
          (j.exclusive ? ' · exklusiv' : '') +
          (j.enabled ? '' : ' · ausgeschaltet'),
        async () => {
          if (!(await flushAutonomy())) return;
          jobDraft = structuredClone(j);
          drawJob();
        },
      ),
    );
  const routes = el('autonomy-routes');
  routes.replaceChildren();
  for (const r of data.routes)
    routes.append(
      button(r.name + ' · ' + Math.round(r.durationSeconds / 60) + ' min', async () => {
        if (!(await flushAutonomy())) return;
        routeDraft = structuredClone(r);
        drawRoute();
      }),
    );
  const logs = el('autonomy-log');
  logs.replaceChildren();
  for (const entry of data.logs) {
    const article = document.createElement('article'),
      p = document.createElement('p');
    p.textContent =
      (data.actors.find((a) => a.id === entry.actorId)?.name ?? 'NPC') + ': ' + entry.text;
    article.append(p);
    const facts = decisionFacts(entry);
    if (facts) article.append(facts);
    logs.append(article);
  }
  if (draft) {
    const current = data.actors.find((a) => a.id === draft!.id);
    if (current && !dirty) {
      draft = structuredClone(current);
      drawActor();
    }
  }
}
function drawActor() {
  if (!draft || !data) return;
  el('autonomy-actor-form').hidden = false;
  el('autonomy-actor-title').textContent =
    'Konfiguration: ' + (data.available.find((a) => a.id === draft!.id)?.name ?? 'NPC');
  field('autonomy-actor').value = draft.id;
  field('autonomy-enabled').checked = draft.enabled;
  field('autonomy-paused').checked = draft.paused;
  field('autonomy-role').value = draft.role;
  field('autonomy-conflict').checked = draft.allowConflict;
  field('autonomy-defense').value = String(draft.defense);
  field('autonomy-bonus').value = String(draft.attackBonus);
  field('autonomy-loss').value = String(draft.maxHpLossPercent);
  field('autonomy-sight').value = String(draft.sightMeters ?? 20);
  field('autonomy-darkvision').value = String(draft.darkvisionMeters ?? 0);
  field('autonomy-hearing').value = String(draft.hearingMeters ?? 18);
  field('autonomy-perception').value = String(draft.passivePerception ?? 10);
  field('autonomy-stealth').value = String(draft.stealthDc ?? 10);
  field('autonomy-initial-place').value =
    data.available.find((a) => a.id === draft!.id)?.locationId ?? '';
  el('autonomy-initial-place-label').hidden = data.actors.some((a) => a.id === draft!.id);
  option(
    'autonomy-assign-job',
    data.jobs.map((j) => ({ id: j.id, name: j.name })),
    draft.assignedJobId,
  );
  const needs = el('autonomy-needs');
  needs.replaceChildren();
  for (const n of draft.needs) {
    const row = document.createElement('fieldset'),
      legend = document.createElement('legend');
    legend.textContent = n.name;
    row.dataset.need = n.id;
    row.append(legend);
    for (const [key, label] of [
      ['enabled', 'Aktiv'],
      ['value', 'Aktueller Bedarf 0–100'],
      ['ratePerHour', 'Zuwachs je Stunde'],
      ['weight', 'Prioritätsgewicht'],
    ] as const) {
      const l = document.createElement('label'),
        i = document.createElement('input');
      i.dataset.needField = key;
      i.type = key === 'enabled' ? 'checkbox' : 'number';
      i.step = 'any';
      if (key === 'enabled') i.checked = n.enabled;
      else i.value = String(n[key]);
      l.append(label, i);
      row.append(l);
    }
    needs.append(row);
  }
  const priorities = el('autonomy-priorities');
  priorities.replaceChildren();
  for (const job of data.jobs) {
    const label = document.createElement('label'),
      i = document.createElement('input');
    i.type = 'number';
    i.dataset.jobPriority = job.id;
    i.value = String(draft.jobPriorities[job.id] ?? 0);
    label.append(job.name + ' · Prioritätsbonus', i);
    priorities.append(label);
  }
  dirty = false;
}
function actorInput() {
  if (!draft) throw new Error('NPC auswählen.');
  const a = structuredClone(draft);
  a.enabled = field('autonomy-enabled').checked;
  a.paused = field('autonomy-paused').checked;
  a.role = value('autonomy-role');
  a.allowConflict = field('autonomy-conflict').checked;
  a.defense = Number(value('autonomy-defense'));
  a.attackBonus = Number(value('autonomy-bonus'));
  a.maxHpLossPercent = Number(value('autonomy-loss'));
  a.sightMeters = Number(value('autonomy-sight'));
  a.darkvisionMeters = Number(value('autonomy-darkvision'));
  a.hearingMeters = Number(value('autonomy-hearing'));
  a.passivePerception = Number(value('autonomy-perception'));
  a.stealthDc = Number(value('autonomy-stealth'));
  a.assignedJobId = value('autonomy-assign-job') || null;
  for (const row of el('autonomy-needs').querySelectorAll<HTMLElement>('[data-need]')) {
    const n = a.needs.find((n) => n.id === row.dataset.need)!;
    for (const input of row.querySelectorAll<HTMLInputElement>('input')) {
      const key = input.dataset.needField!;
      if (key === 'enabled') n.enabled = input.checked;
      else if (key === 'value') n.value = Number(input.value);
      else if (key === 'ratePerHour') n.ratePerHour = Number(input.value);
      else n.weight = Number(input.value);
    }
  }
  for (const i of el('autonomy-priorities').querySelectorAll<HTMLInputElement>(
    '[data-job-priority]',
  ))
    a.jobPriorities[i.dataset.jobPriority!] = Number(i.value);
  return a;
}
async function saveActor() {
  if (!draft || !dirty) return true;
  const owner = editorSession.generation,
    version = edits.actor;
  try {
    const a = actorInput(),
      old = data!.actors.find((x) => x.id === a.id);
    await command({
      kind: 'actor',
      actor: a,
      expectedRevision: old?.revision ?? null,
      initialLocationId: value('autonomy-initial-place') || null,
    });
    dirty = version !== edits.actor;
    draft = structuredClone(data!.actors.find((x) => x.id === a.id)!);
    if (!dirty) drawActor();
    tell('NPC-Konfiguration gespeichert.');
    return true;
  } catch (e) {
    if (owner === editorSession.generation) tell((e as Error).message, true);
    return false;
  }
}
export async function flushAutonomy(): Promise<boolean> {
  if (activeRun) {
    tell('Zeitnachholen läuft. Erst beenden oder abbrechen.', true);
    return false;
  }
  if (pendingWork.value) return pendingWork.value;
  const owner = editorSession.generation;
  const operation = Promise.resolve().then(async () => {
    do {
      if (owner !== editorSession.generation || !(await saveRoute())) return false;
      if (owner !== editorSession.generation || !(await saveJob())) return false;
      if (owner !== editorSession.generation || !(await saveActor())) return false;
    } while (owner === editorSession.generation && (dirtyRoute || dirtyJob || dirty));
    return owner === editorSession.generation;
  });
  pendingWork.value = operation;
  return operation;
}
function newJob(): AutonomyJob {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    name: 'Neuer Job',
    kind: 'wait',
    locationId: null,
    routeId: null,
    targetActorId: null,
    roles: [],
    priority: 10,
    durationSeconds: 3600,
    exclusive: false,
    enabled: true,
    needEffects: {},
    maxDamage: 1,
  };
}
function drawJob() {
  if (!jobDraft || !data) return;
  el('autonomy-job-form').hidden = false;
  for (const [id, val] of Object.entries({
    'autonomy-job-name': jobDraft.name,
    'autonomy-job-kind': jobDraft.kind,
    'autonomy-job-priority': String(jobDraft.priority),
    'autonomy-job-duration': String(jobDraft.durationSeconds / 60),
    'autonomy-job-roles': jobDraft.roles.join(', '),
    'autonomy-job-damage': String(jobDraft.maxDamage),
  }))
    field(id).value = val;
  field('autonomy-job-enabled').checked = jobDraft.enabled;
  field('autonomy-job-exclusive').checked = jobDraft.exclusive;
  option('autonomy-job-place', data.locations, jobDraft.locationId);
  option('autonomy-job-route', data.routes, jobDraft.routeId);
  option('autonomy-job-target', data.available, jobDraft.targetActorId);
  option('autonomy-job-feature', data.features, jobDraft.featureId ?? null);
  option('autonomy-job-room', data.rooms, jobDraft.roomId ?? null);
  option('autonomy-patrol-room', data.rooms, jobDraft.patrolRoomId ?? null);
  field('autonomy-job-speed').value = String(jobDraft.speedMetersPerMinute ?? 18);
  for (const id of ['hunger', 'thirst', 'rest', 'safety', 'social'])
    field('autonomy-effect-' + id).value = String(jobDraft.needEffects[id] ?? 0);
  const custom = el('autonomy-custom-effects');
  custom.replaceChildren();
  const needs = new Map(
    data.actors.flatMap((a) =>
      a.needs
        .filter((n) => !['hunger', 'thirst', 'rest', 'safety', 'social'].includes(n.id))
        .map((n) => [n.id, n] as const),
    ),
  );
  for (const n of needs.values()) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = 'any';
    input.dataset.needEffect = n.id;
    input.value = String(jobDraft.needEffects[n.id] ?? 0);
    label.append(n.name + ' befriedigen (0–100)', input);
    custom.append(label);
  }
}
function drawRoute() {
  if (!routeDraft || !data) return;
  el('autonomy-route-form').hidden = false;
  field('autonomy-route-name').value = routeDraft.name;
  field('autonomy-route-duration').value = String(routeDraft.durationSeconds / 60);
  field('autonomy-route-enabled').checked = routeDraft.enabled;
  option('autonomy-route-from', data.locations, routeDraft.fromLocationId);
  option('autonomy-route-to', data.locations, routeDraft.toLocationId);
}
async function saveJob() {
  if (!dirtyJob) return true;
  const owner = editorSession.generation,
    version = edits.job;
  try {
    if (!jobDraft || !data) return false;
    const j = {
      ...jobDraft,
      name: value('autonomy-job-name'),
      kind: value('autonomy-job-kind') as AutonomyJob['kind'],
      locationId: value('autonomy-job-place') || null,
      routeId: value('autonomy-job-route') || null,
      targetActorId: value('autonomy-job-target') || null,
      featureId: value('autonomy-job-feature') || null,
      roomId: value('autonomy-job-room') || null,
      patrolRoomId: value('autonomy-patrol-room') || null,
      speedMetersPerMinute: Number(value('autonomy-job-speed')),
      priority: Number(value('autonomy-job-priority')),
      durationSeconds: Math.round(Number(value('autonomy-job-duration')) * 60),
      roles: value('autonomy-job-roles')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      maxDamage: Number(value('autonomy-job-damage')),
      exclusive: field('autonomy-job-exclusive').checked,
      enabled: field('autonomy-job-enabled').checked,
      needEffects: {
        ...jobDraft.needEffects,
        ...Object.fromEntries(
          [
            ...el('autonomy-custom-effects').querySelectorAll<HTMLInputElement>(
              '[data-need-effect]',
            ),
          ].map((i) => [i.dataset.needEffect!, Number(i.value)]),
        ),
        ...Object.fromEntries(
          ['hunger', 'thirst', 'rest', 'safety', 'social'].map((id) => [
            id,
            Number(value('autonomy-effect-' + id)),
          ]),
        ),
      },
    };
    const old = data.jobs.find((x) => x.id === j.id);
    await command({ kind: 'job', job: j, expectedRevision: old?.revision ?? null });
    jobDraft = structuredClone(data!.jobs.find((x) => x.id === j.id)!);
    dirtyJob = version !== edits.job;
    if (!dirtyJob) drawJob();
    tell('Jobangebot gespeichert.');
    return true;
  } catch (e) {
    if (owner === editorSession.generation) tell((e as Error).message, true);
    return false;
  }
}
async function saveRoute() {
  if (!dirtyRoute) return true;
  const owner = editorSession.generation,
    version = edits.route;
  try {
    if (!routeDraft || !data) return false;
    const r = {
        ...routeDraft,
        name: value('autonomy-route-name'),
        fromLocationId: value('autonomy-route-from'),
        toLocationId: value('autonomy-route-to'),
        durationSeconds: Math.round(Number(value('autonomy-route-duration')) * 60),
        enabled: field('autonomy-route-enabled').checked,
      },
      old = data.routes.find((x) => x.id === r.id);
    await command({ kind: 'route', route: r, expectedRevision: old?.revision ?? null });
    routeDraft = structuredClone(data!.routes.find((x) => x.id === r.id)!);
    dirtyRoute = version !== edits.route;
    if (!dirtyRoute) drawRoute();
    tell('World-Weg gespeichert.');
    return true;
  } catch (e) {
    if (owner === editorSession.generation) tell((e as Error).message, true);
    return false;
  }
}
export function initAutonomy(status: typeof tell) {
  tell = status;
  const decision = document.createElement('section');
  decision.id = 'autonomy-decision';
  decision.className = 'session-group-card';
  decision.hidden = true;
  el('autonomy-summary').insertAdjacentElement('afterend', decision);
  el('autonomy-refresh').onclick = () =>
    run(async () => {
      if (await flushAutonomy()) await openAutonomy();
    });
  field('autonomy-filter').oninput = drawActors;
  el<HTMLSelectElement>('autonomy-state-filter').onchange = drawActors;
  el<HTMLSelectElement>('autonomy-actor').onchange = () =>
    run(async () => {
      const id = value('autonomy-actor');
      if (!(await flushAutonomy()) || !data || !id) return;
      draft = structuredClone(
        data.actors.find((x) => x.id === id) ?? {
          id,
          revision: 1,
          enabled: false,
          paused: false,
          role: '',
          needs: standardNeeds(),
          jobPriorities: {},
          assignedJobId: null,
          allowConflict: false,
          defense: 12,
          attackBonus: 0,
          maxHpLossPercent: 10,
          cursor: 0,
          offsetSeconds: 0,
          jobId: null,
          progressSeconds: 0,
          pending: null,
        },
      );
      drawActor();
    });
  el('autonomy-actor-form').addEventListener('input', () => {
    dirty = true;
    edits.actor++;
  });
  el<HTMLFormElement>('autonomy-actor-form').onsubmit = (e) => {
    e.preventDefault();
    dirty = true;
    run(saveActor);
  };
  el('autonomy-add-need').onclick = () => {
    if (!draft) return;
    draft = actorInput();
    const name = value('autonomy-new-need-name').trim();
    if (!name) return;
    draft.needs.push({
      id: crypto.randomUUID(),
      name,
      enabled: true,
      value: 0,
      ratePerHour: 1,
      weight: 1,
    });
    drawActor();
    dirty = true;
    edits.actor++;
  };
  el('autonomy-job-new').onclick = () =>
    run(async () => {
      if (!(await flushAutonomy())) return;
      jobDraft = newJob();
      dirtyJob = false;
      drawJob();
    });
  el<HTMLFormElement>('autonomy-job-form').onsubmit = (e) => {
    e.preventDefault();
    dirtyJob = true;
    run(saveJob);
  };
  el('autonomy-job-form').addEventListener('input', () => {
    dirtyJob = true;
    edits.job++;
  });
  el<HTMLSelectElement>('autonomy-job-kind').onchange = () => {
    if (['patrol', 'move', 'conflict', 'reset'].includes(value('autonomy-job-kind')))
      el<HTMLDetailsElement>('autonomy-job-special').open = true;
  };
  el('autonomy-route-new').onclick = () =>
    run(async () => {
      if (!(await flushAutonomy())) return;
      dirtyRoute = false;
      routeDraft = {
        id: crypto.randomUUID(),
        revision: 1,
        name: 'Neuer Weg',
        fromLocationId: '',
        toLocationId: '',
        durationSeconds: 600,
        enabled: true,
      };
      drawRoute();
    });
  el<HTMLFormElement>('autonomy-route-form').onsubmit = (e) => {
    e.preventDefault();
    dirtyRoute = true;
    run(saveRoute);
  };
  el('autonomy-route-form').addEventListener('input', () => {
    dirtyRoute = true;
    edits.route++;
  });
  el('autonomy-place-now').onclick = () =>
    run(async () => {
      if (!(await flushAutonomy()) || !draft || !data) return;
      const a = data.actors.find((a) => a.id === draft!.id);
      if (!a) throw new Error('NPC zuerst aktivieren.');
      const reason = value('autonomy-place-reason').trim();
      if (!reason) throw new Error('GM-Platzierung begründen.');
      await command({
        kind: 'place',
        actorId: a.id,
        locationId: value('autonomy-direct-place'),
        expectedPositionRevision: a.positionRevision,
        reason,
      });
    });
  el('autonomy-cancel-run').onclick = () => {
    catchupRequest++;
    if (activeRun) activeRun.cancelled = true;
  };
  el('autonomy-catchup').onclick = () =>
    run(async () => {
      if (activeRun) return;
      const owner = editorSession.generation,
        request = ++catchupRequest;
      if (
        !(await flushAutonomy()) ||
        owner !== editorSession.generation ||
        request !== catchupRequest ||
        activeRun ||
        !data
      )
        return;
      const session = { cancelled: false };
      activeRun = session;
      el<HTMLButtonElement>('autonomy-catchup').disabled = true;
      el('autonomy-progress').textContent =
        'Nachholen gestartet · erster atomarer NPC-Schritt läuft';
      try {
        let total = 0;
        for (
          let chunk = 0;
          chunk < 1000 && !session.cancelled && owner === editorSession.generation;
          chunk++
        ) {
          const location = value('autonomy-context'),
            ids = data!.actors
              .filter(
                (a) =>
                  a.enabled &&
                  !a.paused &&
                  (!location || a.locationId === location) &&
                  a.remaining > 0,
              )
              .map((a) => a.id);
          if (!ids.length) break;
          const r = await command({ kind: 'catch-up', actorIds: ids, maxSteps: 12 });
          total += r.progressed;
          el('autonomy-progress').textContent =
            total + ' atomare NPC-Schritte bestätigt · ' + r.pending + ' Akteure mit Restzeit';
          if (!r.progressed) break;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (owner === editorSession.generation)
          tell(
            session.cancelled
              ? 'Nachholen angehalten. Bereits bestätigte Schritte bleiben erhalten.'
              : 'Bestätigte Zeit verarbeitet; Entscheidungsgrenzen bleiben pausiert.',
          );
      } finally {
        if (activeRun === session) {
          activeRun = null;
          el<HTMLButtonElement>('autonomy-catchup').disabled = false;
        }
      }
    });
}

editorSession.observeDraft(() => ({
  openInput: dirty || dirtyJob || dirtyRoute,
  retainedDraft: false,
  unresolvedCommand: false,
}));
