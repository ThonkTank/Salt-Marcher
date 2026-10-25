import type { ShopRestockCatalog } from './items-contracts';
import { copper } from './progression';

export const newRestockCatalog = (): ShopRestockCatalog => ({
  filter: { search: '', category: '', magic: '', rarity: '', attunement: '', source: '' },
  minimum: 1,
  maximum: 1,
  buyCopper: '100',
  sellCopper: '50',
});
export function renderRestockCatalog(
  root: HTMLElement,
  catalog: ShopRestockCatalog,
  options: {
    changed: () => void;
    button: (title: string, action: () => Promise<unknown> | void) => HTMLButtonElement;
  },
) {
  const fields = document.createElement('div');
  fields.className = 'time-fields';
  root.append(fields);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent =
    'Jeder passende Gegenstand hat dieselbe Chance. Erst gezogene Waren werden dem Bestand hinzugefügt.';
  const changed = () => {
    status.textContent = 'Filter oder Lieferwerte geändert. Treffervorschau erneut prüfen.';
    options.changed();
  };
  const input = (labelText: string, value: string, type: string, update: (v: string) => void) => {
    const label = document.createElement('label'),
      input = document.createElement('input');
    label.textContent = labelText;
    input.value = value;
    input.type = type;
    if (type === 'number') {
      input.min = '1';
      input.max = '1000000';
      input.step = '1';
    }
    input.oninput = () => {
      update(input.value);
      changed();
    };
    label.append(input);
    fields.append(label);
  };
  const select = (
    title: string,
    value: string,
    choices: [string, string][],
    update: (v: string) => void,
  ) => {
    const label = document.createElement('label'),
      select = document.createElement('select');
    label.textContent = title;
    select.setAttribute('aria-label', title);
    for (const [v, text] of choices) {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = text;
      select.append(option);
    }
    select.value = value;
    select.onchange = () => {
      update(select.value);
      changed();
    };
    label.append(select);
    fields.append(label);
  };
  const f = catalog.filter;
  input('Katalogsuche', f.search, 'search', (v) => (f.search = v));
  select(
    'Warenkategorie',
    f.category,
    [
      ['', 'Alle'],
      ['coins', 'Münzen'],
      ['equipment', 'Ausrüstung'],
      ['trade-goods', 'Handelswaren'],
      ['magic', 'Magische Gegenstände'],
      ['other', 'Sonstiges'],
    ],
    (v) => (f.category = v),
  );
  select(
    'Magische Waren',
    f.magic,
    [
      ['', 'Alle'],
      ['yes', 'Ja'],
      ['no', 'Nein'],
    ],
    (v) => (f.magic = v as typeof f.magic),
  );
  input('Seltenheit der Waren', f.rarity, 'text', (v) => (f.rarity = v));
  select(
    'Einstimmung der Waren',
    f.attunement,
    [
      ['', 'Alle'],
      ['yes', 'Erforderlich'],
      ['no', 'Nicht erforderlich'],
      ['unspecified', 'Offen'],
    ],
    (v) => (f.attunement = v),
  );
  select(
    'Katalogquelle',
    f.source ?? '',
    [
      ['', 'Alle Quellen'],
      ['authored', 'Eigene Definitionen'],
      ['srd51', 'SRD 5.1'],
    ],
    (v) => (f.source = v as typeof f.source),
  );
  input(
    'Katalog: Mindestmenge je Treffer',
    String(catalog.minimum),
    'number',
    (v) => (catalog.minimum = Number(v)),
  );
  input(
    'Katalog: Höchstmenge je Treffer',
    String(catalog.maximum),
    'number',
    (v) => (catalog.maximum = Number(v)),
  );
  const price = (v: string) =>
    /^(0|[1-9][0-9]{0,17})$/.test(v)
      ? BigInt(v) / 100n + '.' + (BigInt(v) % 100n).toString().padStart(2, '0')
      : v;
  const setPrice = (value: string, key: 'buyCopper' | 'sellCopper') => {
    try {
      catalog[key] = copper(value);
    } catch {
      catalog[key] = value + '?';
    }
  };
  input('Neue Waren: Kaufpreis je Stück (GM)', price(catalog.buyCopper), 'text', (v) =>
    setPrice(v, 'buyCopper'),
  );
  input('Neue Waren: Verkaufspreis je Stück (GM)', price(catalog.sellCopper), 'text', (v) =>
    setPrice(v, 'sellCopper'),
  );
  const hint = document.createElement('p');
  hint.textContent =
    'Passende Mengenstapel derselben Gegenstandsrevision werden ergänzt; ihre Preise und Notizen bleiben erhalten. Neue Definitionen erhalten neue Zeilen mit diesen Preisen. Einzelstücke bleiben unberührt. Jede Lieferung nutzt den dann aktuellen Katalog. Ohne Treffer liefert sie keine Waren; der Termin gilt trotzdem als abgearbeitet.';
  root.append(hint);
  const preview = options.button('Katalogtreffer prüfen', async () => {
    const filter = structuredClone(catalog.filter),
      basis = JSON.stringify(catalog);
    status.textContent = 'Katalog wird durchsucht …';
    const response = await window.campaign.itemDefinitions({
      ...filter,
      sort: 'name',
      direction: 'asc',
      after: 0,
      includeTrashed: false,
    });
    if (!root.isConnected) return;
    if (basis !== JSON.stringify(catalog)) {
      status.textContent = 'Filter inzwischen geändert. Treffervorschau erneut prüfen.';
      return;
    }
    if (!response.ok) {
      status.textContent = response.error;
      return;
    }
    const result = response.value;
    status.textContent =
      result.total +
      ' passende Gegenstände' +
      (result.items.length
        ? ' · ' +
          result.items
            .slice(0, 8)
            .map((d) => d.name)
            .join(', ') +
          (result.total > 8 ? ' …' : '')
        : '') +
      (result.problems.length
        ? ' · ' + result.problems.length + ' unlesbare Definitionen ausgeschlossen.'
        : '') +
      (!result.sourceStatus.complete && filter.source !== 'authored'
        ? ' · ' + result.sourceStatus.message
        : '');
  });
  root.append(preview, status);
}
