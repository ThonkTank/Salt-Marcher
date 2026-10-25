import Ajv2020 from 'ajv/dist/2020';
import transcript from '../../features/catalog/data/items-srd51-transcript.json';
import schema from '../../features/catalog/data/items-srd51-schema-v1.json';
import type {
  ItemReferenceRecord,
  ItemReferencePage,
  ItemReferenceQuery,
} from '../item-reference-contracts';
const compare = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }),
  rarity = (r: ItemReferenceRecord) => r.rarity?.value ?? r.rarity?.sourceText ?? '';
const rarityValues = (r: ItemReferenceRecord) =>
  r.rarity?.choices?.length ? r.rarity.choices.map((c) => c.value) : [rarity(r)];
/** The pinned source projection is separate from editable definitions, shops and rewards. */
export function createItemReferenceReader(data: unknown) {
  let records: ItemReferenceRecord[] | null = null,
    problem: ItemReferencePage['status'] = 'ready';
  const empty = (status: ItemReferencePage['status'], message: string): ItemReferencePage => ({
    status,
    message,
    rows: [],
    total: 0,
    offset: 0,
    limit: 50,
    categories: [],
    subcategories: [],
    rarities: [],
    license: 'CC-BY-4.0',
  });
  return (query: ItemReferenceQuery): ItemReferencePage => {
    if (data === null || data === undefined)
      return empty(
        'missing',
        'Lokaler SRD-Itemimport fehlt. Andere Katalogbereiche bleiben verfügbar.',
      );
    if (!records && problem === 'ready') {
      const valid = new Ajv2020({ strict: false }).compile(schema);
      if (!valid(data)) problem = 'incompatible';
      else {
        const rows = (data as { records: ItemReferenceRecord[] }).records;
        if (new Set(rows.map((r) => r.id)).size !== rows.length) problem = 'incompatible';
        else records = rows;
      }
    }
    if (problem !== 'ready' || !records)
      return empty(
        'incompatible',
        'Lokales Items-Schema ist inkompatibel oder beschädigt. Der Quellenimport muss zur Produktversion passen.',
      );
    const values = (key: 'category' | 'subcategory') =>
        [...new Set(records!.map((r) => r[key]))].sort(compare.compare),
      categories = values('category'),
      subcategories = values('subcategory'),
      rarities = [...new Set(records.flatMap(rarityValues).filter(Boolean))].sort(compare.compare);
    const invalid = () => ({
      ...empty(
        'invalid',
        'Filter prüfen: gültige Auswahl, nichtnegative Preise und Minimum ≤ Maximum verwenden.',
      ),
      categories,
      subcategories,
      rarities,
    });
    if (
      !query ||
      typeof query.name !== 'string' ||
      query.name.length > 1000 ||
      !['category', 'subcategory', 'rarity', 'minimumCopper', 'maximumCopper'].every(
        (k) => typeof query[k as keyof ItemReferenceQuery] === 'string',
      ) ||
      !['', 'yes', 'no'].includes(query.magic) ||
      !['', 'required', 'not-required', 'unspecified'].includes(query.attunement) ||
      !['name', 'category', 'rarity', 'cost'].includes(query.sort) ||
      !['asc', 'desc'].includes(query.direction) ||
      !Number.isSafeInteger(query.offset) ||
      query.offset < 0 ||
      query.offset % 50 !== 0 ||
      (query.category && !categories.includes(query.category)) ||
      (query.subcategory && !subcategories.includes(query.subcategory)) ||
      (query.rarity && !rarities.includes(query.rarity))
    )
      return invalid();
    const money = (s: string) =>
        s === '' ? null : /^(0|[1-9][0-9]{0,17})$/.test(s) ? BigInt(s) : undefined,
      min = money(query.minimumCopper),
      max = money(query.maximumCopper);
    if (min === undefined || max === undefined || (min !== null && max !== null && min > max))
      return invalid();
    const name = query.name.trim().toLocaleLowerCase('en'),
      rows = records.filter(
        (r) =>
          r.name.toLocaleLowerCase('en').includes(name) &&
          (!query.category || r.category === query.category) &&
          (!query.subcategory || r.subcategory === query.subcategory) &&
          (!query.rarity || rarityValues(r).includes(query.rarity)) &&
          (!query.magic || r.magic === (query.magic === 'yes')) &&
          (!query.attunement || r.attunement === query.attunement) &&
          ((min === null && max === null) ||
            (r.cost?.copperPieces != null &&
              (min === null || BigInt(r.cost.copperPieces) >= min) &&
              (max === null || BigInt(r.cost.copperPieces) <= max))),
      );
    rows.sort((a, b) => {
      let order = 0;
      if (query.sort === 'cost') {
        const x = a.cost?.copperPieces,
          y = b.cost?.copperPieces;
        if (x == null || y == null) {
          if (x != null) return -1;
          if (y != null) return 1;
        } else order = x - y;
      } else
        order = compare.compare(
          query.sort === 'rarity' ? rarity(a) : a[query.sort],
          query.sort === 'rarity' ? rarity(b) : b[query.sort],
        );
      return (
        order * (query.direction === 'desc' ? -1 : 1) ||
        compare.compare(a.name, b.name) ||
        a.id.localeCompare(b.id)
      );
    });
    return {
      status: 'ready',
      complete: (data as { complete: boolean }).complete,
      message:
        records.length +
        ' lokale SRD-5.1-Einträge' +
        ((data as { complete: boolean }).complete
          ? ''
          : ' · Unvollständiger Katalog: Weitere magische Gegenstände fehlen.'),
      rows: structuredClone(rows.slice(query.offset, query.offset + 50)),
      total: rows.length,
      offset: query.offset,
      limit: 50,
      categories,
      subcategories,
      rarities,
      license: 'CC-BY-4.0',
    };
  };
}
export const readItemReferenceCatalog = createItemReferenceReader(transcript);
