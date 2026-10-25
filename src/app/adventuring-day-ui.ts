import { renderDayLevels } from './adventuring-day-levels-ui';
import { bindAnchoredPopup } from './anchored-popup';
import type { WorkspaceGeometry } from './contracts';
import type { DayView } from './adventuring-day-contracts';
import { onProgressChanged } from './progression-ui';
import { renderDayPacing } from './adventuring-day-pacing-ui';
import {
  initDayItinerary,
  activateDayItinerary,
  dayItineraryRequest,
  renderDayItinerary,
  dayItineraryDraft,
  refreshDayItineraryChoices,
} from './adventuring-day-itinerary-ui';
import { dayDraftKey, readDayDraft, type DayDraft } from './adventuring-day-draft';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const number = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
let workspace: WorkspaceGeometry | null = null,
  source: 'active' | 'custom' = 'active',
  mode: 'budget' | 'progress' = 'budget',
  rows: { level: string; count: string }[] = [],
  generation = 0,
  timer: ReturnType<typeof setTimeout> | null = null,
  tell: (s: string, error?: boolean) => void;
let draftBlocked = false;
let customRows: typeof rows | null = null;
function keepDraft() {
  if (source === 'custom') customRows = rows.map((r) => ({ ...r }));
  const id = workspace?.campaign?.id;
  if (!id || draftBlocked) return;
  try {
    const draft: DayDraft = {
      version: 1,
      source,
      mode,
      hasCustomRows: customRows !== null,
      rows: customRows ?? [],
      itinerary: dayItineraryDraft(),
    };
    const raw = JSON.stringify(draft);
    readDayDraft(raw);
    window.localStorage.setItem(dayDraftKey(id), raw);
    el('day-draft-status').textContent = 'Planung auf diesem Gerät gesichert.';
  } catch {
    el('day-draft-status').textContent =
      'Planung konnte auf diesem Gerät nicht gesichert werden. Eingaben vor dem Schließen kopieren.';
  }
}
function edited() {
  keepDraft();
  schedule();
}
// Keep editing text until the calculation boundary; an empty field is not zero.
const numericDraft = (value: string) => (value.trim() ? Number(value) : NaN);
const opened = () => el('day-popover').matches(':popover-open');
function state() {
  el('day-active').setAttribute('aria-pressed', String(source === 'active'));
  el('day-custom').setAttribute('aria-pressed', String(source === 'custom'));
  el('day-source').textContent =
    source === 'active'
      ? 'Aktive Party · bestätigte XP'
      : 'Eigene Planung · verändert die aktive Party nicht';
  el('day-pacing').hidden = source !== 'active';
  el('day-current-details').hidden = source !== 'active';
  el('day-progress-inputs').hidden = mode !== 'progress';
  el('day-reward-field').hidden = !el<HTMLInputElement>('day-separate-reward').checked;
  for (const m of ['budget', 'progress'])
    el('day-mode-' + m).setAttribute('aria-pressed', String(mode === m));
}
function renderRows() {
  const root = el('day-rows');
  root.replaceChildren();
  for (const [i, row] of rows.entries()) {
    const line = document.createElement('div');
    line.className = 'day-row';
    const level = document.createElement('input'),
      count = document.createElement('input'),
      remove = document.createElement('button');
    level.type = count.type = 'number';
    level.min = count.min = '1';
    level.max = '20';
    count.max = '99';
    level.step = count.step = '1';
    level.value = row.level;
    level.placeholder = 'Level offen';
    count.value = row.count;
    level.setAttribute('aria-label', 'Level Zeile ' + (i + 1));
    count.setAttribute('aria-label', 'Anzahl Zeile ' + (i + 1));
    remove.type = 'button';
    remove.textContent = 'Entfernen';
    level.oninput = () => {
      row.level = level.value;
      source = 'custom';
      state();
      edited();
    };
    count.oninput = () => {
      row.count = count.value;
      source = 'custom';
      state();
      edited();
    };
    remove.onclick = () => {
      rows.splice(i, 1);
      source = 'custom';
      state();
      renderRows();
      edited();
    };
    const field = (title: string, input: HTMLInputElement) => {
      const label = document.createElement('label');
      label.append(document.createTextNode(title), input);
      return label;
    };
    line.append(field('Level', level), field('Anzahl', count), remove);
    root.append(line);
  }
}
function table(root: HTMLElement, headings: string[], values: string[][], current?: () => boolean) {
  const t = document.createElement('table'),
    head = document.createElement('tr');
  for (const title of headings) {
    const th = document.createElement('th');
    th.textContent = title;
    head.append(th);
  }
  t.append(head);
  let shown = 0;
  const append = () => {
    if (current && !current()) return;
    const end = current ? Math.min(shown + 40, values.length) : values.length;
    for (const cells of values.slice(shown, end)) {
      const tr = document.createElement('tr');
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      t.append(tr);
    }
    shown = end;
  };
  append();
  root.append(t);
  if (current && values.length > 40) {
    const count = document.createElement('p'),
      more = document.createElement('button');
    more.type = 'button';
    const status = () => {
      count.textContent =
        shown +
        ' von ' +
        values.length +
        ' Figuren angezeigt; Summen berücksichtigen alle Figuren.';
      more.textContent = 'Weitere ' + Math.min(40, values.length - shown) + ' Figuren';
      more.hidden = shown === values.length;
    };
    more.onclick = () => {
      if (!more.isConnected || !current()) return;
      append();
      status();
    };
    status();
    root.append(count, more);
  }
}
function draw(value: DayView) {
  el('day-popover').setAttribute('aria-busy', 'false');
  el('day-trigger').setAttribute('aria-busy', 'false');
  const snapshot = value.snapshot;
  el('day-trigger').textContent = !snapshot.partySize
    ? 'Kein Rastbudget'
    : !snapshot.available
      ? 'Rastbudget offen'
      : 'SR ' + number(snapshot.shortXp!) + ' · LR ' + number(snapshot.longXp!);
  el('day-trigger').title = snapshot.available
    ? 'Bisherige XP-Belastung seit kurzer/langer Rast · Tagesbudget ' +
      number(snapshot.dailyBudget!)
    : snapshot.reason;
  el('party-shortcut').textContent = snapshot.partySize
    ? snapshot.partySize +
      ' Figuren · ' +
      (snapshot.averageLevel === null ? 'Level offen' : 'Ø Level ' + number(snapshot.averageLevel))
    : 'Party öffnen';
  if (!opened()) return;
  const lease = generation,
    token = workspace?.token,
    current = () => workspace?.token === token && generation === lease && opened();
  renderDayItinerary(value.itinerary, current);
  renderDayPacing(el('day-pacing'), value.pacing, source === 'active' && mode === 'progress');
  el('day-status').textContent = value.problem ?? (source === 'active' ? snapshot.reason : '');
  if (source === 'active') {
    rows = snapshot.rows.map((r) => ({
      level: r.level === null ? '' : String(r.level),
      count: String(r.count),
    }));
    renderRows();
  }
  state();
  const summary = el('day-summary'),
    timeline = el('day-timeline'),
    party = el('day-current');
  summary.replaceChildren();
  timeline.replaceChildren();
  party.replaceChildren();
  if (snapshot.members.length) {
    table(
      party,
      ['Aktuelle Figur', 'Level', 'SR / LR verbraucht', 'Bis nächste Marke / LR'],
      snapshot.members.map((c) => [
        c.name,
        c.level === null ? 'offen' : String(c.level),
        c.restKnown ? number(c.shortXp) + ' / ' + number(c.longXp) : 'Rast offen',
        c.nextShort === null ? 'offen' : number(c.nextShort) + ' / ' + number(c.remainingLong!),
      ]),
      current,
    );
  }
  renderDayLevels(el('day-levels'), value.advancement, {
    progress: mode === 'progress',
    itinerary: !!value.itinerary,
    current,
    choose: (pool) => {
      if (!current() || dayItineraryRequest() !== undefined) return;
      mode = 'progress';
      el<HTMLInputElement>('day-separate-reward').checked = true;
      el<HTMLInputElement>('day-reward-xp').value = String(pool);
      state();
      edited();
      el<HTMLInputElement>('day-reward-xp').focus();
    },
  });
  const c = value.calculation;
  if (!c) return;
  const heading = document.createElement('h3');
  heading.textContent = 'Tagesmodell ab langer Rast';
  summary.append(heading);
  const facts = document.createElement('p');
  facts.className = 'day-budget';
  facts.textContent =
    number(c.partySize) + ' Figuren · ' + number(c.dailyBudget) + ' XP Tagesbudget';
  summary.append(facts);
  const budgetTables = document.createElement('div');
  summary.append(budgetTables);
  table(budgetTables, ['Kurze Rast 1', 'Kurze Rast 2', 'Lange Rast'], [c.milestones.map(number)]);
  table(budgetTables, ['Leicht', 'Mittel', 'Schwer', 'Tödlich'], [c.thresholds.map(number)]);
  if (mode === 'progress') {
    const progress = document.createElement('p');
    progress.id = 'day-progress-summary';
    progress.textContent =
      number(c.completedDays) +
      ' volle Tage · ' +
      number(c.dayProgress * 100) +
      ' % des nächsten Tags · ' +
      number(c.shortRests) +
      ' kurze / ' +
      number(c.longRests) +
      ' lange Rasten';
    summary.insertBefore(progress, budgetTables);
    const xp = document.createElement('p');
    xp.textContent =
      'Verdienst: ' +
      number(c.shareXp) +
      ' XP je Figur · insgesamt ' +
      number(c.totalAwardXp) +
      ' XP nach aufgerundeter Verteilung';
    summary.insertBefore(xp, budgetTables);
    table(
      summary,
      ['Figur / Startlevel', 'Anzahl', 'XP vorher → danach', 'Level vorher → danach'],
      c.projections.map((p) => [
        p.name,
        String(p.count),
        number(p.beforeXp) + ' → ' + number(p.afterXp),
        p.beforeLevel + ' → ' + p.afterLevel,
      ]),
      current,
    );
    for (const event of c.timeline) {
      const li = document.createElement('li');
      li.textContent = event.label + ' · bei ' + number(event.xp) + ' Gruppen-XP';
      timeline.append(li);
    }
  }
  el('day-timeline-card').hidden = mode !== 'progress';
}
async function refresh() {
  // An immediate read (opening or choosing the party) consumes queued edits.
  // Otherwise their old timer repeats this read, including after a failure.
  if (timer) clearTimeout(timer);
  timer = null;
  const owner = workspace,
    request = ++generation;
  if (!owner) return;
  const open = opened(),
    input = {
      source: open ? source : ('active' as const),
      rows: open
        ? rows.map((r) => ({
            level: numericDraft(r.level),
            count: numericDraft(r.count),
          }))
        : [],
      totalXp:
        open && mode === 'progress' ? numericDraft(el<HTMLInputElement>('day-total-xp').value) : 0,
      ...(open && mode === 'progress' && el<HTMLInputElement>('day-separate-reward').checked
        ? {
            rewardXp: numericDraft(el<HTMLInputElement>('day-reward-xp').value),
          }
        : {}),
      ...(open && dayItineraryRequest() !== undefined ? { encounters: dayItineraryRequest() } : {}),
    };
  if (open) {
    el('day-popover').setAttribute('aria-busy', 'true');
    el('day-trigger').setAttribute('aria-busy', 'true');
    el('day-trigger').textContent = 'Rastbudget wird geladen…';
    el('day-status').textContent = 'Rastbudget wird geladen…';
    renderDayItinerary(undefined);
  }
  try {
    const result = await window.campaign.adventuringDay(owner.token, input);
    if (owner.token !== workspace?.token || request !== generation) return;
    if (!result.ok) throw new Error(result.error);
    draw(result.value);
  } catch (error) {
    if (owner.token !== workspace?.token || request !== generation) return;
    el('day-trigger').textContent = 'Rastbudget nicht verfügbar';
    el('day-trigger').setAttribute('aria-busy', 'false');
    el('day-popover').setAttribute('aria-busy', 'false');
    if (opened()) {
      for (const id of ['day-summary', 'day-timeline', 'day-current', 'day-pacing', 'day-levels'])
        el(id).replaceChildren();
      el('day-status').textContent = (error as Error).message;
    }
  }
}
function schedule() {
  generation++;
  if (timer) clearTimeout(timer);
  if (opened()) {
    el('day-trigger').setAttribute('aria-busy', 'true');
    el('day-trigger').textContent = 'Rastbudget wird geladen…';
    el('day-popover').setAttribute('aria-busy', 'true');
    renderDayItinerary(undefined);
    el('day-status').textContent = 'Berechnung wird aktualisiert…';
  }
  timer = setTimeout(() => {
    timer = null;
    void refresh();
  }, 120);
}
export function activateDayCalculator(next: WorkspaceGeometry | null) {
  workspace = next;
  generation++;
  if (timer) clearTimeout(timer);
  timer = null;
  if (opened()) el('day-popover').hidePopover();
  rows = [];
  customRows = null;
  source = 'active';
  mode = 'budget';
  el<HTMLInputElement>('day-total-xp').value = '0';
  el<HTMLInputElement>('day-reward-xp').value = '0';
  el<HTMLInputElement>('day-separate-reward').checked = false;
  draftBlocked = false;
  let draft: DayDraft | undefined;
  el('day-draft-status').textContent = 'Planung wird auf diesem Gerät pro Kampagne gesichert.';
  if (next?.campaign?.id)
    try {
      const raw = window.localStorage.getItem(dayDraftKey(next.campaign.id));
      if (raw !== null) {
        draft = readDayDraft(raw);
        source = draft.source;
        mode = draft.mode;
        customRows =
          draft.source === 'custom' || draft.hasCustomRows
            ? draft.rows.map((r) => ({ ...r }))
            : null;
        rows = source === 'custom' ? (customRows ?? []) : [];
        el('day-draft-status').textContent =
          'Gesicherte Planung wieder aufgenommen · Ergebnisse werden neu berechnet.';
      }
    } catch {
      draftBlocked = true;
      el('day-draft-status').textContent =
        'Gesicherte Planung nicht lesbar. Sie bleibt erhalten. Neue Eingaben werden erst nach „Planung zurücksetzen“ gesichert.';
    }
  activateDayItinerary(next, draft?.itinerary);
  el<HTMLButtonElement>('day-trigger').disabled = !next;
  el('day-trigger').textContent = 'Rastbudget';
  el('day-trigger').setAttribute('aria-busy', 'false');
  el('day-popover').setAttribute('aria-busy', 'false');
  el('day-levels').replaceChildren();
  el('day-levels').hidden = true;
  el('day-pacing').replaceChildren();
  for (const id of ['day-summary', 'day-timeline', 'day-current']) el(id).replaceChildren();
  el('party-shortcut').textContent = 'Party öffnen';
  renderRows();
  state();
  if (next) void refresh();
}
export function initDayCalculator(
  status: typeof tell,
  openParty: () => void,
  openEncounters: () => void = () => {},
) {
  initDayItinerary(() => {
    state();
    edited();
  });
  tell = status;
  const popup = bindAnchoredPopup(el<HTMLButtonElement>('day-trigger'), el('day-popover'), 1080);
  el('day-trigger').onclick = () => {
    if (popup.toggle()) {
      refreshDayItineraryChoices();
      void refresh();
    }
  };
  // Scrolling toward the answer must not step the number being edited.
  el('day-popover').addEventListener(
    'wheel',
    (event) => {
      const field = (event.target as Element).closest<HTMLInputElement>('input[type=number]');
      if (field && field === document.activeElement) field.blur();
    },
    { capture: true, passive: true },
  );
  el('day-close').onclick = popup.close;
  el('day-plan-open-encounters').onclick = () => {
    popup.close();
    openEncounters();
  };
  el('day-party-open').onclick = () => {
    el('day-popover').hidePopover();
    openParty();
  };
  el('day-active').onclick = () => {
    source = 'active';
    state();
    keepDraft();
    void refresh();
  };
  el('day-custom').onclick = () => {
    rows = (customRows ?? rows).map((r) => ({ ...r }));
    source = 'custom';
    state();
    renderRows();
    edited();
  };
  el('day-add').onclick = () => {
    if (rows.length >= 20) {
      tell('Höchstens 20 Rechnerzeilen.', true);
      return;
    }
    rows.push({ level: '1', count: '1' });
    source = 'custom';
    state();
    renderRows();
    edited();
  };
  el('day-clear').onclick = () => {
    rows = [];
    source = 'custom';
    state();
    renderRows();
    edited();
  };
  for (const m of ['budget', 'progress'] as const)
    el('day-mode-' + m).onclick = () => {
      mode = m;
      state();
      edited();
    };
  for (const id of ['day-total-xp', 'day-reward-xp', 'day-separate-reward'])
    el(id).addEventListener('input', () => {
      state();
      edited();
    });
  el('day-draft-reset').onclick = () => {
    const owner = workspace;
    if (!owner) return;
    try {
      window.localStorage.removeItem(dayDraftKey(owner.campaign.id));
    } catch {
      el('day-draft-status').textContent =
        'Planung konnte nicht zurückgesetzt werden. Gespeicherte Eingaben bleiben erhalten.';
      return;
    }
    activateDayCalculator(owner);
    popup.open();
    void refresh();
  };
  onProgressChanged(schedule);
  document.addEventListener('campaign-party-changed', schedule);
  state();
}
