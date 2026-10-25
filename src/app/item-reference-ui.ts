import { copper } from './progression';
import type {
  ItemReferencePage,
  ItemReferenceQuery,
  ItemReferenceRecord,
} from './item-reference-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const labels: Record<string, string> = {
  ring: 'Ring',
  equipment: 'Ausrüstung',
  'magic-item': 'Magischer Gegenstand',
  common: 'Gewöhnlich',
  uncommon: 'Ungewöhnlich',
  rare: 'Selten',
  'very-rare': 'Sehr selten',
  legendary: 'Legendär',
  required: 'Erforderlich',
  'not-required': 'Nicht erforderlich',
  unspecified: 'Nicht angegeben',
  'adventuring-gear-standard': 'Abenteuerausrüstung',
  ammunition: 'Munition',
  'arcane-focus': 'Arkaner Fokus',
  armor: 'Rüstung',
  'armor-heavy': 'Schwere Rüstung',
  'armor-light': 'Leichte Rüstung',
  'armor-medium': 'Mittelschwere Rüstung',
  'artisans-tools': 'Handwerkszeug',
  'druidic-focus': 'Druidischer Fokus',
  'equipment-pack': 'Ausrüstungspaket',
  'gaming-set': 'Spielset',
  'holy-symbol': 'Heiliges Symbol',
  kit: 'Ausrüstungsset',
  'mount-or-animal': 'Reittiere und Tiere',
  'musical-instrument': 'Musikinstrument',
  'other-tools': 'Sonstiges Werkzeug',
  potion: 'Trank',
  shield: 'Schild',
  'tack-harness-or-drawn-vehicle': 'Sättel, Geschirr und Zugfahrzeuge',
  'waterborne-vehicle': 'Wasserfahrzeuge',
  weapon: 'Waffe',
  'weapon-martial-melee': 'Nahkampf · Kriegswaffen',
  'weapon-martial-ranged': 'Fernkampf · Kriegswaffen',
  'weapon-simple-melee': 'Nahkampf · Einfache Waffen',
  'weapon-simple-ranged': 'Fernkampf · Einfache Waffen',
  'wondrous-item': 'Wundersamer Gegenstand',
};
const label = (s: string) => labels[s] ?? s.replaceAll('-', ' ');
export class ItemReferenceCatalog {
  private request = 0;
  private active = false;
  private needsSearch = true;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private offset = 0;
  private sort: ItemReferenceQuery['sort'] = 'name';
  private direction: ItemReferenceQuery['direction'] = 'asc';
  private page: ItemReferencePage | null = null;
  private form = node('form');
  private fields = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private extra = node('details');
  private extraSummary = node('summary');
  private body = node('tbody');
  private detail = node('article');
  private state = node('p');
  private credit = node('details');
  private creditSummary = node('summary');
  private creditText = node('p');
  private prev = node('button', '← Zurück');
  private next = node('button', 'Weiter →');
  private table = node('table');
  constructor(private root: HTMLElement) {
    root.id = 'catalog-item-reference';
    root.setAttribute('role', 'tabpanel');
    root.setAttribute('aria-labelledby', 'catalog-items-tab');
    root.className = 'catalog-columns item-reference-columns';
    root.hidden = true;
    const browser = node('section'),
      inspector = node('section');
    browser.className = 'catalog-browser';
    inspector.className = 'catalog-inspector';
    inspector.id = 'item-reference-inspector';
    this.detail.id = 'item-reference-detail';
    this.state.id = 'item-reference-status';
    this.state.setAttribute('role', 'status');
    this.credit.id = 'item-reference-credit';
    this.body.id = 'item-reference-rows';
    const field = (
      key: string,
      title: string,
      options?: [string, string][],
      parent: HTMLElement = this.form,
    ) => {
      const wrapper = node('label', title),
        input = options ? node('select') : node('input');
      input.id = 'item-reference-' + key;
      input.setAttribute('aria-label', title);
      if (input.tagName === 'INPUT')
        (input as HTMLInputElement).type = key === 'name' ? 'search' : 'text';
      if (options)
        for (const [value, text] of [['', 'Alle'] as [string, string], ...options]) {
          const o = node('option', text);
          o.value = value;
          (input as HTMLSelectElement).append(o);
        }
      wrapper.append(input);
      parent.append(wrapper);
      this.fields.set(key, input);
    };
    field('name', 'Gegenstandsname');
    field('category', 'Kategorie', []);
    field('subcategory', 'Ausrüstungsart', []);
    field('maximum', 'Preis bis (GM)');
    this.extra.id = 'item-reference-extra';
    const extraFields = node('div');
    extraFields.className = 'item-reference-extra-fields';
    this.extra.append(this.extraSummary, extraFields);
    this.form.append(this.extra);
    field('rarity', 'Seltenheit', [], extraFields);
    field(
      'magic',
      'Magisch',
      [
        ['yes', 'Ja'],
        ['no', 'Nein'],
      ],
      extraFields,
    );
    field(
      'attunement',
      'Einstimmung',
      ['required', 'not-required', 'unspecified'].map((v) => [v, label(v)]),
      extraFields,
    );
    field('minimum', 'Preis ab (GM)', undefined, extraFields);
    const submit = node('button', 'Suchen'),
      reset = node('button', 'Filter zurücksetzen');
    submit.type = 'submit';
    reset.type = 'button';
    this.form.append(submit, reset);
    this.form.id = 'item-reference-form';
    this.form.onsubmit = (e) => {
      e.preventDefault();
      this.offset = 0;
      void this.search();
    };
    this.form.oninput = () => {
      this.offset = 0;
      this.invalidate('Items werden gesucht…');
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.search();
      }, 200);
    };
    reset.onclick = () => {
      for (const field of this.fields.values()) field.value = '';
      this.offset = 0;
      void this.search();
    };
    const head = node('thead'),
      tr = node('tr');
    for (const [key, title] of [
      ['name', 'Name'],
      ['category', 'Kategorie'],
      ['rarity', 'Seltenheit'],
      ['cost', 'Preis'],
    ]) {
      const th = node('th'),
        b = node('button', title);
      b.type = 'button';
      b.dataset.sort = key;
      b.dataset.label = title;
      b.onclick = () => {
        this.direction = this.sort === key && this.direction === 'asc' ? 'desc' : 'asc';
        this.sort = key as ItemReferenceQuery['sort'];
        this.offset = 0;
        void this.search();
      };
      th.append(b);
      tr.append(th);
    }
    head.append(tr);
    this.table.append(head, this.body);
    this.table.id = 'item-reference-table';
    const scroll = node('div');
    scroll.className = 'catalog-table-scroll';
    scroll.append(this.table);
    this.prev.type = this.next.type = 'button';
    this.prev.onclick = () => {
      this.offset = Math.max(0, this.offset - 50);
      void this.search();
    };
    this.next.onclick = () => {
      this.offset += 50;
      void this.search();
    };
    const paging = node('div');
    paging.className = 'toolbar';
    paging.append(this.prev, this.next);
    const returnToResults = node('button', '← Zur Trefferliste');
    returnToResults.type = 'button';
    returnToResults.id = 'item-reference-results-return';
    returnToResults.onclick = () => {
      if (!this.active) return;
      const target =
        this.body.querySelector<HTMLButtonElement>('button[aria-pressed=true]') ??
        this.fields.get('name')!;
      target.scrollIntoView({ block: 'center' });
      target.focus({ preventScroll: true });
    };
    this.credit.append(this.creditSummary, this.creditText);
    browser.append(this.form, this.state, this.credit, scroll, paging);
    inspector.append(returnToResults, this.detail);
    root.append(browser, inspector);
    this.invalidate('Items noch nicht geladen.');
  }
  activate() {
    this.invalidate('Items noch nicht geladen.');
  }
  show(on: boolean) {
    this.active = on;
    this.root.hidden = !on;
    if (on) {
      if (this.needsSearch && !this.pending && !this.timer) void this.search();
    } else this.cancelRequest();
  }
  // Hiding stops scheduling and response authority, retaining the accepted page.
  private cancelRequest() {
    this.request++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
    this.table.setAttribute('aria-busy', 'false');
  }
  private invalidate(text: string) {
    this.cancelRequest();
    const extraCount = ['rarity', 'magic', 'attunement', 'minimum'].filter((key) =>
      (this.fields.get(key)!.value ?? '').trim(),
    ).length;
    this.extraSummary.textContent =
      'Weitere Filter' + (extraCount ? ' · ' + extraCount + ' aktiv' : '');
    this.needsSearch = true;
    this.page = null;
    this.body.replaceChildren();
    this.detail.replaceChildren(
      node('h3', 'Gegenstandsreferenz'),
      node('p', 'Wähle einen Gegenstand.'),
    );
    this.state.textContent = text;
    this.state.setAttribute('role', 'status');
    this.prev.disabled = this.next.disabled = true;
  }
  private query(): ItemReferenceQuery {
    const value = (key: string) => this.fields.get(key)!.value,
      money = (key: string) => {
        try {
          return value(key).trim() ? copper(value(key)) : '';
        } catch {
          return 'invalid';
        }
      };
    return {
      name: value('name'),
      category: value('category'),
      subcategory: value('subcategory'),
      rarity: value('rarity'),
      magic: value('magic') as ItemReferenceQuery['magic'],
      attunement: value('attunement'),
      minimumCopper: money('minimum'),
      maximumCopper: money('maximum'),
      sort: this.sort,
      direction: this.direction,
      offset: this.offset,
    };
  }
  private async search() {
    if (!this.active) return;
    this.invalidate('Items werden gesucht…');
    const request = this.request;
    this.pending = true;
    this.table.setAttribute('aria-busy', 'true');
    try {
      const result = await window.campaign.itemReferenceCatalog(this.query());
      if (!this.active || request !== this.request) return;
      if (!result.ok) throw new Error(result.error);
      this.page = result.value;
      this.needsSearch = false;
      this.render();
    } catch (e) {
      if (this.active && request === this.request) {
        this.needsSearch = false;
        this.state.textContent =
          'Items konnten nicht gelesen werden: ' +
          (e as Error).message +
          ' · Mit Suchen erneut versuchen.';
        this.state.setAttribute('role', 'alert');
      }
    } finally {
      if (this.active && request === this.request) {
        this.pending = false;
        this.table.setAttribute('aria-busy', 'false');
      }
    }
  }
  private render() {
    const page = this.page!;
    this.creditText.textContent = page.message + ' · ' + page.license;
    this.creditSummary.textContent =
      page.status === 'ready'
        ? 'Lokale SRD-Quelle · ' +
          (page.complete === false
            ? 'unvollständig'
            : page.complete === true
              ? 'vollständig'
              : 'Vollständigkeit unbekannt')
        : 'Quellenhinweis';
    for (const [key, values] of [
      ['category', page.categories],
      ['subcategory', page.subcategories],
      ['rarity', page.rarities],
    ] as const) {
      const select = this.fields.get(key) as HTMLSelectElement,
        chosen = select.value;
      select.replaceChildren();
      for (const value of [
        '',
        ...values.slice().sort((a, b) => label(a).localeCompare(label(b), 'de')),
      ]) {
        const o = node('option', value ? label(value) : 'Alle');
        o.value = value;
        select.append(o);
      }
      select.value = chosen;
    }
    if (page.status !== 'ready') {
      this.state.textContent = page.message;
      this.state.setAttribute('role', page.status === 'missing' ? 'status' : 'alert');
      return;
    }
    this.state.textContent = page.total
      ? `${page.offset + 1}–${Math.min(page.total, page.offset + page.limit)} von ${page.total} Gegenständen`
      : 'Keine Treffer im lokalen Katalog für diese Filter.';
    this.prev.disabled = !page.offset;
    this.next.disabled = page.offset + page.limit >= page.total;
    for (const th of this.table.querySelectorAll('th')) {
      const b = th.querySelector('button')!,
        active = b.dataset.sort === this.sort;
      th.setAttribute(
        'aria-sort',
        active ? (this.direction === 'asc' ? 'ascending' : 'descending') : 'none',
      );
      b.textContent = b.dataset.label! + (active ? (this.direction === 'asc' ? ' ↑' : ' ↓') : '');
    }
    for (const item of page.rows) {
      const tr = node('tr'),
        name = node('td'),
        button = node('button', item.name);
      button.type = 'button';
      button.dataset.itemId = item.id;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        if (!this.active || page !== this.page || !button.isConnected) return;
        for (const b of this.body.querySelectorAll('button'))
          b.setAttribute('aria-pressed', String(b === button));
        this.inspect(item);
        if (window.matchMedia?.('(max-width:1100px)').matches) {
          this.detail.parentElement!.scrollIntoView({ block: 'start' });
          this.detail.tabIndex = -1;
          this.detail.focus({ preventScroll: true });
        }
      };
      name.append(button);
      tr.append(
        name,
        ...[
          label(item.category),
          label(item.rarity?.value ?? item.rarity?.sourceText ?? 'Nicht angegeben'),
          item.cost?.sourceText ?? 'Nicht angegeben',
        ].map((s) => node('td', s)),
      );
      this.body.append(tr);
    }
  }
  private inspect(item: ItemReferenceRecord) {
    this.detail.replaceChildren(node('h3', item.name));
    const rules = node('section');
    rules.className = 'item-reference-rules';
    if (item.sourceHeader) rules.append(node('p', item.sourceHeader.text));
    for (const paragraph of item.description) rules.append(node('p', paragraph.text));
    if (item.magic) this.detail.append(rules);
    const facts = node('dl'),
      fact = (name: string, value: string) => facts.append(node('dt', name), node('dd', value));
    fact('Kategorie', label(item.category) + ' · ' + label(item.subcategory));
    if (item.magic) fact('Magisch', 'Ja');
    if (item.magic || item.rarity)
      fact('Seltenheit', label(item.rarity?.value ?? item.rarity?.sourceText ?? 'Nicht angegeben'));
    if (item.magic || item.attunement !== 'unspecified')
      fact('Einstimmung', label(item.attunement));
    fact('Preis', item.cost?.sourceText ?? 'Nicht angegeben');
    fact('Gewicht', item.weight?.sourceText ?? 'Nicht angegeben');
    for (const [name, data] of [
      ['Rüstung', item.armor],
      ['Schaden', item.damage],
    ] as const)
      if (data)
        for (const [field, text] of Object.entries(data))
          fact(
            (
              {
                armorClassText: 'Rüstungsklasse',
                dexterityRuleText: 'Geschicklichkeit',
                strengthRequirementText: 'Stärke',
                stealthRuleText: 'Heimlichkeit',
                diceText: 'Schadenswürfel',
                typeText: 'Schadenstyp',
                versatileDiceText: 'Vielseitig',
              } as Record<string, string>
            )[field] ?? name,
            text,
          );
    if (item.speed) fact('Geschwindigkeit', item.speed.sourceText);
    if (item.carryingCapacity) fact('Tragfähigkeit', item.carryingCapacity.sourceText);
    this.detail.append(facts);
    for (const property of item.properties)
      this.detail.append(
        node('p', property.name + (property.description ? ' · ' + property.description : '')),
      );
    for (const choice of item.rarity?.choices ?? [])
      this.detail.append(node('p', label(choice.value) + ' · ' + choice.label));
    if (!item.magic) this.detail.append(rules);
    const source = node('section');
    source.append(
      node('h5', 'Quelle'),
      node(
        'p',
        item.source.document + ' · PDF-Seiten ' + item.source.pdfPages.join(', ') + ' · CC BY 4.0',
      ),
      node('p', item.source.pdfUrl),
    );
    this.detail.append(source);
  }
}
