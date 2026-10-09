import {
  type Creature,
  type CreatureCatalogPage,
  type CreatureCatalogQuery,
  type CreatureCatalogSort,
  creatureMatchesQuery,
} from "./creature-catalog";
import {
  CREATURE_CATALOG_PAGE_SIZE,
  adjacentCreatureId,
  applyCreatureCatalogPendingText,
  clearCreatureCatalogFilters,
  creatureCatalogActiveFilters,
  creatureCatalogQueryForState,
  creatureCatalogSortChange,
  normalizeCreatureCatalogViewState,
  type CreatureCatalogTextFilter,
  type CreatureCatalogViewState,
} from "./creature-catalog-view-state";

export interface CreatureCatalogSource {
  readonly creatures: readonly Creature[];
  search(
    query: CreatureCatalogQuery,
    signal?: AbortSignal,
  ): CreatureCatalogPage | Promise<CreatureCatalogPage>;
  detail(id: string): Creature | undefined;
}

export interface CreatureCatalogScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface CreatureCatalogControllerPorts {
  readonly root: HTMLElement;
  readonly loadCatalog: () => Promise<CreatureCatalogSource>;
  readonly notice: string;
  readonly scheduler: CreatureCatalogScheduler;
}

interface FocusState {
  readonly key: string;
  readonly start?: number | null;
  readonly end?: number | null;
}

type SelectField = "type" | "subtype" | "size" | "habitat" | "alignment";
type NumberField = "crMin" | "crMax" | "acMin" | "acMax" | "hpMin" | "hpMax";

