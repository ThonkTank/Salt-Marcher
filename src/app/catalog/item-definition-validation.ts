import type { ItemDefinition } from './item-definition-contracts';

const categories = ['coins', 'equipment', 'trade-goods', 'magic', 'other'];
const fields = [
  'id',
  'revision',
  'name',
  'category',
  'magic',
  'rarity',
  'attunement',
  'unitCopper',
  'weightText',
  'properties',
  'description',
  'source',
  'trashed',
];
export function checkedDefinition(d: ItemDefinition): ItemDefinition {
  if (
    !d ||
    typeof d !== 'object' ||
    Array.isArray(d) ||
    fields.some((key) => !Object.hasOwn(d, key)) ||
    Object.keys(d).some((key) => !fields.includes(key) && key !== 'sourceHash') ||
    typeof d.id !== 'string' ||
    !d.id ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1 ||
    typeof d.name !== 'string' ||
    !d.name.trim() ||
    d.name.length > 1000 ||
    !categories.includes(d.category) ||
    typeof d.magic !== 'boolean' ||
    typeof d.trashed !== 'boolean' ||
    !['no', 'yes', 'unspecified'].includes(d.attunement) ||
    typeof d.rarity !== 'string' ||
    typeof d.weightText !== 'string' ||
    typeof d.description !== 'string' ||
    d.description.length > 100000 ||
    !Array.isArray(d.properties) ||
    d.properties.some((p) => typeof p !== 'string') ||
    (d.unitCopper !== null &&
      (typeof d.unitCopper !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(d.unitCopper)))
  )
    throw new Error('Gegenstandsdefinition hat ungültige Felder. Originalbytes bleiben erhalten.');
  const s = d.source;
  if (
    !s ||
    typeof s !== 'object' ||
    Array.isArray(s) ||
    Object.keys(s).length !== 4 ||
    !['authored', 'srd51'].includes(s.kind) ||
    typeof s.label !== 'string' ||
    !s.label.trim() ||
    (s.license !== null && typeof s.license !== 'string') ||
    (s.url !== null && typeof s.url !== 'string') ||
    (d.sourceHash !== undefined && typeof d.sourceHash !== 'string')
  )
    throw new Error('Gegenstandsquelle hat ein unbekanntes Format.');
  return d;
}

/** Construct the next authored snapshot; conflict and source ownership checks stay with Main. */
export function nextAuthoredDefinition(
  input: ItemDefinition,
  expected: number | null,
): ItemDefinition {
  return checkedDefinition({
    ...input,
    revision: (expected ?? 0) + 1,
    source: { ...input.source, kind: 'authored' },
  });
}
