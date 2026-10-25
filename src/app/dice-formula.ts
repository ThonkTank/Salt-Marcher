import type { Creature, CreatureAction } from '../features/catalog/creature-catalog';

export interface ParsedDiceFormula {
  count: number;
  sides: number;
  modifier: number;
  formula: string;
}
export interface CreatureRollPreset {
  kind: 'attack' | 'damage' | 'save' | 'check';
  label: string;
  formula: string;
  dc: number | null;
  damageType?: string;
}
export const creatureRollKey = (preset: CreatureRollPreset) =>
  [preset.kind, preset.label, preset.formula, preset.dc ?? ''].join('\0');
export function legendaryActionCost(action: Pick<CreatureAction, 'name'>) {
  const match = /\(\s*costs?\s+(\d+)\s+actions?\s*\)/i.exec(action.name),
    cost = match ? Number(match[1]) : 1;
  return Number.isSafeInteger(cost) && cost >= 1 && cost <= 3 ? cost : 1;
}

export function parseDiceFormula(input: string): ParsedDiceFormula {
  if (typeof input !== 'string' || input.length > 100) throw new Error('Würfelformel ist zu lang.');
  const match = /^\s*(\d{0,3})d(\d{1,5})(?:\s*([+-])\s*(\d{1,6}))?\s*$/i.exec(input);
  if (!match) throw new Error('Würfelformel als NdS, optional mit +/− Modifikator eingeben.');
  const count = match[1] ? Number(match[1]) : 1,
    sides = Number(match[2]),
    modifier = match[4] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0;
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 100 ||
    !Number.isSafeInteger(sides) ||
    sides < 2 ||
    sides > 10000 ||
    Math.abs(modifier) > 1000
  )
    throw new Error(
      'Würfelformel erlaubt 1–100 Würfel, 2–10000 Seiten und Modifikatoren bis 1000.',
    );
  return {
    count,
    sides,
    modifier,
    formula:
      count +
      'd' +
      sides +
      (modifier > 0 ? ' + ' + modifier : modifier < 0 ? ' - ' + Math.abs(modifier) : ''),
  };
}

export function formulaOutcome(
  kind: CreatureRollPreset['kind'] | undefined,
  natural: number,
  total: number,
  dc: number | null,
) {
  return dc === null
    ? null
    : kind === 'attack' && natural === 20
      ? 'success'
      : kind === 'attack' && natural === 1
        ? 'failure'
        : total >= dc
          ? 'success'
          : 'failure';
}
export function criticalDamageFormula(input: string) {
  const parsed = parseDiceFormula(input),
    count = parsed.count * 2;
  if (count > 100) throw new Error('Kritischer Schaden überschreitet 100 Würfel.');
  return (
    count +
    'd' +
    parsed.sides +
    (parsed.modifier > 0
      ? ' + ' + parsed.modifier
      : parsed.modifier < 0
        ? ' - ' + Math.abs(parsed.modifier)
        : '')
  );
}

export function creatureActionRolls(action: CreatureAction): CreatureRollPreset[] {
  const found: CreatureRollPreset[] = [],
    keys = new Set<string>(),
    add = (preset: CreatureRollPreset) => {
      const key = creatureRollKey(preset);
      if (!keys.has(key)) {
        keys.add(key);
        found.push(preset);
      }
    };
  const attack = /([+-]\s*\d+)\s+to hit/i.exec(action.description);
  if (attack) {
    const modifier = Number(attack[1]!.replace(/\s/g, ''));
    add({
      kind: 'attack',
      label: action.name + ' · Angriff',
      formula: '1d20' + (modifier >= 0 ? '+' : '') + modifier,
      dc: null,
    });
  }
  const damage = /\d+\s*\((\d{1,3}d\d{1,5}(?:\s*[+-]\s*\d{1,6})?)\)\s*([a-z]+)\s+damage/gi;
  for (let match; (match = damage.exec(action.description)); )
    add({
      kind: 'damage',
      label: action.name + ' · ' + match[2] + ' Schaden',
      formula: parseDiceFormula(match[1]!).formula,
      dc: null,
      damageType: match[2]!.toLowerCase(),
    });
  const resisted = /DC\s+(\d+)\s+([A-Za-z]+)\s+(saving throw|check)/gi;
  for (let match; (match = resisted.exec(action.description)); ) {
    const kind = match[3]!.toLowerCase() === 'check' ? 'check' : 'save';
    add({
      kind,
      label: action.name + ' · ' + match[2] + ' ' + (kind === 'save' ? 'Rettungswurf' : 'Probe'),
      formula: '1d20',
      dc: Number(match[1]),
    });
  }
  return found;
}

/** Resolve only an unambiguous, complete reference sentence to an attack in this statblock. */
export function creatureActionForRolls(creature: Creature, action: CreatureAction): CreatureAction {
  if (creatureActionRolls(action).length) return action;
  const match = /^The [a-z ]+ makes (?:a|an) ([a-z -]+) attack\.$/i.exec(action.description.trim());
  if (!match) return action;
  const matches = creature.actions.filter(
    (candidate) =>
      candidate.name.toLowerCase() === match[1]!.toLowerCase() &&
      creatureActionRolls(candidate).some((p) => p.kind === 'attack'),
  );
  return matches.length === 1 ? { ...action, description: matches[0]!.description } : action;
}
export function creatureAverageDamage(action: CreatureAction) {
  const matches = [
    ...action.description.matchAll(
      /(\d+)\s*\(\d{1,3}d\d{1,5}(?:\s*[+-]\s*\d{1,6})?\)\s*[a-z]+\s+damage/gi,
    ),
  ];
  return matches.length === 1 ? Number(matches[0]![1]) : null;
}

export const isLegendaryAction = (creature: Creature, action: CreatureAction) =>
  creature.legendaryActions.some((candidate) => candidate.id === action.id);
