import type { GraphView, GraphAction, GraphLayout } from './graph-contracts';
import { budgetRarities, type DungeonBudgetSetting } from './dungeon-budget-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T,
  field = (id: string) => el<HTMLInputElement>(id);
const ids = [
  'graph-budget-level',
  'graph-budget-sessions',
  'graph-budget-party',
  'graph-budget-day',
  'graph-budget-reward',
] as const;
type Fields = { values: string[]; muted: boolean };
type Draft = { fields: Fields; baseline: Fields; base: GraphLayout };
let data: GraphView | null = null,
  command: (action: GraphAction) => Promise<GraphView>,
  run: (fn: () => Promise<void>) => void;
const drafts = new Map<string, Draft>(),
  saving = new Map<string, symbol>();
const money = (value: string) => {
  const n = BigInt(value);
  return (n / 100n).toString() + ',' + (n % 100n).toString().padStart(2, '0') + ' GP';
};
const equal = (a: Fields, b: Fields) =>
  a.muted === b.muted && a.values.every((v, i) => v === b.values[i]);
const fields = (v: DungeonBudgetSetting): Fields => ({
  values: [v.level, v.sessions, v.partySize, v.dayFraction, v.rewardXpPerSession].map((v) =>
    v === null ? '' : String(v),
  ),
  muted: v.mutedWarnings,
});
function selected() {
  return data?.budget?.scopes.find((s) => s.ownerId === field('graph-budget-scope').value);
}
function read(): Fields {
  return { values: ids.map((id) => field(id).value), muted: field('graph-budget-mute').checked };
}
function remember() {
  const s = selected();
  if (!s || !data) return;
  const raw = read(),
    prior = drafts.get(s.ownerId);
  const baseline = prior?.baseline ?? fields(s.settings);
  if (equal(raw, baseline) && !saving.has(s.ownerId)) {
    drafts.delete(s.ownerId);
    return;
  }
  drafts.set(s.ownerId, { fields: raw, baseline, base: prior?.base ?? data.layout });
}
function form() {
  const s = selected();
  if (!s) return;
  const raw = drafts.get(s.ownerId)?.fields ?? fields(s.settings);
  ids.forEach((id, i) => (field(id).value = raw.values[i]!));
  field('graph-budget-mute').checked = raw.muted;
  el('graph-budget-inheritance').textContent =
    'Wirksam: Level ' +
    (s.level ?? 'offen') +
    ' aus ' +
    s.levelOrigin +
    ' · ' +
    s.partySize +
    ' Charaktere · ' +
    s.dayFraction +
    ' Adventure Day pro Spielabend · ' +
    s.rewardXpPerSession +
    ' geplante Beute-XP pro Abend. Leere Level-/Party-/Tagesfelder erben; Sessionanteile bleiben ausdrücklich unzugeteilt.' +
    (drafts.size ? ' · ' + drafts.size + ' Bereich(e) mit offenen Eingaben.' : '');
}
export function resetDungeonBudget() {
  data = null;
  drafts.clear();
  saving.clear();
}
export function hasDungeonBudgetDrafts() {
  return drafts.size > 0;
}
export function confirmDungeonBudget(view: GraphView, base: GraphLayout | null) {
  data = view;
  if (!base) return;
  for (const [id, draft] of drafts)
    if (
      draft.base.id === base.id &&
      draft.base.revision === base.revision &&
      !!draft.base.stored === !!base.stored
    ) {
      draft.base = view.layout;
      const own = view.budget?.scopes.find((s) => s.ownerId === id);
      if (own) draft.baseline = fields(own.settings);
      if (equal(draft.fields, draft.baseline)) drafts.delete(id);
    }
}
function submit(clear: boolean) {
  const s = selected();
  if (!s || !data) return;
  const ownerId = s.ownerId,
    raw = read(),
    prior = drafts.get(ownerId),
    base = prior?.base ?? data.layout;
  const number = (i: number) => (raw.values[i] === '' ? null : Number(raw.values[i]));
  const value: DungeonBudgetSetting = {
    ownerId,
    level: number(0),
    sessions: number(1),
    partySize: number(2),
    dayFraction: raw.values[3] || null,
    rewardXpPerSession: number(4),
    mutedWarnings: raw.muted,
  };
  const layout = structuredClone(base);
  layout.budgets = (layout.budgets ?? []).filter((v) => v.ownerId !== ownerId);
  if (!clear) layout.budgets.push(value);
  run(async () => {
    const marker = Symbol('budget save');
    saving.set(ownerId, marker);
    try {
      const confirmed = await command({
        kind: 'graph-layout',
        layout,
        expectedRevision: base.stored ? base.revision : null,
      });
      const current = drafts.get(ownerId);
      if (current && equal(current.fields, raw)) drafts.delete(ownerId);
      else if (current) {
        const own = confirmed.budget?.scopes.find((s) => s.ownerId === ownerId);
        if (own && equal(current.fields, fields(own.settings))) drafts.delete(ownerId);
      }
      form();
    } finally {
      if (saving.get(ownerId) === marker) saving.delete(ownerId);
    }
  });
}
export function initDungeonBudget(send: typeof command, queue: typeof run) {
  command = send;
  run = queue;
  el('graph-budget-scope').onchange = form;
  for (const id of [...ids, 'graph-budget-mute']) {
    el(id).addEventListener('input', remember);
    el(id).addEventListener('change', remember);
  }
  el('graph-budget-save').onclick = () => submit(false);
  el('graph-budget-clear').onclick = () => submit(true);
  el('graph-budget-discard').onclick = () => {
    const s = selected();
    if (s) drafts.delete(s.ownerId);
    form();
  };
}
export function drawDungeonBudget(view: GraphView) {
  data = view;
  const select = el<HTMLSelectElement>('graph-budget-scope'),
    prior = select.value;
  select.replaceChildren();
  for (const s of view.budget?.scopes ?? []) {
    const o = document.createElement('option');
    o.value = s.ownerId;
    o.textContent =
      ({ dungeon: 'Dungeon', level: 'Level', group: 'Bereich' } as const)[s.kind] + ': ' + s.name;
    select.append(o);
  }
  select.value =
    prior && view.budget?.scopes.some((s) => s.ownerId === prior)
      ? prior
      : (view.budget?.scopes[0]?.ownerId ?? '');
  form();
  el('graph-budget-preset').textContent = view.budget
    ? 'Beute-Fortschritt: ' +
      view.budget.preset.name +
      ' · Revision ' +
      view.budget.preset.revision +
      '; Gefahr: DMG 2014 / Adventure Day. Angepasste Gefahr-XP und Beute-XP bleiben getrennt.'
    : 'Keine Budgetbasis.';
  const list = el('graph-budget-results');
  list.replaceChildren();
  for (const s of view.budget?.scopes ?? []) {
    const card = document.createElement('article'),
      heading = document.createElement('h3'),
      sessions = document.createElement('p'),
      table = document.createElement('table'),
      caption = document.createElement('caption');
    heading.textContent = s.name;
    sessions.textContent =
      (s.allocatedSessions === null
        ? 'Keine eigene Sessionzuteilung'
        : s.allocatedSessions + ' Spielabende zugeteilt') +
      ' · Unterbereiche ' +
      s.childSessions +
      ' · nicht zugeteilt ' +
      (s.unallocatedSessions ?? '—') +
      ' · ' +
      s.contentRooms +
      ' Inhaltsräume / ' +
      s.roomCount +
      ' Räume';
    caption.textContent =
      s.allocatedSessions === null
        ? 'Eigene Heatmap neutral; Ziele aus zugeteilten Unterbereichen werden nur hochgerechnet.'
        : 'Ziele rollen mit Unterbereichen ohne Doppelzählung hoch.';
    table.append(caption);
    const header = document.createElement('tr');
    for (const label of ['Größe', 'Platziert / verfügbar', 'Geplantes Soll']) {
      const th = document.createElement('th');
      th.textContent = label;
      header.append(th);
    }
    table.append(header);
    const rows = [
      [
        'Gefahr-XP (angepasst)',
        String(s.actual.adjustedXp) + (s.actual.unknownDanger ? ' + unbekannte Gefahren' : ''),
        (s.targetComplete ? '' : '≥ ') + s.targets.adjustedXp,
      ],
      ['Beute-XP (Basis)', String(s.actual.baseXp), String(s.targets.baseXp)],
      [
        'Nichtmagische Beute',
        money(s.actual.goldCopper) + (s.actual.unknownGold ? ' + unbekannte Werte' : ''),
        money(s.targets.goldCopper),
      ],
      ...budgetRarities.map((r) => [
        'Magie · ' + r,
        String(s.actual.magic[r]),
        s.targets.magic[r].toFixed(2),
      ]),
      [
        'Curiosities / Rätsel',
        s.counts.curiosities + ' / ' + s.counts.puzzles,
        'Anzahl und Dichte; keine Qualitätswertung',
      ],
    ];
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const text of row) {
        const td = document.createElement('td');
        td.textContent = String(text);
        tr.append(td);
      }
      table.append(tr);
    }
    card.append(heading, sessions, table);
    if (s.warnings.length) {
      const details = document.createElement('details'),
        summary = document.createElement('summary');
      summary.textContent = s.muted
        ? 'GM hat Hinweise für diesen Bereich ausgeblendet'
        : s.warnings.length + ' erklärbare Hinweise';
      details.open = !s.muted;
      details.append(summary);
      for (const warning of s.warnings) {
        const p = document.createElement('p');
        p.textContent = warning;
        details.append(p);
      }
      card.append(details);
    }
    list.append(card);
  }
  const problems = el('graph-budget-feature-problems');
  problems.replaceChildren();
  for (const f of view.budget?.facts.filter((f) => f.problem) ?? []) {
    const p = document.createElement('p');
    p.textContent = f.title + ': ' + f.problem;
    problems.append(p);
  }
}
