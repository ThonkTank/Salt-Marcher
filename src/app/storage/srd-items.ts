import transcriptAsset from '../../features/catalog/data/items-srd51-transcript.json';
import manifestAsset from '../../features/catalog/data/items-srd51-source-manifest.json';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import type { ItemReferenceRecord } from '../catalog/item-reference-contracts';
import type { ItemDefinition } from '../catalog/item-definition-contracts';
const transcript = transcriptAsset as {
  complete: boolean;
  records: ItemReferenceRecord[];
};
const manifest = manifestAsset as {
  complete: boolean;
  coverage: { inventoryOccurrences: number; transcriptRecords: number };
  source: { license: string; pdfUrl: string };
};
export const srdItemSourceStatus = {
  complete: manifest.complete && transcript.complete,
  message: `${transcript.records.length} erfasste SRD-5.1-Definitionen + eigene Gegenstände · ${manifest.coverage.inventoryOccurrences}/459 Quellenfundstellen erfasst; vollständiger Katalog und unabhängige Quellenabnahme offen.`,
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function project(r: ItemReferenceRecord): ItemDefinition {
  const details: string[] = [];
  if (r.sourceHeader) details.push(r.sourceHeader.text);
  if (r.cost) details.push('Price: ' + r.cost.sourceText);
  if (r.armor) {
    const labels: Record<string, string> = {
      armorClassText: 'Armor Class',
      dexterityRuleText: 'Dexterity',
      strengthRequirementText: 'Strength',
      stealthRuleText: 'Stealth',
    };
    details.push(...Object.entries(r.armor).map(([k, v]) => (labels[k] ?? k) + ': ' + v));
  }
  if (r.damage) details.push('Damage: ' + Object.values(r.damage).join(' · '));
  if (r.speed) details.push('Speed: ' + r.speed.sourceText);
  if (r.carryingCapacity) details.push('Carrying capacity: ' + r.carryingCapacity.sourceText);
  for (const property of r.properties)
    if (property.description) details.push(property.name + ': ' + property.description);
  const cost = r.cost?.copperPieces;
  return {
    id: r.id,
    revision: 1,
    name: r.name,
    category: r.magic ? 'magic' : 'equipment',
    magic: r.magic,
    rarity: r.rarity?.value ?? r.rarity?.sourceText ?? '',
    attunement:
      r.attunement === 'required' ? 'yes' : r.attunement === 'not-required' ? 'no' : 'unspecified',
    unitCopper: cost === null || cost === undefined ? null : String(cost),
    weightText: r.weight?.sourceText ?? '',
    properties: r.properties.map((p) => p.name),
    description: [...details, ...r.description.map((d) => d.text)].join('\n\n'),
    source: {
      kind: 'srd51',
      label: 'SRD 5.1 · ' + r.source.pdfPages.map((p) => 'S. ' + p).join(', '),
      license: manifest.source.license,
      url: r.source.pdfUrl + '#page=' + r.source.pdfPages[0],
    },
    trashed: false,
    sourceHash: hash(canonicalJson(r)),
  };
}
export const srdItemDefinitions: readonly ItemDefinition[] = transcript.records.map(project);
