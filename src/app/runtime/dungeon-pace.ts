import type { DungeonMovement } from '../atlas/volume-contracts';
export interface DungeonPaceSettings {
  explorationRoundSeconds?: number;
  sceneId: string;
  revision: number;
  movement: DungeonMovement;
  groupMetersPerMinute: number | null;
  members: { characterId: string; excluded: boolean; metersPerMinute: number | null }[];
}
export interface DungeonPace {
  profile: 'dnd5e-2014-dungeon-pace-v1';
  metersPerMinute: number | null;
  reason: string;
  members: {
    characterId: string;
    name: string;
    feet: number | null;
    metersPerMinute: number | null;
    excluded: boolean;
    overridden: boolean;
  }[];
  limitingIds: string[];
}
export function checkedDungeonPace(s: DungeonPaceSettings) {
  const rate = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n <= 1000);
  if (
    s?.explorationRoundSeconds !== undefined &&
    (!Number.isSafeInteger(s.explorationRoundSeconds) || s.explorationRoundSeconds < 1)
  )
    throw new Error('Erkundungsrunde benötigt positive ganze Sekunden.');
  if (
    !s ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    typeof s.sceneId !== 'string' ||
    !['walk', 'crawl', 'climb', 'swim', 'fly'].includes(s.movement) ||
    !rate(s.groupMetersPerMinute) ||
    !Array.isArray(s.members) ||
    s.members.length > 10000 ||
    new Set(s.members.map((m) => m.characterId)).size !== s.members.length ||
    s.members.some(
      (m) =>
        !m ||
        typeof m.characterId !== 'string' ||
        !m.characterId ||
        typeof m.excluded !== 'boolean' ||
        !rate(m.metersPerMinute),
    )
  )
    throw new Error(
      'Reisetempo benötigt gültige Vorgaben von 0–1000 m/min. Leere Felder verwenden das Profil.',
    );
  return s;
}
/** Normal local movement: ten six-second moves per minute; extra movement costs
 * for crawl/climb/swim. Flight requires an explicit effective speed. No Dash,
 * transport capacity or permission to attempt a special route is inferred. */
export function dungeonPartyPace(
  roster: readonly { id: string; profile: { name: string; speedFeet?: number } }[],
  settings: DungeonPaceSettings,
): DungeonPace {
  checkedDungeonPace(settings);
  const factor = ['crawl', 'climb', 'swim'].includes(settings.movement) ? 0.5 : 1;
  const members = roster.map((c) => {
    const own = settings.members.find((m) => m.characterId === c.id),
      feet = c.profile.speedFeet ?? null,
      derived = feet === null || settings.movement === 'fly' ? null : feet * 3.048 * factor;
    return {
      characterId: c.id,
      name: c.profile.name,
      feet,
      metersPerMinute: own?.metersPerMinute ?? derived,
      excluded: own?.excluded ?? false,
      overridden: own?.metersPerMinute !== null && own?.metersPerMinute !== undefined,
    };
  });
  const included = members.filter((m) => !m.excluded),
    missing = included.filter((m) => m.metersPerMinute === null);
  const automatic =
      !included.length || missing.length
        ? null
        : Math.min(...included.map((m) => m.metersPerMinute!)),
    metersPerMinute = settings.groupMetersPerMinute ?? automatic;
  const reason =
    settings.groupMetersPerMinute !== null
      ? settings.groupMetersPerMinute === 0
        ? 'Gruppenvorgabe 0: Bewegung angehalten. Für neue Wege ein positives Tempo vorgeben.'
        : 'Ausdrückliche Gruppenvorgabe.'
      : !included.length
        ? 'Alle Figuren sind aus der Tempoberechnung ausgenommen. Gruppenvorgabe setzen oder eine Figur einbeziehen.'
        : missing.length
          ? 'Tempo fehlt: ' +
            missing.map((m) => m.name).join(', ') +
            '. Profil ergänzen oder effektives Tempo vorgeben.'
          : metersPerMinute === 0
            ? 'Eine einbezogene Figur hat Tempo 0. Transport klären und gegebenenfalls Figur ausnehmen oder Tempo vorgeben.'
            : 'Langsamste einbezogene Figur; alle Gruppenmitglieder kommen gemeinsam an.';
  return {
    profile: 'dnd5e-2014-dungeon-pace-v1',
    metersPerMinute,
    reason,
    members,
    limitingIds:
      settings.groupMetersPerMinute !== null
        ? []
        : included.filter((m) => m.metersPerMinute === automatic).map((m) => m.characterId),
  };
}
