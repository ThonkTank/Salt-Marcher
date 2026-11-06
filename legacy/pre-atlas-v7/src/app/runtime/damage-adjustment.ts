import type { Creature } from '../../features/catalog/creature-catalog';
import type { CreatureRollPreset } from '../shared/dice-formula';
export type DamageScale = 'auto' | 'full' | 'half' | 'double' | 'none';
export const damageTypes = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;
export type DamageType = (typeof damageTypes)[number];
const types: readonly string[] = damageTypes;
export function isDamageType(value: unknown): value is DamageType {
  return typeof value === 'string' && types.includes(value);
}
/** Only a plain list proves unconditional protection. Conditional clauses stay visible for the GM. */
function matches(text: string, type: string): 'yes' | 'no' | 'conditional' {
  const raw = text.toLowerCase().trim();
  if (!raw) return 'no';
  const list = (value: string) =>
    value
      .replace(/\band\b/g, ',')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const all = list(raw);
  if (all.every((t) => types.includes(t))) return all.includes(type) ? 'yes' : 'no';
  // In the SRD's physical-damage clauses, "from …" qualifies the whole physical group.
  const physical = /\b(?:bludgeoning|piercing|slashing)\b(?=[\s\S]*\bfrom\b)/.exec(raw);
  if (physical) {
    const prefix = list(raw.slice(0, physical.index));
    if (prefix.includes(type)) return 'yes';
    const conditional = raw.slice(physical.index),
      named = types.filter((t) => new RegExp('\\b' + t + '\\b').test(conditional));
    if (named.includes(type) || prefix.some((t) => !types.includes(t))) return 'conditional';
    return 'no';
  }
  return 'conditional';
}
export function adjustedDamage(
  amount: number,
  scale: DamageScale,
  source: Creature | undefined,
  type?: string,
): { amount: number | null; note: string } {
  if (scale !== 'auto')
    return {
      amount:
        scale === 'half'
          ? Math.floor(amount / 2)
          : scale === 'double'
            ? amount * 2
            : scale === 'none'
              ? 0
              : amount,
      note:
        'Manuell: ' +
        ({ full: 'Voll', half: 'Halb', double: 'Doppelt', none: 'Kein Schaden' } as const)[scale],
    };
  if (!source) return { amount, note: 'Kein Zielstatblock: Abwehr am Tisch prüfen.' };
  if (!type || !types.includes(type))
    return { amount: null, note: 'Schadensart unklar: Anpassung wählen.' };
  const immunity = matches(source.damageImmunities, type),
    resistance = matches(source.damageResistances, type),
    vulnerability = matches(source.damageVulnerabilities, type);
  if (immunity === 'yes') return { amount: 0, note: 'Immunität: ' + type + ' → kein Schaden' };
  const conditional = [
    immunity === 'conditional' && 'Immunität: ' + source.damageImmunities,
    resistance === 'conditional' && 'Resistenz: ' + source.damageResistances,
    vulnerability === 'conditional' && 'Verwundbarkeit: ' + source.damageVulnerabilities,
  ].filter(Boolean);
  if (conditional.length)
    return {
      amount: null,
      note: conditional.join(' · ') + ' · Bedingung am Tisch prüfen und Anpassung wählen.',
    };
  const halved = resistance === 'yes' ? Math.floor(amount / 2) : amount,
    result = vulnerability === 'yes' ? halved * 2 : halved;
  return {
    amount: result,
    note:
      [
        resistance === 'yes' && 'Resistenz: ' + type,
        vulnerability === 'yes' && 'Verwundbarkeit: ' + type,
      ]
        .filter(Boolean)
        .join(' · ') || 'Statblock: voller ' + type + '-Schaden',
  };
}

export function adjustedHitDamage(
  preset: CreatureRollPreset,
  amount: number,
  scale: DamageScale,
  source: Creature | undefined,
) {
  return adjustedDamage(amount, scale, source, preset.damageType);
}