function modifier(score: number): string {
  const value = Math.floor((score - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export function creatureCatalogLayout(
  width: number,
  height: number,
): "stacked" | "split" {
  return width <= 900 || height < 650 ? "stacked" : "split";
}

export class CreatureCatalogController {
  private catalog?: CreatureCatalogSource;
  private page?: CreatureCatalogPage;
  private state: CreatureCatalogViewState = {
    sort: "name",
    direction: "asc",
    page: 0,
  };
  private opened = false;
  private loadGeneration = 0;
  private queryGeneration = 0;
  private loadAbort = new AbortController();
  private queryAbort = new AbortController();
  private renderAbort = new AbortController();
  private lifecycleAbort = new AbortController();
  private debounceHandle?: unknown;

  constructor(private readonly ports: CreatureCatalogControllerPorts) {}

  getState(): Record<string, unknown> {
    this.captureScroll();
    const snapshot = applyCreatureCatalogPendingText(this.state);
    return {
      ...snapshot,
      pendingText: undefined,
    };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    this.cancelDebounce();
    this.state = applyCreatureCatalogPendingText({
      sort: "name",
      direction: "asc",
      page: 0,
      ...normalizeCreatureCatalogViewState(state),
    });
    if (this.opened && this.catalog) await this.refresh();
  }

  async open(): Promise<void> {
    if (this.opened) return;
    this.opened = true;
    this.lifecycleAbort = new AbortController();
    this.ports.root.classList.add("dn-creature-catalog");
    this.ports.root.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || !this.state.selectedId) return;
        event.preventDefault();
        this.change({ selectedId: undefined, detailScroll: 0 });
      },
      { signal: this.lifecycleAbort.signal },
    );
    await this.loadCatalog();
  }

  close(): void {
    if (!this.opened) return;
    this.captureScroll();
    this.state = applyCreatureCatalogPendingText(this.state);
    this.opened = false;
    this.cancelDebounce();
    this.loadAbort.abort();
    this.queryAbort.abort();
    this.renderAbort.abort();
    this.lifecycleAbort.abort();
    this.loadGeneration++;
    this.queryGeneration++;
    this.ports.root.removeAttribute("aria-busy");
    this.ports.root.replaceChildren();
  }

  setViewport(width: number, height: number): void {
    this.ports.root.dataset.catalogLayout = creatureCatalogLayout(
      width,
      height,
    );
  }

  private async loadCatalog(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loadAbort.abort();
    this.loadAbort = new AbortController();
    this.renderMessage("Monsterkatalog wird geladen …", "status");
    try {
      const catalog = await this.ports.loadCatalog();
      if (
        !this.opened ||
        generation !== this.loadGeneration ||
        this.loadAbort.signal.aborted
      )
        return;
      this.catalog = catalog;
      await this.refresh();
    } catch (error) {
      if (
        !this.opened ||
        generation !== this.loadGeneration ||
        this.loadAbort.signal.aborted
      )
        return;
      this.renderError(error);
    }
  }

  private query(): CreatureCatalogQuery {
    return creatureCatalogQueryForState(this.state);
  }

  private async refresh(): Promise<void> {
    if (!this.catalog || !this.opened) return;
    const generation = ++this.queryGeneration;
    this.queryAbort.abort();
    this.queryAbort = new AbortController();
    const signal = this.queryAbort.signal;
    this.ports.root.setAttribute("aria-busy", "true");
    try {
      let page = await this.catalog.search(this.query(), signal);
      if (!this.currentQuery(generation, signal)) return;
      const lastPage = Math.max(
        0,
        Math.ceil(page.total / CREATURE_CATALOG_PAGE_SIZE) - 1,
      );
      if ((this.state.page ?? 0) > lastPage) {
        this.state = { ...this.state, page: lastPage, resultsScroll: 0 };
        page = await this.catalog.search(this.query(), signal);
        if (!this.currentQuery(generation, signal)) return;
      }
      if (this.state.selectedId) {
        const selected = this.catalog.detail(this.state.selectedId);
        if (!selected || !creatureMatchesQuery(selected, this.query()))
          this.state = {
            ...this.state,
            selectedId: undefined,
            detailScroll: 0,
          };
      }
      this.page = page;
      this.ports.root.setAttribute("aria-busy", "false");
      this.render();
    } catch (error) {
      if (!this.currentQuery(generation, signal)) return;
      this.ports.root.setAttribute("aria-busy", "false");
      this.renderError(error);
    }
  }

  private currentQuery(generation: number, signal: AbortSignal): boolean {
    return (
      this.opened && generation === this.queryGeneration && !signal.aborted
    );
  }

  private renderMessage(text: string, role: "status" | "alert"): void {
    this.resetRenderEvents();
    this.ports.root.replaceChildren();
    const message = this.ports.root.ownerDocument.createElement("p");
    message.className = "dn-catalog-message";
    message.setAttribute("role", role);
    message.textContent = text;
    this.ports.root.append(message);
  }

  private renderError(error: unknown): void {
    this.resetRenderEvents();
    this.ports.root.replaceChildren();
    const alert = this.ports.root.ownerDocument.createElement("section");
    alert.className = "dn-catalog-message is-error";
    alert.setAttribute("role", "alert");
    const heading = this.ports.root.ownerDocument.createElement("h2");
    heading.textContent = "Monsterkatalog nicht verfügbar";
    const detail = this.ports.root.ownerDocument.createElement("p");
    detail.textContent = String(error);
    const retry = this.button(
      "Erneut versuchen",
      () => void this.loadCatalog(),
    );
    alert.append(heading, detail, retry);
    this.ports.root.append(alert);
  }

  private captureScroll(): void {
    const results = this.ports.root.querySelector<HTMLElement>(
      ".dn-catalog-results",
    );
    const detail =
      this.ports.root.querySelector<HTMLElement>(".dn-catalog-detail");
    if (results || detail)
      this.state = {
        ...this.state,
        resultsScroll: results?.scrollTop ?? this.state.resultsScroll,
        detailScroll: detail?.scrollTop ?? this.state.detailScroll,
      };
  }

  private captureFocus(): FocusState | undefined {
    const active = this.ports.root.ownerDocument.activeElement;
    const window = this.ports.root.ownerDocument.defaultView;
    if (
      !window ||
      !(active instanceof window.HTMLElement) ||
      !this.ports.root.contains(active)
    )
      return undefined;
    const key = active.dataset.focusKey;
    if (!key) return undefined;
    return active instanceof window.HTMLInputElement
      ? { key, start: active.selectionStart, end: active.selectionEnd }
      : { key };
  }

  private restoreFocus(state: FocusState | undefined): void {
    if (!state) return;
    const element = [
      ...this.ports.root.querySelectorAll<HTMLElement>("[data-focus-key]"),
    ].find((candidate) => candidate.dataset.focusKey === state.key);
    if (!element) return;
    element.focus({ preventScroll: true });
    const window = this.ports.root.ownerDocument.defaultView;
    if (
      window &&
      element instanceof window.HTMLInputElement &&
      state.start !== undefined
    )
      element.setSelectionRange(
        state.start ?? 0,
        state.end ?? state.start ?? 0,
      );
  }

  private render(): void {
    if (!this.catalog || !this.page) return;
    const focus = this.captureFocus();
    this.resetRenderEvents();
    const doc = this.ports.root.ownerDocument;
    this.ports.root.replaceChildren();

    const header = doc.createElement("header");
    header.className = "dn-catalog-header";
    const title = doc.createElement("h1");
    title.textContent = "Monsterkatalog";
    const source = doc.createElement("span");
    source.className = "dn-catalog-source";
    source.textContent = "Quelle: SRD 5.1";
    const license = this.button("Quelle & Lizenz", () => {
      const notice =
        this.ports.root.querySelector<HTMLElement>(".dn-catalog-notice");
      if (!notice) return;
      notice.hidden = !notice.hidden;
      license.setAttribute("aria-expanded", String(!notice.hidden));
    });
    license.dataset.focusKey = "license";
    license.setAttribute("aria-expanded", "false");
    const headerActions = doc.createElement("div");
    headerActions.className = "dn-catalog-header-actions";
    headerActions.append(source, license);
    header.append(title, headerActions);

    const notice = doc.createElement("aside");
    notice.className = "dn-catalog-notice";
    notice.hidden = true;
    notice.textContent = this.ports.notice + " ";
    const licenseLink = doc.createElement("a");
    licenseLink.href = "https://creativecommons.org/licenses/by/4.0/";
    licenseLink.textContent = "CC BY 4.0";
    notice.append(licenseLink);

    const filters = doc.createElement("section");
    filters.className = "dn-catalog-filters";
    filters.setAttribute("aria-label", "Monster filtern");
    filters.append(
      this.textInput("Name", "text"),
      this.numberInput("HG min", "crMin"),
      this.numberInput("HG max", "crMax"),
      this.selectInput("Typ", "type"),
      this.selectInput("Subtyp", "subtype"),
      this.selectInput("Größe", "size"),
      this.selectInput("Habitat", "habitat"),
      this.selectInput("Gesinnung", "alignment"),
      this.numberInput("RK min", "acMin"),
      this.numberInput("RK max", "acMax"),
      this.numberInput("TP min", "hpMin"),
      this.numberInput("TP max", "hpMax"),
      this.textInput("Bewegung", "movement"),
      this.textInput("Sinne", "senses"),
      this.textInput("Verwundbarkeit", "vulnerabilities"),
      this.textInput("Resistenz", "resistances"),
      this.textInput("Immunität", "immunities"),
      this.textInput("Zustandsimmunität", "conditionImmunities"),
    );

    const chips = this.renderFilterChips();
    const body = doc.createElement("div");
    body.className = "dn-catalog-body";
    const results = this.renderResults();
    const detail = this.renderDetail();
    body.append(results, detail);
    this.ports.root.append(header, notice, filters, chips, body);
    results.scrollTop = this.state.resultsScroll ?? 0;
    detail.scrollTop = this.state.detailScroll ?? 0;
    this.restoreFocus(focus);
  }

  private renderFilterChips(): HTMLElement {
    const doc = this.ports.root.ownerDocument,
      section = doc.createElement("section");
    section.className = "dn-catalog-chips";
    section.setAttribute("aria-label", "Aktive Filter");
    const filters = creatureCatalogActiveFilters(this.state);
    if (!filters.length) {
      section.hidden = true;
      return section;
    }
    for (const filter of filters) {
      const chip = this.button(`${filter.label}: ${filter.value} ×`, () =>
        this.removeFilter(filter.key),
      );
      chip.className = "dn-catalog-chip";
      chip.setAttribute(
        "aria-label",
        `Filter ${filter.label} ${filter.value} entfernen`,
      );
      chip.dataset.focusKey = `chip-${filter.key}`;
      section.append(chip);
    }
    const reset = this.button("Zurücksetzen", () => this.resetFilters());
    reset.className = "dn-catalog-reset";
    reset.dataset.focusKey = "filter-reset";
    section.append(reset);
    return section;
  }

  private values(field: SelectField): readonly string[] {
    const source =
      field === "habitat"
        ? (this.catalog?.creatures.flatMap((creature) => creature.biomes) ?? [])
        : (this.catalog?.creatures
            .map((creature) => creature[field])
            .filter(Boolean) ?? []);
    return [...new Set(source)].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
  }

  private renderResults(): HTMLElement {
    const doc = this.ports.root.ownerDocument;
    const panel = doc.createElement("section");
    panel.className = "dn-catalog-results";
    panel.setAttribute("aria-label", "Monsterergebnisse");
    const table = doc.createElement("table");
    table.setAttribute("role", "grid");
    table.setAttribute("aria-label", "Gefundene Monster");
    const head = doc.createElement("thead"),
      headRow = doc.createElement("tr");
    const columns: readonly [string, CreatureCatalogSort | undefined][] = [
      ["Name", "name"],
      ["Typ", undefined],
      ["Größe", undefined],
      ["HG", "cr"],
      ["RK", "ac"],
      ["TP", "hp"],
      ["XP", "xp"],
      ["Quelle", undefined],
    ];
    for (const [label, sort] of columns) {
      const cell = doc.createElement("th");
      cell.scope = "col";
      if (sort) {
        const button = this.button(label, () => this.sort(sort));
        button.dataset.focusKey = `sort-${sort}`;
        const direction =
          this.state.sort === sort ? (this.state.direction ?? "asc") : "none";
        cell.setAttribute(
          "aria-sort",
          direction === "asc"
            ? "ascending"
            : direction === "desc"
              ? "descending"
              : "none",
        );
        cell.append(button);
      } else cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = doc.createElement("tbody");
    for (const creature of this.page?.rows ?? [])
      body.append(this.renderRow(creature));
    table.append(head, body);
    panel.append(table);

    const footer = doc.createElement("footer");
    footer.className = "dn-catalog-footer";
    const status = doc.createElement("span");
    status.setAttribute("role", "status");
    const first =
      (this.state.page ?? 0) * CREATURE_CATALOG_PAGE_SIZE +
      ((this.page?.rows.length ?? 0) ? 1 : 0);
    const last = first + (this.page?.rows.length ?? 0) - (first ? 1 : 0);
    status.textContent = this.page?.total
      ? `${first}–${last} von ${this.page.total}`
      : "Keine Monster gefunden";
    const previous = this.button("Zurück", () =>
      this.change({
        page: Math.max(0, (this.state.page ?? 0) - 1),
        resultsScroll: 0,
      }),
    );
    previous.dataset.focusKey = "page-previous";
    previous.disabled = (this.state.page ?? 0) === 0;
    const next = this.button("Weiter", () =>
      this.change({
        page: (this.state.page ?? 0) + 1,
        resultsScroll: 0,
      }),
    );
    next.dataset.focusKey = "page-next";
    next.disabled =
      ((this.state.page ?? 0) + 1) * CREATURE_CATALOG_PAGE_SIZE >=
      (this.page?.total ?? 0);
    footer.append(status, previous, next);
    panel.append(footer);
    return panel;
  }

  private renderRow(creature: Creature): HTMLTableRowElement {
    const doc = this.ports.root.ownerDocument;
    const row = doc.createElement("tr");
    row.tabIndex = 0;
    row.dataset.focusKey = `row-${creature.id}`;
    row.setAttribute(
      "aria-selected",
      String(this.state.selectedId === creature.id),
    );
    const values = [
      creature.name,
      creature.type,
      creature.size,
      creature.challengeRating,
      String(creature.ac),
      String(creature.hp),
      String(creature.xp),
      "SRD 5.1",
    ];
    for (const value of values) {
      const cell = doc.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const choose = () =>
      this.change({ selectedId: creature.id, detailScroll: 0 });
    row.addEventListener("click", choose, { signal: this.renderAbort.signal });
    row.addEventListener("dblclick", choose, {
      signal: this.renderAbort.signal,
    });
    row.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          choose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          this.moveSelection(creature.id, event.key === "ArrowDown" ? 1 : -1);
        }
      },
      { signal: this.renderAbort.signal },
    );
    return row;
  }

  private renderDetail(): HTMLElement {
    const doc = this.ports.root.ownerDocument;
    const panel = doc.createElement("article");
    panel.className = "dn-catalog-detail";
    panel.setAttribute("aria-label", "Monster-Statblock");
    const creature = this.state.selectedId
      ? this.catalog?.detail(this.state.selectedId)
      : undefined;
    if (!creature) {
      const empty = doc.createElement("p");
      empty.className = "dn-catalog-detail-empty";
      empty.textContent = "Monster auswählen, um den Statblock anzuzeigen.";
      panel.append(empty);
      return panel;
    }
    const heading = doc.createElement("h2");
    heading.textContent = creature.name;
    const meta = doc.createElement("p");
    meta.className = "dn-catalog-stat-meta";
    meta.textContent = `${creature.size} ${creature.type}${creature.subtype ? ` (${creature.subtype})` : ""}, ${creature.alignment} · HG ${creature.challengeRating} (${creature.xp} XP) · SRD 5.1`;
    panel.append(heading, meta);
    this.detailLine(panel, "Rüstungsklasse", String(creature.ac));
    this.detailLine(
      panel,
      "Trefferpunkte",
      `${creature.hp} (${creature.hitDice})`,
    );
    this.detailLine(panel, "Bewegung", creature.speed);

    const abilities = doc.createElement("dl");
    abilities.className = "dn-catalog-abilities";
    for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      const term = doc.createElement("dt"),
        value = doc.createElement("dd");
      term.textContent = key.toUpperCase();
      value.textContent = `${creature.abilities[key]} (${modifier(creature.abilities[key])})`;
      abilities.append(term, value);
    }
    panel.append(abilities);
    for (const [label, value] of [
      ["Rettungswürfe", creature.savingThrows],
      ["Fertigkeiten", creature.skills],
      ["Sinne", creature.senses],
      ["Sprachen", creature.languages],
      ["Schadensverwundbarkeiten", creature.damageVulnerabilities],
      ["Schadensresistenzen", creature.damageResistances],
      ["Schadensimmunitäten", creature.damageImmunities],
      ["Zustandsimmunitäten", creature.conditionImmunities],
      ["Habitate", creature.biomes.join(", ")],
    ] as const)
      this.detailLine(panel, label, value);
    this.actionSection(panel, "Eigenschaften", creature.traits);
    this.actionSection(panel, "Aktionen", creature.actions);
    this.actionSection(panel, "Legendäre Aktionen", creature.legendaryActions);
    if (creature.details.trim()) {
      const details = doc.createElement("section"),
        title = doc.createElement("h3"),
        text = doc.createElement("p");
      title.textContent = "Beschreibung";
      text.textContent = creature.details;
      details.append(title, text);
      panel.append(details);
    }
    return panel;
  }

  private detailLine(parent: HTMLElement, label: string, value: string): void {
    if (!value.trim()) return;
    const paragraph = this.ports.root.ownerDocument.createElement("p");
    const strong = this.ports.root.ownerDocument.createElement("strong");
    strong.textContent = `${label}: `;
    paragraph.append(strong, value);
    parent.append(paragraph);
  }

  private actionSection(
    parent: HTMLElement,
    titleText: string,
    actions: Creature["actions"],
  ): void {
    if (!actions.length) return;
    const section = this.ports.root.ownerDocument.createElement("section");
    const title = this.ports.root.ownerDocument.createElement("h3");
    title.textContent = titleText;
    section.append(title);
    for (const action of actions) {
      const paragraph = this.ports.root.ownerDocument.createElement("p");
      const strong = this.ports.root.ownerDocument.createElement("strong");
      strong.textContent = `${action.name}. `;
      paragraph.append(strong, action.description);
      section.append(paragraph);
    }
    parent.append(section);
  }

  private moveSelection(id: string, delta: number): void {
    const target = adjacentCreatureId(
      this.page?.rows ?? [],
      id,
      delta > 0 ? 1 : -1,
    );
    if (!target) return;
    this.change({ selectedId: target, detailScroll: 0 });
    this.ports.root
      .querySelector<HTMLElement>(`[data-focus-key="row-${target}"]`)
      ?.focus({ preventScroll: true });
  }

  private sort(sort: CreatureCatalogSort): void {
    this.change(creatureCatalogSortChange(this.state, sort));
  }

  private change(change: Partial<CreatureCatalogViewState>): void {
    this.captureScroll();
    this.state = { ...this.state, ...change };
    void this.refresh();
  }

  private pendingValue(key: CreatureCatalogTextFilter): string {
    return this.state.pendingText?.[key] ?? this.state[key] ?? "";
  }

  private setPendingText(key: CreatureCatalogTextFilter, value: string): void {
    this.state = {
      ...this.state,
      pendingText: { ...this.state.pendingText, [key]: value },
    };
    this.cancelDebounce();
    this.debounceHandle = this.ports.scheduler.schedule(
      () => this.flushPendingText(),
      200,
    );
  }

  private flushPendingText(): void {
    if (!this.state.pendingText) return;
    this.cancelDebounce();
    this.captureScroll();
    this.state = applyCreatureCatalogPendingText(this.state);
    void this.refresh();
  }

  private cancelDebounce(): void {
    if (this.debounceHandle === undefined) return;
    this.ports.scheduler.cancel(this.debounceHandle);
    this.debounceHandle = undefined;
  }

  private removeFilter(
    key: ReturnType<typeof creatureCatalogActiveFilters>[number]["key"],
  ): void {
    this.captureScroll();
    const pending = { ...this.state.pendingText } as Record<
      string,
      string | undefined
    >;
    pending[key] = undefined;
    const next: Record<string, unknown> = {
      ...this.state,
      pendingText: Object.values(pending).some((value) => value !== undefined)
        ? pending
        : undefined,
      page: 0,
      resultsScroll: 0,
      [key]: undefined,
    };
    this.state = next as CreatureCatalogViewState;
    void this.refresh();
  }

  private resetFilters(): void {
    this.cancelDebounce();
    this.captureScroll();
    this.state = clearCreatureCatalogFilters(this.state);
    void this.refresh();
  }

  private textInput(
    labelText: string,
    key: CreatureCatalogTextFilter,
  ): HTMLLabelElement {
    const label = this.ports.root.ownerDocument.createElement("label");
    label.textContent = labelText;
    const input = this.ports.root.ownerDocument.createElement("input");
    input.type = "search";
    input.value = this.pendingValue(key);
    input.dataset.focusKey = key;
    input.addEventListener(
      "input",
      () => this.setPendingText(key, input.value),
      { signal: this.renderAbort.signal },
    );
    input.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.setPendingText(key, input.value);
        this.flushPendingText();
      },
      { signal: this.renderAbort.signal },
    );
    label.append(input);
    return label;
  }

  private numberInput(labelText: string, key: NumberField): HTMLLabelElement {
    const label = this.ports.root.ownerDocument.createElement("label");
    label.textContent = labelText;
    const input = this.ports.root.ownerDocument.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "any";
    input.value = this.state[key] === undefined ? "" : String(this.state[key]);
    input.dataset.focusKey = key;
    input.addEventListener(
      "change",
      () => {
        const parsed = input.value === "" ? undefined : Number(input.value);
        if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) {
          input.setCustomValidity("Bitte eine nichtnegative Zahl eingeben.");
          input.reportValidity();
          return;
        }
        input.setCustomValidity("");
        this.change({ [key]: parsed, page: 0, resultsScroll: 0 });
      },
      { signal: this.renderAbort.signal },
    );
    label.append(input);
    return label;
  }

  private selectInput(labelText: string, key: SelectField): HTMLLabelElement {
    const label = this.ports.root.ownerDocument.createElement("label");
    label.textContent = labelText;
    const select = this.ports.root.ownerDocument.createElement("select");
    select.dataset.focusKey = key;
    const all = this.ports.root.ownerDocument.createElement("option");
    all.value = "";
    all.textContent = "Alle";
    select.append(all);
    for (const entry of this.values(key)) {
      const option = this.ports.root.ownerDocument.createElement("option");
      option.value = entry;
      option.textContent = entry;
      select.append(option);
    }
    select.value = this.state[key] ?? "";
    select.addEventListener(
      "change",
      () =>
        this.change({
          [key]: select.value || undefined,
          page: 0,
          resultsScroll: 0,
        }),
      { signal: this.renderAbort.signal },
    );
    label.append(select);
    return label;
  }

  private button(text: string, click: () => void): HTMLButtonElement {
    const button = this.ports.root.ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", click, {
      signal: this.renderAbort.signal,
    });
    return button;
  }

  private resetRenderEvents(): void {
    this.renderAbort.abort();
    this.renderAbort = new AbortController();
  }
}
