import type { AutonomyDecision } from './autonomy-contracts';
import { formatInstant } from './live-contracts';

export function renderAutonomyDecision(
  root: HTMLElement,
  decision: AutonomyDecision,
  name: string,
  refresh: () => Promise<void>,
) {
  root.replaceChildren();
  root.dataset.actorId = decision.actorId;
  root.dataset.selectedJobId = decision.selectedJobId ?? '';
  const heading = document.createElement('h3');
  heading.textContent = 'Entscheidung für ' + name;
  root.append(heading);
  const basis = document.createElement('p');
  basis.textContent =
    (decision.basis === 'confirmed'
      ? 'Nächster bestätigter Zeitraum: '
      : 'Vorschau mit aktueller Konfiguration: ') +
    formatInstant(decision.instantMs) +
    (decision.throughMs ? ' bis ' + formatInstant(decision.throughMs) : '') +
    ' · NPC-Revision ' +
    decision.actorRevision;
  root.append(basis);
  const note = document.createElement('p');
  note.textContent =
    'Gespeicherter Stand. Offene Formulareingaben werden nicht berücksichtigt. Diese Abfrage bestätigt keine Zeit, bucht kein Ziel und führt keinen Job aus.';
  root.append(note);
  for (const reason of decision.blockers) {
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = reason;
    root.append(p);
  }
  const selected = decision.candidates.find((c) => c.jobId === decision.selectedJobId),
    summary = document.createElement('p');
  summary.textContent = selected
    ? 'Bestes zulässiges Angebot: ' +
      selected.name +
      ' · Priorität ' +
      selected.priority +
      (decision.runningJobId === selected.jobId
        ? ' · laufenden Job fortsetzen'
        : decision.runningJobId
          ? ' · würde laufenden Job unterbrechen'
          : '')
    : 'Kein zulässiges Angebot. Der NPC wartet.';
  root.append(summary);
  const needs = document.createElement('details'),
    title = document.createElement('summary');
  title.textContent = 'Bedürfnisse und Prioritätsgewichte';
  needs.append(title);
  for (const need of decision.needs) {
    const p = document.createElement('p');
    p.textContent =
      need.name +
      ': ' +
      need.value.toFixed(2) +
      '/100 · ' +
      (need.enabled
        ? 'Gewicht ' + need.weight + ' · Zuwachs ' + need.ratePerHour + '/Stunde'
        : 'ausgeschaltet');
    needs.append(p);
  }
  root.append(needs);
  const tie = document.createElement('p');
  tie.textContent = 'Gleichstand: ' + decision.tieBreak + '.';
  root.append(tie);
  const filter = document.createElement('input');
  filter.type = 'search';
  filter.placeholder = 'Angebote oder Gründe durchsuchen';
  filter.setAttribute('aria-label', 'Entscheidungsangebote durchsuchen');
  const state = document.createElement('select');
  state.setAttribute('aria-label', 'Entscheidungsangebote filtern');
  for (const [id, text] of [
    ['all', 'Alle Angebote'],
    ['eligible', 'Zulässige Angebote'],
    ['rejected', 'Abgelehnte Angebote'],
  ]) {
    const o = document.createElement('option');
    o.value = id!;
    o.textContent = text!;
    state.append(o);
  }
  const list = document.createElement('ol'),
    count = document.createElement('p'),
    bar = document.createElement('div');
  bar.className = 'toolbar';
  let page = 0;
  const previous = document.createElement('button'),
    next = document.createElement('button'),
    update = document.createElement('button');
  for (const b of [previous, next, update]) b.type = 'button';
  previous.textContent = 'Vorherige Angebote';
  next.textContent = 'Weitere Angebote';
  update.textContent = 'Entscheidung neu prüfen';
  update.onclick = () => {
    update.disabled = true;
    void refresh()
      .catch((e) => {
        count.textContent = e.message;
      })
      .finally(() => (update.disabled = false));
  };
  bar.append(previous, next, update);
  const draw = () => {
    const needle = filter.value.toLocaleLowerCase(),
      items = decision.candidates.filter(
        (c) =>
          (state.value === 'all' ||
            (state.value === 'eligible' && c.eligible) ||
            (state.value === 'rejected' && !c.eligible)) &&
          (!needle || [c.name, c.reason].some((t) => t.toLocaleLowerCase().includes(needle))),
      );
    list.replaceChildren();
    list.start = page * 20 + 1;
    for (const c of items.slice(page * 20, page * 20 + 20)) {
      const row = document.createElement('li'),
        title = document.createElement('strong'),
        p = document.createElement('p');
      title.textContent =
        c.name +
        (c.jobId === decision.selectedJobId ? ' · gewählt' : '') +
        (c.eligible ? ' · Priorität ' + c.priority : ' · abgelehnt');
      p.textContent =
        c.reason +
        (c.travelSeconds !== null
          ? ' · Weg ' + c.travelSeconds + ' s · Restdauer ' + c.remainingSeconds + ' s'
          : '');
      row.append(title, p);
      list.append(row);
    }
    count.textContent =
      items.length + ' von ' + decision.candidates.length + ' Angeboten · Seite ' + (page + 1);
    previous.disabled = page === 0;
    next.disabled = (page + 1) * 20 >= items.length;
  };
  filter.oninput = state.onchange = () => {
    page = 0;
    draw();
  };
  previous.onclick = () => {
    page--;
    draw();
  };
  next.onclick = () => {
    page++;
    draw();
  };
  root.append(filter, state, count, list, bar);
  draw();
}
