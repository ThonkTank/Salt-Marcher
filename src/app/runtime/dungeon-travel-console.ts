import type { DungeonView } from '../atlas/dungeon-contracts';
import type { DungeonJourney, DungeonPreview } from '../atlas/dungeon-travel-contracts';

/** Rehome existing GM controls; the legacy Dungeon canvas never becomes another map. */
export function mountDungeonTravelConsole(host: HTMLElement) {
  const source = document.getElementById('dungeon');
  if (!source || document.getElementById('dungeon-travel-console')) return;
  const console = document.createElement('details'),
    summary = document.createElement('summary');
  console.id = 'dungeon-travel-console';
  summary.textContent = 'Dungeonreise · Raum, Wege und Wahrnehmung';
  console.append(summary);
  const heading = source.querySelector('h2');
  if (heading) heading.textContent = 'Dungeonreise';
  const toolbar = source.firstElementChild!,
    context = document.getElementById('dungeon-context')!;
  const notice = document.createElement('p');
  notice.id = 'dungeon-read-status';
  notice.setAttribute('role', 'status');
  const controls = document.createElement('div');
  controls.id = 'dungeon-travel-controls';
  console.append(controls);
  host.append(console);
  for (const node of [...source.childNodes])
    if (node !== toolbar && node !== context) controls.append(node);
  const current = document.getElementById('dungeon-current-key')!,
    facts = document.createElement('p');
  facts.id = 'dungeon-position-facts';
  current.prepend(facts);
  controls.prepend(current);
  const settings = document.createElement('details'),
    label = document.createElement('summary');
  settings.id = 'dungeon-travel-settings';
  label.textContent = 'Tempo, Rundendauer und Bewegung';
  settings.append(label);
  const movement = document.getElementById('dungeon-movement')!.closest('.toolbar')!,
    pace = document.getElementById('dungeon-pace-controls')!;
  movement.before(settings);
  settings.append(movement, pace);
  const decisions = document.createElement('section');
  decisions.id = 'dungeon-travel-decisions';
  decisions.setAttribute('aria-label', 'Aktuelle Reise und nächste Entscheidung');
  for (const id of ['dungeon-preview', 'dungeon-route-status', 'dungeon-round-status'])
    decisions.append(document.getElementById(id)!);
  const planning = document.createElement('div');
  planning.className = 'toolbar';
  planning.append(
    document.getElementById('dungeon-plan')!,
    document.getElementById('dungeon-confirm')!,
  );
  decisions.append(planning, document.getElementById('dungeon-play')!.closest('.toolbar')!);
  controls.prepend(decisions);
  console.append(toolbar, context, notice, controls);
  host.append(console);
}

export function dungeonTravelReadState(ready: boolean, message = '') {
  const controls = document.getElementById('dungeon-travel-controls');
  if (controls) controls.inert = !ready;
  const status = document.getElementById('dungeon-read-status');
  if (status) status.textContent = message;
}

export function renderDungeonTravelContext(data: DungeonView) {
  const facts = document.getElementById('dungeon-position-facts');
  if (!facts) return;
  const p = data.position,
    room = data.rooms.find((r) => r.id === p?.roomId),
    floor = data.floors.find((f) => f.scopeId === p?.scopeId && f.id === p?.floorId);
  const dungeon = data.drawing.keyContent?.find(
    (k) => k.kind === 'dungeon' && k.scopeId === p?.scopeId,
  );
  const members = data.contentRecipients?.map((c) => c.name).join(', ');
  const heading =
    data.keyHeading === null || data.keyHeading === undefined
      ? 'Ausrichtung noch nicht bestimmt'
      : `Ausrichtung ${Math.round(((data.keyHeading % 360) + 360) % 360)}°`;
  facts.textContent = p
    ? [
        data.activeDungeonName ?? dungeon?.name ?? 'Dungeon',
        floor?.name ?? p.floorId,
        room ? `${room.number}. ${room.name}` : '',
        `Position ${p.x.toFixed(2)}, ${p.y.toFixed(2)} m · Höhe ${p.z.toFixed(2)} m`,
        heading,
        members ? `Gruppe: ${members}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Keine aktive Dungeonposition. Wähle einen Raum und platziere die Fokusgruppe bewusst ohne Reisezeit.';
  const console = document.getElementById('dungeon-travel-console') as HTMLDetailsElement | null;
  if (console) {
    console.dataset.inDungeon = String(!!p);
    const key = data.sceneId + ':' + (p?.scopeId ?? '');
    if (console.dataset.context !== key) {
      console.dataset.context = key;
      console.open = !!p;
      const outer = document.getElementById('live-atlas-local-travel') as HTMLDetailsElement | null;
      if (p && outer) outer.open = true;
    }
  }
}

export function dungeonTravelRoute(
  journey: DungeonJourney | null,
  preview: DungeonPreview | null,
  sceneId: string | null,
) {
  if (preview?.request.sceneId === sceneId) return preview.route;
  return journey?.request.sceneId === sceneId &&
    ['active', 'paused', 'decision'].includes(journey.status)
    ? journey.route.slice(Math.max(0, journey.nextIndex - 1))
    : [];
}
