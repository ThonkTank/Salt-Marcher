import type { ChronicleEntry } from './chronicle-contracts';
import type { LiveAction } from './live-contracts';

export interface LiveSessionRecap {
  open: boolean;
  marker: ChronicleEntry | null;
  entries: ChronicleEntry[];
}

export function liveSessionRecap(
  entries: ChronicleEntry[],
  latest?: ChronicleEntry,
): LiveSessionRecap {
  const marker = latest ?? entries.find((entry) => !!entry.sessionMarker);
  if (!marker) return { open: false, marker: null, entries: [] };
  const markerIndex = entries.findIndex((entry) => entry.id === marker.id);
  if (marker.sessionMarker === 'start')
    return {
      open: true,
      marker,
      entries: (markerIndex < 0 ? entries : entries.slice(0, markerIndex)).filter(
        (entry) => !entry.sessionMarker,
      ),
    };
  if (markerIndex < 0) return { open: false, marker, entries: [] };
  const startIndex = entries.findIndex(
    (entry, index) => index > markerIndex && entry.sessionMarker === 'start',
  );
  return {
    open: false,
    marker,
    entries: entries
      .slice(markerIndex + 1, startIndex < 0 ? entries.length : startIndex)
      .filter((entry) => !entry.sessionMarker),
  };
}

export const liveActionUpdatesRecap = (action: LiveAction) =>
  [
    'membership',
    'move',
    'live-moment',
    'session-marker',
    'advance-clock',
    'archive-character',
    'visit-outcome',
    'apply-visit',
  ].includes(action.kind);

export interface SessionCloseHandoffInput {
  sceneTitle: string;
  locationTitle?: string | null;
  masks: { kind: 'combat' | 'chase'; title: string; sceneTitle: string }[];
  treasureCount: number;
  xpBooked: boolean;
  nextVisit?: { title: string; location?: string | null } | null;
  journey?: string | null;
  agenda?: string[];
  narratives?: string[];
  notices?: string[];
}

export function sessionCloseHandoffSuggestion(input: SessionCloseHandoffInput) {
  const lines = [
    'Nächster Einstieg: ' +
      (input.sceneTitle || 'Unbenannte Gruppe') +
      (input.locationTitle ? ' · ' + input.locationTitle : ''),
  ];
  if (input.nextVisit)
    lines.push(
      '- Nächster Besuch: ' +
        (input.nextVisit.title || 'Unbenannter Besuch') +
        (input.nextVisit.location ? ' · ' + input.nextVisit.location : ''),
    );
  if (input.journey) lines.push('- Reise: ' + input.journey);
  for (const event of input.agenda ?? []) lines.push('- Frist: ' + event);
  for (const narrative of input.narratives ?? []) lines.push('- Offener Auftrag: ' + narrative);
  for (const notice of input.notices ?? []) lines.push('- Weltentscheidung: ' + notice);
  for (const mask of input.masks)
    lines.push(
      '- ' +
        (mask.kind === 'combat' ? 'Kampf' : 'Verfolgung') +
        ' fortsetzen: ' +
        mask.title +
        (mask.sceneTitle && mask.sceneTitle !== input.sceneTitle
          ? ' (' + mask.sceneTitle + ')'
          : ''),
    );
  if (input.treasureCount)
    lines.push(
      '- Unverteilte Beute prüfen: ' +
        input.treasureCount +
        ' ' +
        (input.treasureCount === 1 ? 'Schatzposition' : 'Schatzpositionen'),
    );
  if (!input.xpBooked) lines.push('- Spielabend-XP prüfen');
  return lines.join('\n');
}

export function latestCompletedSessionHandoff(entries: ChronicleEntry[], latest?: ChronicleEntry) {
  return (
    (latest?.sessionMarker === 'end'
      ? latest
      : entries.find((entry) => entry.sessionMarker === 'end')
    )?.handoff ?? ''
  );
}

export function handoffVisitSeed(handoff: string, sceneTitle: string) {
  const text = handoff.trim(),
    first =
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? '',
    named = first.replace(/^Nächster Einstieg:\s*/i, '').replace(/^[-*]\s*/, ''),
    title = (named || 'Nächster Spielabend: ' + (sceneTitle.trim() || 'Unbenannte Gruppe')).slice(
      0,
      1000,
    );
  return { title, notes: handoff };
}
