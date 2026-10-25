import type { WorkspaceGeometry } from '../shared/contracts';
import type { DayPlanEntry, DayItinerary, DayItineraryStage } from './adventuring-day-contracts';
import type { DayItineraryDraft } from './adventuring-day-draft';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const format = (n: number) => n.toLocaleString('de-DE');
type Choice = {
  id: string;
  revision: number;
  name: string;
  count: string;
  restBefore?: 'short' | 'long';
};
let workspace: WorkspaceGeometry | null = null,
  selected: Choice[] = [],
  generation = 0,
  timer: ReturnType<typeof setTimeout> | null = null,
  changed: () => void;
let manual = { load: '0', reward: '0', separate: false };
let editRevision = 0;
const enabled = () => el<HTMLInputElement>('day-use-encounters').checked;
const node = (tag: string, text?: string) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  return n;
};
const button = (label: string, run: () => void) => {
  const b = node('button', label) as HTMLButtonElement;
  b.type = 'button';
  b.onclick = run;
  return b;
};
function notify() {
  editRevision++;
  el('day-plan-edit-status').textContent = '';
  el('day-plan-result').replaceChildren();
  if (enabled()) {
    el<HTMLInputElement>('day-total-xp').value = '';
    el<HTMLInputElement>('day-reward-xp').value = '';
  }
  changed();
}
function inputs() {
  const on = enabled();
  el<HTMLInputElement>('day-total-xp').readOnly = on;
  el<HTMLInputElement>('day-reward-xp').readOnly = on;
  el<HTMLInputElement>('day-separate-reward').disabled = on;
  el('day-plan-controls').hidden = !on;
}
function renderSelected() {
  const root = el('day-plan-selected');
  root.replaceChildren();
  selected.forEach((entry, i) => {
    const row = node('div'),
      name = node('strong', entry.name),
      label = node('label', 'Anzahl'),
      count = document.createElement('input');
    row.className = 'day-plan-row';
    row.dataset.planId = entry.id;
    count.type = 'number';
    count.min = '1';
    count.max = '99';
    count.step = '1';
    count.value = entry.count;
    count.setAttribute('aria-label', 'Wiederholungen ' + entry.name);
    count.oninput = () => {
      entry.count = count.value;
      notify();
    };
    label.append(count);
    const up = button('↑', () => {
        [selected[i - 1], selected[i]] = [selected[i]!, selected[i - 1]!];
        renderSelected();
        notify();
      }),
      down = button('↓', () => {
        [selected[i + 1], selected[i]] = [selected[i]!, selected[i + 1]!];
        renderSelected();
        notify();
      });
    up.disabled = i === 0;
    down.disabled = i === selected.length - 1;
    up.setAttribute('aria-label', entry.name + ' nach oben');
    down.setAttribute('aria-label', entry.name + ' nach unten');
    const restLabel = node('label', 'Davor'),
      rest = document.createElement('select');
    rest.setAttribute('aria-label', 'Rast vor ' + entry.name);
    for (const [value, text] of [
      ['none', 'Ohne Rast'],
      ['short', 'Kurze Rast'],
      ['long', 'Lange Rast'],
    ]) {
      const option = document.createElement('option');
      option.value = value!;
      option.textContent = text!;
      rest.append(option);
    }
    const selectedOption = [...rest.options].find(
      (option) => option.value === (entry.restBefore ?? 'none'),
    );
    if (selectedOption) selectedOption.selected = true;
    rest.onchange = () => {
      entry.restBefore = rest.value === 'none' ? undefined : (rest.value as 'short' | 'long');
      notify();
    };
    restLabel.append(rest);
    const actions = node('div');
    actions.className = 'toolbar';
    actions.append(
      up,
      down,
      button('Entfernen', () => {
        selected.splice(i, 1);
        renderSelected();
        notify();
      }),
    );
    row.append(name, label, restLabel, actions);
    root.append(row);
  });
  if (!selected.length)
    root.textContent =
      'Noch keine Begegnungen gewählt. Suche gespeicherte Vorlagen und füge sie dem Tagesplan hinzu.';
}
function pendingChoices(message: string) {
  el('day-plan-matches').replaceChildren();
  el('day-plan-matches').setAttribute('aria-busy', 'true');
  el('day-plan-search-status').textContent = message;
}
async function search() {
  const owner = workspace,
    request = ++generation;
  if (!owner) return;
  pendingChoices('Vorlagen werden geladen…');
  try {
    const result = await window.campaign.encounterPlans(
      owner.token,
      el<HTMLInputElement>('day-plan-search').value,
    );
    if (workspace?.token !== owner.token || request !== generation) return;
    if (!result.ok) throw new Error(result.error);
    const root = el('day-plan-matches');
    root.replaceChildren();
    root.setAttribute('aria-busy', 'false');
    for (const plan of result.value.slice(0, 40)) {
      const choice = button(plan.name + ' · hinzufügen', () => {
        if (
          workspace?.token !== owner.token ||
          request !== generation ||
          !enabled() ||
          !choice.isConnected
        )
          return;
        if (selected.length >= 20) {
          el('day-plan-search-status').textContent =
            'Höchstens 20 Planzeilen. Für Wiederholungen die Anzahl ändern.';
          return;
        }
        selected.push({ ...plan, count: '1' });
        renderSelected();
        notify();
      });
      root.append(choice);
    }
    el('day-plan-search-status').textContent =
      result.value.length > 40
        ? 'Erste 40 Treffer. Suche genauer, um weitere Vorlagen zu finden.'
        : result.value.length
          ? 'Nur gespeicherte Vorlagen. Änderungen im Encounter-Editor zuerst speichern.'
          : 'Keine passenden gespeicherten Vorlagen.';
  } catch (error) {
    if (workspace?.token === owner.token && request === generation) {
      el('day-plan-matches').replaceChildren();
      el('day-plan-matches').setAttribute('aria-busy', 'false');
      el('day-plan-search-status').textContent = (error as Error).message;
    }
  }
}
async function reload() {
  const owner = workspace,
    request = ++generation;
  if (!owner) return;
  pendingChoices('Gewählte Vorlagen werden aktualisiert…');
  try {
    const result = await window.campaign.encounterPlans(owner.token, '');
    if (workspace?.token !== owner.token || request !== generation) return;
    if (!result.ok) throw new Error(result.error);
    const versions = new Map(result.value.map((p) => [p.id, p]));
    for (const entry of selected) {
      const latest = versions.get(entry.id);
      if (!latest)
        throw new Error(
          'Gewählte Vorlage fehlt: ' +
            entry.name +
            '. Entfernen oder im Encounter-Editor wiederherstellen.',
        );
    }
    selected = selected.map((entry) => ({ ...entry, ...versions.get(entry.id)! }));
    renderSelected();
    notify();
    void search();
  } catch (error) {
    if (workspace?.token === owner.token && request === generation) {
      el('day-plan-matches').setAttribute('aria-busy', 'false');
      el('day-plan-search-status').textContent = (error as Error).message;
    }
  }
}
export function dayItineraryRequest(): DayPlanEntry[] | undefined {
  return enabled()
    ? selected.map((p) => ({
        id: p.id,
        revision: p.revision,
        count: p.count.trim() ? Number(p.count) : NaN,
        ...(p.restBefore ? { restBefore: p.restBefore } : {}),
      }))
    : undefined;
}
function insertRest(
  stage: DayItineraryStage,
  index: number,
  after: number,
  kind: 'short' | 'long',
) {
  const entry = selected[index];
  if (
    !entry ||
    entry.id !== stage.id ||
    entry.revision !== stage.revision ||
    Number(entry.count) !== stage.count ||
    entry.restBefore !== stage.restBefore
  )
    return;
  if (after === 0) entry.restBefore = kind;
  else {
    if (after >= stage.count || selected.length >= 20) return;
    const following = { ...entry, count: String(stage.count - after), restBefore: kind };
    entry.count = String(after);
    selected.splice(index + 1, 0, following);
  }
  renderSelected();
  notify();
  el('day-plan-edit-status').textContent =
    (kind === 'short' ? 'Kurze' : 'Lange') +
    ' Rast ' +
    (after === 0
      ? 'vor Planzeile ' + (index + 1)
      : 'nach Begegnung ' + after + ' eingeplant · Wiederholungszeile geteilt') +
    '. Nur Planung; keine Rast gebucht.';
  const next = el('day-plan-selected').children[index + (after === 0 ? 0 : 1)];
  next?.querySelector<HTMLInputElement>('input')?.focus();
}
export function renderDayItinerary(
  value: DayItinerary | undefined,
  current: () => boolean = () => true,
) {
  const root = el('day-plan-result');
  root.replaceChildren();
  if (!enabled()) return;
  if (!value) {
    el<HTMLInputElement>('day-total-xp').value = '';
    el<HTMLInputElement>('day-reward-xp').value = '';
    return;
  }
  el<HTMLInputElement>('day-total-xp').value = String(value.totalLoadXp);
  el<HTMLInputElement>('day-reward-xp').value = String(value.totalRewardXp);
  root.append(
    node(
      'p',
      format(value.rawLoadXp) +
        ' angepasste XP / ' +
        format(value.rawRewardXp) +
        ' Basis-XP · ' +
        value.partySize +
        ' Figuren. Jede Begegnung wird einzeln aufgerundet, dann werden die Belastungs- und Verdienstanteile summiert.',
    ),
  );
  root.append(
    node(
      'p',
      value.plannedRests.short +
        ' kurze / ' +
        value.plannedRests.long +
        ' lange Rasten geplant · ' +
        (value.pacing
          ? 'Start beim bestätigten Raststand der aktiven Party.'
          : 'Eigene Levelgruppen starten nach einer langen Rast.') +
        ' Eine Rast gilt für alle Figuren, vor der gesamten Wiederholungszeile. Für Pausen zwischen Wiederholungen mehrere Zeilen verwenden.',
    ),
  );
  const list = node('ol');
  const lease = editRevision;
  for (const [index, stage] of value.stages.entries()) {
    const li = node('li');
    if (stage.restBefore)
      li.append(
        node('p', stage.restBefore === 'short' ? 'Davor: kurze Rast' : 'Davor: lange Rast'),
      );
    li.append(
      node(
        'strong',
        stage.count + ' × ' + stage.name + ' · ' + (stage.difficulty ?? 'Schwierigkeit offen'),
      ),
      node(
        'p',
        'Je Begegnung: ' +
          format(stage.adjustedXp) +
          ' Belastungs-XP (×' +
          stage.multiplier +
          ') / ' +
          format(stage.baseXp) +
          ' Verdienst-XP · ' +
          format(stage.loadShare) +
          ' / ' +
          format(stage.rewardShare) +
          ' je Figur.',
      ),
    );
    li.append(
      node(
        'p',
        'Bis hier: ' +
          format(stage.cumulativeLoadXp) +
          ' Belastung / ' +
          format(stage.cumulativeRewardXp) +
          ' Verdienst insgesamt.' +
          (stage.shortDue === null
            ? ' Raststand offen.'
            : ' Danach: ' +
              stage.shortDue +
              ' Figuren brauchen eine kurze, ' +
              stage.longDue +
              ' eine lange Rast · ' +
              stage.knownRestStates +
              ' / ' +
              value.partySize +
              ' bekannte Raststände.'),
      ),
    );
    if (stage.restStops?.length) {
      const details = node('details') as HTMLDetailsElement;
      details.className = 'day-rest-stops';
      details.append(
        node(
          'summary',
          'Rastmarken · ' +
            (stage.restStops[0]!.after === 0
              ? 'bereits vor dieser Zeile fällig'
              : 'erste nach Begegnung ' + stage.restStops[0]!.after + ' von ' + stage.count),
        ),
      );
      details.append(
        node(
          'p',
          'Marken der ' +
            stage.knownRestStates +
            ' bekannten Raststände. Begegnungen bleiben ungeteilt; eine Marke kann innerhalb eines Kampfs überschritten werden.',
        ),
      );
      const stops = node('ol');
      for (const stop of stage.restStops) {
        const item = node('li');
        item.append(
          node(
            'p',
            (stop.after === 0
              ? 'Vor der ersten Begegnung'
              : 'Nach ' + stop.after + ' von ' + stage.count + ' Begegnungen') +
              ': ' +
              stop.shortDue +
              ' Figuren mit fälliger kurzer / ' +
              stop.longDue +
              ' mit fälliger langer Rast.',
          ),
        );
        if (stop.after < stage.count) {
          const actions = node('div');
          actions.className = 'toolbar';
          for (const kind of ['short', 'long'] as const) {
            if ((kind === 'short' && !stop.shortDue) || (kind === 'long' && !stop.longDue))
              continue;
            const b = button(
              'Hier ' + (kind === 'short' ? 'kurze' : 'lange') + ' Rast einplanen',
              () => {
                if (lease === editRevision && enabled() && current())
                  insertRest(stage, index, stop.after, kind);
              },
            );
            b.disabled = stop.after > 0 && selected.length >= 20;
            if (b.disabled)
              b.title =
                'Höchstens 20 Planzeilen. Zuerst eine Zeile entfernen oder Wiederholungen selbst aufteilen.';
            actions.append(b);
          }
          item.append(actions);
        }
        stops.append(item);
      }
      details.append(stops);
      li.append(details);
    }
    list.append(li);
  }
  root.append(list);
}
export function dayItineraryDraft(): DayItineraryDraft {
  return {
    enabled: enabled(),
    selected: selected.map((p) => ({ ...p })),
    manual: enabled()
      ? { ...manual }
      : {
          load: el<HTMLInputElement>('day-total-xp').value,
          reward: el<HTMLInputElement>('day-reward-xp').value,
          separate: el<HTMLInputElement>('day-separate-reward').checked,
        },
  };
}
export function activateDayItinerary(next: WorkspaceGeometry | null, draft?: DayItineraryDraft) {
  workspace = next;
  generation++;
  editRevision++;
  if (timer) clearTimeout(timer);
  timer = null;
  selected = [];
  manual = { load: '0', reward: '0', separate: false };
  el<HTMLInputElement>('day-use-encounters').checked = false;
  el<HTMLInputElement>('day-plan-search').value = '';
  el('day-plan-edit-status').textContent = '';
  el('day-plan-matches').replaceChildren();
  el('day-plan-matches').setAttribute('aria-busy', 'false');
  el('day-plan-result').replaceChildren();
  el('day-plan-search-status').textContent = '';
  renderSelected();
  inputs();
  if (draft) {
    selected = draft.selected.map((p) => ({ ...p }));
    manual = { ...draft.manual };
    el<HTMLInputElement>('day-use-encounters').checked = draft.enabled;
    el<HTMLInputElement>('day-total-xp').value = draft.enabled ? '' : manual.load;
    el<HTMLInputElement>('day-reward-xp').value = draft.enabled ? '' : manual.reward;
    el<HTMLInputElement>('day-separate-reward').checked = draft.enabled || manual.separate;
    el<HTMLDetailsElement>('day-plan-panel').open = draft.enabled;
    renderSelected();
    inputs();
  }
}
export function refreshDayItineraryChoices() {
  if (enabled()) void search();
}
export function initDayItinerary(refresh: () => void) {
  changed = refresh;
  el('day-use-encounters').onchange = () => {
    if (enabled()) {
      manual = {
        load: el<HTMLInputElement>('day-total-xp').value,
        reward: el<HTMLInputElement>('day-reward-xp').value,
        separate: el<HTMLInputElement>('day-separate-reward').checked,
      };
      el<HTMLInputElement>('day-separate-reward').checked = true;
      void search();
    } else {
      el<HTMLInputElement>('day-total-xp').value = manual.load;
      el<HTMLInputElement>('day-reward-xp').value = manual.reward;
      el<HTMLInputElement>('day-separate-reward').checked = manual.separate;
    }
    inputs();
    notify();
  };
  el('day-plan-search').oninput = () => {
    generation++;
    if (timer) clearTimeout(timer);
    pendingChoices('Vorlagen werden gesucht…');
    timer = setTimeout(() => {
      timer = null;
      void search();
    }, 150);
  };
  el('day-plan-reload').onclick = () => void reload();
  el('day-plan-clear').onclick = () => {
    selected = [];
    renderSelected();
    notify();
  };
}
