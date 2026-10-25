import { restFrame, xpLevel, type CharacterHealth, type Progress } from './progression';

export interface PartyHealthReference {
  health?: CharacterHealth | null;
  healthCombat?: { title: string };
  lastCombatStatus?: Pick<CharacterHealth, 'tempHp' | 'conditions' | 'concentrating'>;
}

export function partyHealthFacts(row: PartyHealthReference | undefined) {
  const status = row?.health ?? row?.lastCombatStatus;
  const health = row?.health
    ? row.health.hp + ' / ' + row.health.maxHp + ' HP'
    : row?.healthCombat
      ? 'HP im Kampf „' + row.healthCombat.title + '“'
      : 'HP offen';
  const death = row?.health?.death,
    deathText = death?.dead
      ? 'Tot'
      : death?.stable
        ? 'Stabilisiert'
        : death
          ? 'Todesrettung ' + death.successes + '✓ / ' + death.failures + '✗'
          : '';
  const effects = [
    status?.tempHp ? status.tempHp + ' temp. HP' : '',
    status?.conditions ?? '',
    status?.concentrating ? 'Konzentration' : '',
    deathText,
  ]
    .filter(Boolean)
    .join(' · ');
  return health + (effects ? ' · ' + effects : '');
}

export function partyProgressFacts(row: Pick<Progress, 'xp' | 'rest'> | undefined) {
  const level =
      row?.xp === null || row === undefined ? 'Level offen' : 'Level ' + xpLevel(row.xp).level,
    frame = row ? restFrame(row as Progress) : null;
  const rest = !frame
    ? 'Rastbudget offen'
    : frame.overdue
      ? 'Lange Rast fällig'
      : 'Tageslast ' + frame.consumed + ' / ' + frame.budget + ' XP';
  return level + ' · ' + rest;
}

export function passivePerceptionResult(
  characters: { name: string; passivePerception?: number }[],
  dc: number,
) {
  if (!Number.isSafeInteger(dc)) throw new Error('Der Wahrnehmungs-SG muss eine ganze Zahl sein.');
  const known = characters.filter((character) => character.passivePerception !== undefined),
    noticed = known.filter((character) => character.passivePerception! >= dc),
    unknown = characters.filter((character) => character.passivePerception === undefined);
  const result = noticed.length
    ? 'Bemerken: ' + noticed.map((character) => character.name).join(', ') + '.'
    : unknown.length
      ? known.length
        ? 'Mit bekanntem Wert bemerkt niemand.'
        : 'Keine passive Wahrnehmung eingetragen.'
      : 'Bemerkt niemand.';
  return (
    'SG ' +
    dc +
    ' · ' +
    result +
    (unknown.length
      ? ' Ohne Wert: ' + unknown.map((character) => character.name).join(', ') + '.'
      : '')
  );
}
