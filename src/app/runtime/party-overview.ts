import { restFrame, xpLevel, type Progress } from './progression';
import type { Character } from './live-contracts';
export const partyQuickFields = [
  ['characterClass', 'Klasse'],
  ['level', 'Level'],
  ['species', 'Volk'],
  ['playerName', 'Spieler'],
  ['armorClass', 'RK'],
  ['speedFeet', 'Bewegung'],
  ['passivePerception', 'Passive Wahrnehmung'],
  ['passiveInsight', 'Passive Einsicht'],
  ['passiveInvestigation', 'Passive Untersuchung'],
  ['languages', 'Sprachen'],
] as const;
export type PartyQuickField = (typeof partyQuickFields)[number][0];
export const defaultPartyQuickFields: PartyQuickField[] = [
  'characterClass',
  'level',
  'armorClass',
  'speedFeet',
  'passivePerception',
];
export function checkedPartyQuickFields(value: unknown): PartyQuickField[] {
  if (
    !Array.isArray(value) ||
    value.some((v) => !partyQuickFields.some(([key]) => key === v)) ||
    new Set(value).size !== value.length
  )
    throw new Error('Gespeicherte Schnellwerte sind nicht lesbar. Auswahl erneut speichern.');
  return partyQuickFields.filter(([key]) => value.includes(key)).map(([key]) => key);
}
export function partyQuickFacts(c: Character, p: Progress | undefined, keys: PartyQuickField[]) {
  return keys.map((key) => {
    const label = partyQuickFields.find(([id]) => id === key)![1],
      v = key === 'level' ? (p?.xp == null ? undefined : xpLevel(p.xp).level) : c.profile[key];
    return {
      key,
      label,
      value:
        v === undefined
          ? 'offen'
          : Array.isArray(v)
            ? v.length
              ? v.join(', ')
              : 'offen'
            : String(v) + (key === 'speedFeet' ? ' ft' : ''),
    };
  });
}
export function partyRestOverview(members: (Progress | undefined)[]) {
  const frames = members.map((p) => (p ? restFrame(p) : null)).filter((p) => p !== null),
    sections = frames[0]?.sections ?? null;
  return {
    fill: frames.length ? frames.reduce((sum, f) => sum + f.fill, 0) / frames.length : null,
    sections: frames.length && frames.every((f) => f.sections === sections) ? sections : null,
    included: frames.length,
    total: members.length,
    partial: frames.length < members.length,
  };
}
export function characterRestHint(p: Progress | undefined) {
  if (!p) return 'Fortschritt nicht verfügbar.';
  const f = restFrame(p);
  if (!f)
    return (
      (p.xp === null
        ? 'XP und damit Tagesbudget offen. '
        : 'Rastabschnitte nicht verlässlich bekannt. ') +
      'Gespeicherte Tagesbelastung ' +
      p.rest.longXp +
      ' XP; kurze Rast ' +
      p.rest.shortXp +
      ' XP.'
    );
  return (
    'Tagesbelastung ' +
    p.rest.longXp +
    ' / ' +
    f.budget +
    ' XP; kurze Rast ' +
    p.rest.shortXp +
    ' XP; ' +
    f.sections +
    ' verbleibende Rastabschnitte.' +
    (f.overdue
      ? ' Lange Rast fällig.'
      : ' Nächste Rastmarke bei ' + Math.ceil(f.nextRest) + ' XP Tagesbelastung.')
  );
}

/** Shortest unambiguous prefixes of stable IDs; independent of display order. */
export function partyIdentityPrefixes(ids: readonly string[]) {
  const sorted = [...ids].sort(),
    widths = new Map(ids.map((id) => [id, 8]));
  // A sorted ID shares its longest prefix with one of its two neighbours.
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!,
      b = sorted[i]!;
    let shared = 0;
    while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
    widths.set(a, Math.max(widths.get(a)!, shared + 1));
    widths.set(b, Math.max(widths.get(b)!, shared + 1));
  }
  return new Map(ids.map((id) => [id, id.slice(0, widths.get(id))]));
}

/** Keep ordinary names compact; distinguish namesakes over the full choice set,
 * so unchecking one never changes the identity shown in the confirmation. */
export function partyMemberLabels(members: readonly Character[]) {
  const key = (name: string) => name.normalize('NFC').replace(/\s+/gu, ' ').trim(),
    counts = new Map<string, number>();
  for (const member of members) {
    const name = key(member.profile.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const prefixes = partyIdentityPrefixes(members.map((member) => member.id));
  return new Map(
    members.map((member) => [
      member.id,
      member.profile.name +
        (counts.get(key(member.profile.name))! > 1
          ? ' · ' + (member.profile.playerName || 'Spieler offen') + ' · ' + prefixes.get(member.id)
          : ''),
    ]),
  );
}

/** Place and present membership describe a destination without renaming stored scenes. */
export function partySceneLabels(view: import('./live-contracts').LiveView) {
  const labels = view.scenes.map((scene) => ({
    id: scene.id,
    label:
      (scene.locationTitle || 'Ohne Ort') +
      ' · ' +
      (view.roster
        .filter((c) => c.active && c.sceneId === scene.id)
        .map((c) => c.profile.name)
        .join(', ') || 'Keine Figuren'),
  }));
  const groups = new Map<string, typeof labels>();
  for (const scene of labels) {
    const key = scene.label.normalize('NFC'),
      group = groups.get(key) ?? [];
    group.push(scene);
    groups.set(key, group);
  }
  const result = new Map<string, string>(labels.map((scene) => [scene.id, scene.label]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const prefixes = partyIdentityPrefixes(group.map((scene) => scene.id));
    for (const scene of group) result.set(scene.id, scene.label + ' · ' + prefixes.get(scene.id));
  }
  return result;
}
