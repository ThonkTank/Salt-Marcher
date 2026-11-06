import { createHash } from 'node:crypto';
import type { ItemDefinition } from '../catalog/item-definition-contracts';

// SRD 5.1, Equipment / Coinage. One definition per denomination; quantities
// belong to treasures and ledgers, just as they do for other catalog items.
export const coinDefinitions: readonly ItemDefinition[] = [
  ['cp', 'Kupfermünze', '1'],
  ['sp', 'Silbermünze', '10'],
  ['ep', 'Elektrummünze', '50'],
  ['gp', 'Goldmünze', '100'],
  ['pp', 'Platinmünze', '1000'],
].map(([id, name, unitCopper]) => {
  const definition: ItemDefinition = {
    id: 'srd51-coin-' + id,
    revision: 1,
    name: name!,
    category: 'coins',
    magic: false,
    rarity: '',
    attunement: 'no',
    unitCopper: unitCopper!,
    weightText: '1/50 lb.',
    properties: [],
    description: 'Münzwert: ' + unitCopper + ' Kupfer pro Stück.',
    source: {
      kind: 'srd51',
      label: 'SRD 5.1 · Coinage',
      license: 'CC BY 4.0',
      url: 'https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf',
    },
    trashed: false,
  };
  return {
    ...definition,
    sourceHash: createHash('sha256').update(JSON.stringify(definition)).digest('hex'),
  };
});
