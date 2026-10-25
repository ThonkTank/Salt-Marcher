import type { DayPacing, DayRestFrame } from './adventuring-day-contracts';

const number = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const node = (tag: string, text?: string) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
};
const expansion = new WeakMap<HTMLElement, boolean>();
function meter(fill: number | null, sections: number | null, label: string) {
  const track = node('div');
  track.className = 'day-rest-track';
  if (fill === null) {
    track.textContent = 'Raststand offen';
    return track;
  }
  track.setAttribute('role', 'meter');
  track.setAttribute('aria-label', label);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '1');
  track.setAttribute('aria-valuenow', String(fill));
  track.setAttribute('aria-valuetext', label);
  track.style.setProperty('--day-rest-fill', fill * 100 + '%');
  if (sections !== null)
    for (let i = 1; i < sections; i++) {
      const mark = node('span');
      mark.className = 'day-rest-mark';
      mark.style.left = (i / sections) * 100 + '%';
      mark.setAttribute('aria-hidden', 'true');
      track.append(mark);
    }
  return track;
}
function fact(f: DayRestFrame) {
  return (
    number(f.consumed) +
    ' / ' +
    number(f.budget) +
    ' XP seit langer Rast · ' +
    number(f.shortXp) +
    ' seit kurzer Rast'
  );
}
function due(f: DayRestFrame) {
  return f.due === 'long'
    ? 'Lange Rast fällig' +
        (f.consumed > f.budget
          ? ' · ' + number(f.consumed - f.budget) + ' XP über Tagesbudget'
          : '')
    : f.due === 'short'
      ? 'Kurze Rast fällig'
      : f.sections === 1
        ? 'Noch ' + number(f.remainingLong) + ' XP bis langer Rast'
        : 'Noch ' +
          number(Math.max(0, Math.ceil(f.nextRest - f.consumed))) +
          ' XP bis kurzer Rast · ' +
          number(f.remainingLong) +
          ' bis langer Rast';
}

/** Only presents the Party-owned calculation. Paging never requests or writes party data. */
export function renderDayPacing(
  root: HTMLElement,
  pacing: DayPacing | undefined,
  preview: boolean,
) {
  const expanded = expansion.get(root) ?? false;
  root.replaceChildren();
  if (!pacing) return;
  root.append(
    node('h3', preview ? 'Ab jetzt · zusätzliche Tagesbelastung' : 'Heute · bestätigter Raststand'),
  );
  if (!pacing.partySize) {
    root.append(node('p', 'Keine aktive Party. Eigene Rechnerzeilen bleiben verfügbar.'));
    return;
  }
  const hasPreview = preview && pacing.loadShare !== null,
    rests = pacing.plannedRests;
  const restCaption = rests
    ? ' Geplant: ' + rests.short + ' kurze / ' + rests.long + ' lange Rasten; feste Startlevel.'
    : ' Keine Rasten oder Levelwechsel in dieser Vorschau.';
  root.append(
    node(
      'p',
      hasPreview
        ? 'Zusätzlich ' +
            number(pacing.loadShare!) +
            ' Belastungs-XP je Figur · ' +
            number(pacing.totalLoad!) +
            ' insgesamt nach Aufrundung.' +
            restCaption
        : 'Alle aktiven Figuren, auch in anderen Gruppen. Die Marken folgen den tatsächlich abgeschlossenen kurzen Rasten.',
    ),
  );
  const basis = node(
    'p',
    pacing.known +
      ' / ' +
      pacing.partySize +
      ' bekannte Raststände · ungewichteter Mittelwert des verbleibenden Tagesrahmens' +
      (pacing.known < pacing.partySize ? ' · Teilbasis, unbekannte Figuren ausgeschlossen' : ''),
  );
  basis.className = 'caption';
  root.append(basis);
  root.append(
    node('small', 'Jetzt'),
    meter(pacing.currentFill, pacing.commonSections, 'Jetzt · Mittelwert bekannter Raststände'),
  );
  if (hasPreview) {
    root.append(
      node('small', 'Danach'),
      meter(
        pacing.projectedFill,
        pacing.projectedSections ?? null,
        'Danach · Mittelwert bekannter Raststände',
      ),
    );
    const short = pacing.members.filter((m) => m.after?.due === 'short').length,
      long = pacing.members.filter((m) => m.after?.due === 'long').length;
    root.append(
      node(
        'p',
        'Danach: ' +
          short +
          ' Figuren mit fälliger kurzer Rast · ' +
          long +
          ' mit fälliger langer Rast · ' +
          (pacing.projectedKnown ?? pacing.known) +
          ' / ' +
          pacing.partySize +
          ' bekannte Raststände.',
      ),
    );
  }
  const next = node('p');
  next.id = 'day-pacing-next';
  next.textContent =
    pacing.untilLong === 0
      ? 'Mindestens eine Figur braucht bereits eine lange Rast.'
      : pacing.untilShort === 0
        ? 'Mindestens eine Figur hat ihre nächste kurze Rast erreicht.'
        : [
            pacing.untilShort === null
              ? ''
              : 'Vom bestätigten Stand: ' +
                number(pacing.untilShort) +
                ' Gruppen-XP bis zur ersten kurzen Rast',
            pacing.untilLong === null
              ? ''
              : number(pacing.untilLong) + ' bis zur ersten langen Rast',
          ]
            .filter(Boolean)
            .join(' · ') || 'Noch keine verlässlichen Rastmarken.';
  root.append(
    next,
    node(
      'p',
      'Gruppen-XP werden für diese Vorschau gleichmäßig und aufgerundet auf alle aktiven Figuren verteilt. Die Tagesmodelle unten beginnen dagegen bei einer frischen langen Rast.',
    ),
  );
  const details = node('details') as HTMLDetailsElement,
    heading = node('summary', 'Rastverlauf je Figur'),
    list = node('div'),
    more = node('button', 'Weitere Figuren');
  more.setAttribute('type', 'button');
  more.className = 'day-pacing-more';
  let limit = 20;
  function draw() {
    list.replaceChildren();
    for (const member of pacing!.members.slice(0, limit)) {
      const card = node('article');
      card.className = 'day-rest-member';
      card.dataset.characterId = member.id;
      card.append(node('strong', member.name));
      if (!member.before) card.append(node('p', member.reason ?? 'Raststand offen.'));
      else {
        card.append(
          node('p', 'Jetzt: ' + fact(member.before)),
          meter(
            member.before.fill,
            member.before.sections,
            member.name + ' · jetzt · ' + fact(member.before),
          ),
          node('p', due(member.before)),
        );
      }
      if (hasPreview && member.after)
        card.append(
          node('p', 'Danach: ' + fact(member.after)),
          meter(
            member.after.fill,
            member.after.sections,
            member.name + ' · danach · ' + fact(member.after),
          ),
          node('p', due(member.after)),
        );
      list.append(card);
    }
    more.hidden = limit >= pacing!.members.length;
    more.textContent = 'Weitere ' + Math.min(20, pacing!.members.length - limit) + ' Figuren';
  }
  more.onclick = () => {
    limit += 20;
    draw();
  };
  draw();
  details.open = expanded;
  details.ontoggle = () => {
    if (root.contains(details)) expansion.set(root, details.open);
  };
  details.append(heading, list, more);
  root.append(details);
}
