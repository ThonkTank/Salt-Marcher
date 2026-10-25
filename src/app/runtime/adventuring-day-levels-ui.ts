import type { DayAdvancement, DayLevelMark } from './adventuring-day-contracts';
const format = (n: number) => n.toLocaleString('de-DE');
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
/** Party-owned facts only; this surface never derives XP or changes the roster. */
export function renderDayLevels(
  root: HTMLElement,
  value: DayAdvancement | undefined,
  options: {
    progress: boolean;
    itinerary: boolean;
    current: () => boolean;
    choose: (pool: number) => void;
  },
) {
  root.replaceChildren();
  root.hidden = !value;
  if (!value) return;
  root.append(
    node('h3', 'Levelentwicklung planen'),
    node(
      'p',
      'Reine Vorschau · Verdienst-XP werden gleichmäßig aufgerundet verteilt. Tagesbelastung und bestätigte XP bleiben getrennt.',
    ),
  );
  if (value.atMaximum)
    root.append(
      node('p', format(value.atMaximum) + ' Figuren sind in dieser Vorschau bereits auf Level 20.'),
    );
  const section = (title: string, marks: DayLevelMark[], future: boolean) => {
    const area = node('section'),
      list = node('ol'),
      count = node('p'),
      more = node('button', 'Weitere Levelmarken');
    let shown = 0;
    more.type = 'button';
    area.append(node('h4', title), count, list, more);
    root.append(area);
    const append = () => {
      if (!options.current()) return;
      const end = Math.min(marks.length, shown + 20);
      for (const m of marks.slice(shown, end)) {
        const li = node('li'),
          size = m.members.reduce((n, p) => n + p.count, 0),
          names = m.members.map((p) => p.name + (p.count > 1 ? ' × ' + format(p.count) : ''));
        li.dataset.level = String(m.level);
        li.dataset.groupXp = String(m.groupXp);
        li.append(
          node('strong', format(size) + ' Figuren → Level ' + m.level),
          node(
            'p',
            format(m.groupXp) +
              ' Gruppenverdienst-XP insgesamt · ' +
              format(m.shareXp) +
              ' XP je Figur bis zu dieser Marke' +
              (future ? ' · noch ' + format(m.missingGroupXp) + ' Gruppen-XP.' : '.'),
          ),
        );
        const people = node('details');
        people.append(
          node(
            'summary',
            names.length <= 3
              ? names.join(', ')
              : names.slice(0, 3).join(', ') + ' · ' + (names.length - 3) + ' weitere',
          ),
        );
        for (const name of names) people.append(node('p', name));
        li.append(people);
        if (options.itinerary)
          li.append(
            node(
              'p',
              m.stage === null
                ? 'Im aktuellen Encounter-Tagesplan noch nicht erreicht.'
                : 'Spätestens nach Planzeile ' + m.stage + ' erreicht.',
            ),
          );
        if (future) {
          const use = node('button', 'Verdienst bis Level ' + m.level + ' einsetzen');
          use.type = 'button';
          use.disabled = options.itinerary || m.groupXp > 1000000000000;
          use.onclick = () => {
            if (use.isConnected && options.current() && !options.itinerary)
              options.choose(m.groupXp);
          };
          li.append(use);
        }
        list.append(li);
      }
      shown = end;
      count.textContent = shown + ' von ' + marks.length + ' Levelmarken';
      more.hidden = shown === marks.length;
    };
    if (!marks.length) {
      count.textContent = future
        ? 'Keine weitere Levelmarke.'
        : 'Mit diesem Verdienst wird noch keine neue Levelmarke erreicht.';
      more.hidden = true;
    } else append();
    more.onclick = append;
  };
  section('Nächste Levelmarken', value.next, true);
  if (options.progress) section('Erreichte Levelmarken nach Verdienst', value.reached, false);
  if (options.itinerary)
    root.append(
      node(
        'p',
        'Die Werte stammen aus dem gewählten Encounter-Tagesplan. Für einen freien Zielverdienst den Vorlagenmodus ausdrücklich ausschalten.',
      ),
    );
}
