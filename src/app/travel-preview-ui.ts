import type { TravelPreview } from './world-contracts';
import { hexKey, terrainNames } from './world-model';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
/** Display the utility-owned facts; do not recalculate a route from its visible stage window. */
export function renderTravelEvaluation(root: HTMLElement, p: TravelPreview) {
  root.replaceChildren();
  const facts = node('dl');
  facts.className = 'travel-evaluation-facts';
  for (const [label, text] of [
    ['Dauer', (p.durationSeconds / 3600).toFixed(2) + ' h'],
    ['Hexabschnitte', String(p.route.length - 1)],
    ['Geländekosten', p.terrainCost.toFixed(2)],
  ]) {
    const group = node('div');
    group.append(node('dt', label), node('dd', text));
    facts.append(group);
  }
  root.append(
    facts,
    node(
      'p',
      'Geländekosten: Summe der Grundkosten je betretenem Zielhex; Wege kosten 1. Wetter, Reisetempo und GM-Faktor wirken auf die Dauer.',
    ),
  );
}
export function renderTravelBriefing(root: HTMLElement, p: TravelPreview) {
  root.replaceChildren();
  const evaluation = node('div');
  renderTravelEvaluation(evaluation, p);
  root.append(evaluation, node('p', 'Abreise: ' + p.departure));
  root.append(
    node(
      'p',
      'Reisetempo: ' +
        p.request.paceKmh.toFixed(2) +
        ' km/h · ' +
        (p.request.usePartyPace
          ? 'langsamste Bewegung der Reisegruppe (ft / 10 = mph)'
          : 'manuelle GM-Vorgabe') +
        (p.request.finalSeconds !== null ? ' · Enddauer hat Vorrang' : ''),
    ),
  );
  if (p.continuation)
    root.append(
      node(
        'p',
        'Bereits gereist: ' +
          p.continuation.completedSteps +
          (p.continuation.completedSteps === 1 ? ' Abschnitt' : ' Abschnitte') +
          ' · frühere Restzeit ' +
          (p.continuation.previousRemainingSeconds / 3600).toFixed(2) +
          ' h · neu ' +
          (p.durationSeconds / 3600).toFixed(2) +
          ' h',
      ),
    );
  root.append(node('h3', 'Weg, Ankunft und Wetter · erste 40 Abschnitte'));
  const table = node('table'),
    head = node('thead'),
    row = node('tr');
  for (const title of ['Abschnitt / Ort', 'Ankunft', 'Dauer', 'Gelände / Wetter']) {
    const th = node('th', title);
    th.scope = 'col';
    row.append(th);
  }
  head.append(row);
  table.append(head);
  const body = node('tbody');
  for (const stage of p.stages) {
    const tr = node('tr'),
      place = node(
        'td',
        stage.index + '. ' + hexKey(stage.hex) + (stage.placeName ? ' · ' + stage.placeName : ''),
      ),
      date = node('td', stage.arrival),
      duration = node('td', Math.round(stage.seconds / 60) + ' min'),
      conditions = node(
        'td',
        terrainNames[stage.terrain] +
          ' · ' +
          stage.weather.label +
          ' · ' +
          stage.weather.effects.temperatureC +
          ' °C',
      );
    if (stage.interrupt) place.append(node('strong', 'GM-Halt: ' + stage.interrupt));
    if (stage.weather.effects.combatNote)
      conditions.append(node('span', stage.weather.effects.combatNote));
    tr.append(place, date, duration, conditions);
    body.append(tr);
  }
  table.append(body);
  const scroll = node('div');
  scroll.className = 'travel-stage-scroll';
  scroll.append(table);
  root.append(scroll);
  if (p.route.length - 1 > p.stages.length)
    root.append(
      node(
        'p',
        'Weitere ' +
          (p.route.length - 1 - p.stages.length) +
          ' Abschnitte sind in der Gesamtdauer und Route enthalten.',
      ),
    );
  if (p.events.length) {
    root.append(node('h3', 'Kalenderereignisse an Reiseorten · erste 12'));
    for (const event of p.events)
      root.append(
        node(
          'p',
          event.name +
            ' · ' +
            event.date +
            (event.state === 'active' ? ' · bei Abreise aktiv' : ''),
        ),
      );
  }
  root.append(
    node(
      'p',
      'Vorschau ohne Änderungen. „Reise starten“ bewegt die Gruppe mit der gewählten Wiedergabegeschwindigkeit; Pause hält am letzten bestätigten Hex. Warten und Rast separat bestätigen.',
    ),
  );
}
