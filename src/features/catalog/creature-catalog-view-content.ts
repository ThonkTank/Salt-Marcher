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
  applyCreatureCatalogDrafts,
  creatureCatalogFilterChips,
  creatureCatalogDraftKeyForFilter,
  creatureCatalogQueryForState,
  creatureCatalogRangeError,
  creatureCatalogSortChange,
  removeCreatureCatalogFilter,
  resetCreatureCatalogFilters,
  restoreCreatureCatalogViewState,
  type CreatureCatalogArrayFilter,
  type CreatureCatalogFilterChip,
  type CreatureCatalogTextFilter,
  type CreatureCatalogViewState,
} from "./creature-catalog-view-state";
import type { CatalogSectionProvider } from "./catalog-provider";
import { createCatalogSectionFrame } from "./catalog-section-frame";
import { CreatureCatalogDebouncer } from "./creature-catalog-view-model";

interface FocusState {
  readonly key: string;
  readonly start?: number | null;
  readonly end?: number | null;
}

function modifier(score: number): string {
  const value = Math.floor((score - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export interface CreatureCatalogViewPort {
  readonly notice: string;
  readonly provider: CatalogSectionProvider<"creatures", CreatureCatalogViewState, Creature, Creature>;
}

interface UniqueCatalogLeaf {
  setViewState(state: { type: string; active: boolean }): Promise<void>;
  detach(): void;
}

interface UniqueCatalogWorkspace<Leaf extends UniqueCatalogLeaf> {
  getLeavesOfType(viewType: string): readonly Leaf[];
  getLeaf(kind: "tab"): Leaf;
  revealLeaf(leaf: Leaf): void;
}

/** Serialize creation and collapse pre-existing duplicates to one canonical leaf. */
export function createUniqueCatalogOpener<Leaf extends UniqueCatalogLeaf>(
  workspace: UniqueCatalogWorkspace<Leaf>,
  viewType: string,
): () => Promise<void> {
  let opening: Promise<void> | undefined;
  return () => {
    if (!opening) {
      opening = (async () => {
        const [existing, ...duplicates] = workspace.getLeavesOfType(viewType);
        for (const duplicate of duplicates) duplicate.detach();
        const leaf = existing ?? workspace.getLeaf("tab");
        if (!existing) await leaf.setViewState({ type: viewType, active: true });
        workspace.revealLeaf(leaf);
      })().finally(() => { opening = undefined; });
    }
    return opening;
  };
}

export class CreatureCatalogViewContent {
  private page?: CreatureCatalogPage;
  private selected?: Creature;
  private detailStatus?: { readonly title: string; readonly message: string; readonly retryable: boolean };
  private facets: Readonly<Record<string, readonly string[]>> = Object.freeze({});
  private state: CreatureCatalogViewState = restoreCreatureCatalogViewState({});
  private generation = 0;
  private abort = new AbortController();
  private renderAbort = new AbortController();
  private lifecycleAbort = new AbortController();
  private readonly debouncers = new Map<CreatureCatalogTextFilter, CreatureCatalogDebouncer>();
  private validationError?: string;
  private opened = false;

  constructor(
    private readonly contentEl: HTMLElement,
    private readonly port: CreatureCatalogViewPort,
  ) {}

  getState(): Record<string, unknown> {
    this.captureScroll();
    return { ...applyCreatureCatalogDrafts(this.state) };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    this.state = restoreCreatureCatalogViewState(state);
    if (this.opened) await this.refresh(true);
  }

  async onOpen(): Promise<void> {
    this.opened = true;
    this.contentEl.classList.add("dn-creature-catalog");
    this.contentEl.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.state.selectedId) return;
      event.preventDefault();
      this.change({ selectedId: undefined, detailScroll: 0 });
    }, { signal: this.lifecycleAbort.signal });
    await this.refresh(true);
  }

  async onClose(): Promise<void> {
    this.opened = false;
    this.captureScroll();
    this.state = applyCreatureCatalogDrafts(this.state);
    this.abort.abort();
    this.renderAbort.abort();
    this.lifecycleAbort.abort();
    this.disposeDebouncers();
    this.generation++;
    this.contentEl.replaceChildren();
  }

  private async refresh(showLoading = false): Promise<void> {
    const generation = ++this.generation;
    this.abort.abort();
    this.abort = new AbortController();
    const request = { section: "creatures" as const, generation, signal: this.abort.signal };
    if (showLoading) this.renderMessage("Monsterkatalog wird geladen …", "status");
    const query = this.query();
    this.validationError = creatureCatalogRangeError(this.state);
    if (this.validationError) {
      this.page = { rows: [], total: 0, offset: query.offset ?? 0,
        limit: query.limit ?? CREATURE_CATALOG_PAGE_SIZE };
      this.selected = undefined;
      this.render();
      return;
    }
    try {
      const result = await this.port.provider.query(this.state, request);
      if (generation !== this.generation || this.abort.signal.aborted) return;
      if (result.status === "error") {
        this.renderError(result.message, result.retryable);
        return;
      }
      if (result.status === "invalid") {
        this.validationError = result.message;
        this.page = { rows: [], total: 0, offset: query.offset ?? 0,
          limit: query.limit ?? CREATURE_CATALOG_PAGE_SIZE };
        this.selected = undefined;
        this.render();
        return;
      }
      if (result.status === "missing") {
        this.renderError(result.reason, true, "Monsterkatalog fehlt");
        return;
      }
      if (result.status === "unavailable") {
        this.renderError(result.reason, false, "Monsterkatalog nicht verfügbar");
        return;
      }
      const lastPage = Math.max(0, Math.ceil(result.total / CREATURE_CATALOG_PAGE_SIZE) - 1);
      if ((this.state.page ?? 0) > lastPage) {
        this.state = { ...this.state, page: lastPage };
        await this.refresh();
        return;
      }
      this.page = { rows: result.rows, total: result.total, offset: result.offset, limit: result.limit };
      this.facets = result.facets ?? Object.freeze({});
      this.selected = undefined;
      this.detailStatus = undefined;
      if (this.state.selectedId) {
        const detail = await this.port.provider.detail(this.state.selectedId, request);
        if (generation !== this.generation || this.abort.signal.aborted) return;
        if (detail.status === "error") {
          this.detailStatus = { title: "Monsterdetails nicht verfügbar",
            message: detail.message, retryable: detail.retryable };
        } else if (detail.status === "missing") {
          this.detailStatus = { title: "Monster nicht gefunden",
            message: "Der ausgewählte Statblock ist in der Datenquelle nicht vorhanden.", retryable: false };
        } else if (detail.status === "unavailable") {
          this.detailStatus = { title: "Monsterdetails nicht verfügbar",
            message: detail.reason, retryable: false };
        } else if (creatureMatchesQuery(detail.detail, query))
          this.selected = detail.detail;
        else this.state = { ...this.state, selectedId: undefined, detailScroll: 0 };
      }
      this.render();
    } catch (error) {
      if (generation !== this.generation || this.abort.signal.aborted) return;
      this.renderError(error);
    }
  }

  private query(): CreatureCatalogQuery {
    return creatureCatalogQueryForState(this.state);
  }

  private renderMessage(text: string, role: "status" | "alert"): void {
    this.resetRenderEvents();
    this.contentEl.replaceChildren();
    const message = this.contentEl.ownerDocument.createElement("p");
    message.className = "dn-catalog-message";
    message.setAttribute("role", role);
    message.textContent = text;
    this.contentEl.append(message);
  }

  private renderError(error: unknown, retryable = true,
    headingText = "Monsterkatalog nicht verfügbar"): void {
    this.resetRenderEvents();
    this.contentEl.replaceChildren();
    const alert = this.contentEl.ownerDocument.createElement("section");
    alert.className = "dn-catalog-message is-error";
    alert.setAttribute("role", "alert");
    const heading = this.contentEl.ownerDocument.createElement("h2");
    heading.textContent = headingText;
    const detail = this.contentEl.ownerDocument.createElement("p");
    detail.textContent = String(error);
    alert.append(heading, detail);
    if (retryable) alert.append(this.button("Erneut versuchen", () => void this.refresh(true)));
    this.contentEl.append(alert);
  }

  private captureScroll(): void {
    const results = this.contentEl.querySelector<HTMLElement>(".dn-catalog-results");
    const detail = this.contentEl.querySelector<HTMLElement>(".dn-catalog-detail");
    if (results || detail) this.state = {
      ...this.state,
      resultsScroll: results?.scrollTop ?? this.state.resultsScroll,
      detailScroll: detail?.scrollTop ?? this.state.detailScroll,
    };
  }

  private captureFocus(): FocusState | undefined {
    const active = this.contentEl.ownerDocument.activeElement;
    const window = this.contentEl.ownerDocument.defaultView;
    if (!window || !(active instanceof window.HTMLElement) || !this.contentEl.contains(active)) return undefined;
    const key = active.dataset.focusKey;
    if (!key) return undefined;
    return active instanceof window.HTMLInputElement
      ? { key, start: active.selectionStart, end: active.selectionEnd }
      : { key };
  }

  private restoreFocus(state: FocusState | undefined): void {
    if (!state) return;
    const element = [...this.contentEl.querySelectorAll<HTMLElement>("[data-focus-key]")]
      .find((candidate) => candidate.dataset.focusKey === state.key);
    if (!element) return;
    element.focus({ preventScroll: true });
    const window = this.contentEl.ownerDocument.defaultView;
    if (window && element instanceof window.HTMLInputElement && state.start !== undefined)
      element.setSelectionRange(state.start ?? 0, state.end ?? state.start ?? 0);
  }

  private render(): void {
    if (!this.page) return;
    const focus = this.captureFocus();
    this.resetRenderEvents();
    const doc = this.contentEl.ownerDocument;
    this.contentEl.replaceChildren();

    const frame = createCatalogSectionFrame(doc, "Monsterkatalog", "Monsterergebnisse", "Monster-Statblock");
    const license = this.button("Quelle & Lizenz", () => {
      const notice = this.contentEl.querySelector<HTMLElement>(".dn-catalog-notice");
      if (!notice) return;
      notice.hidden = !notice.hidden;
      license.setAttribute("aria-expanded", String(!notice.hidden));
    });
    license.dataset.focusKey = "license";
    license.setAttribute("aria-expanded", "false");
    frame.headerActions.append(license);

    const notice = doc.createElement("aside");
    notice.className = "dn-catalog-notice";
    notice.hidden = true;
    notice.textContent = this.port.notice + " ";
    const licenseLink = doc.createElement("a");
    licenseLink.href = "https://creativecommons.org/licenses/by/4.0/";
    licenseLink.textContent = "CC BY 4.0";
    notice.append(licenseLink);

    const filters = doc.createElement("section");
    filters.className = "dn-catalog-filters";
    filters.setAttribute("aria-label", "Monster filtern");
    filters.append(
      this.textFilterInput("Monstername suchen", "search", "text", "Name suchen"),
      this.numberInput("HG min", "cr-min", this.state.crMin, (value) =>
        this.change({ crMin: value, page: 0, resultsScroll: 0 })),
      this.numberInput("HG max", "cr-max", this.state.crMax, (value) =>
        this.change({ crMax: value, page: 0, resultsScroll: 0 })),
      this.multiSelectInput("Typ", "type", "types", this.values("type")),
      this.multiSelectInput("Subtyp", "subtype", "subtypes", this.values("subtype")),
      this.multiSelectInput("Größe", "size", "sizes", this.values("size")),
      this.multiSelectInput("Habitat", "habitat", "habitats", this.values("biomes")),
      this.multiSelectInput("Gesinnung", "alignment", "alignments", this.values("alignment")),
      this.numberInput("RK min", "ac-min", this.state.acMin, (value) =>
        this.change({ acMin: value, page: 0, resultsScroll: 0 })),
      this.numberInput("RK max", "ac-max", this.state.acMax, (value) =>
        this.change({ acMax: value, page: 0, resultsScroll: 0 })),
      this.numberInput("TP min", "hp-min", this.state.hpMin, (value) =>
        this.change({ hpMin: value, page: 0, resultsScroll: 0 })),
      this.numberInput("TP max", "hp-max", this.state.hpMax, (value) =>
        this.change({ hpMax: value, page: 0, resultsScroll: 0 })),
      this.textFilterInput("Bewegung", "movement", "movement"),
      this.textFilterInput("Sinne", "senses", "senses"),
      this.textFilterInput("Verwundbarkeit", "vulnerabilities", "vulnerabilities"),
      this.textFilterInput("Resistenz", "resistances", "resistances"),
      this.textFilterInput("Immunität", "immunities", "immunities"),
      this.textFilterInput("Zustandsimmunität", "condition-immunities", "conditionImmunities"),
    );

    const chips = this.renderFilterChips();

    frame.controls.append(notice, filters, chips);
    this.renderResults(frame.results, frame.footer);
    this.renderDetail(frame.detail);
    this.contentEl.append(frame.root);
    frame.results.scrollTop = this.state.resultsScroll ?? 0;
    frame.detail.scrollTop = this.state.detailScroll ?? 0;
    this.restoreFocus(focus);
  }

  private values(field: "type" | "subtype" | "size" | "alignment" | "biomes"): readonly string[] {
    return this.facets[field] ?? [];
  }

  private renderResults(panel: HTMLElement, footer: HTMLElement): void {
    const doc = this.contentEl.ownerDocument;
    const table = doc.createElement("table");
    const head = doc.createElement("thead"), headRow = doc.createElement("tr");
    const columns: readonly [string, CreatureCatalogSort | undefined][] = [
      ["Name", "name"], ["Typ", undefined], ["Größe", undefined], ["HG", "cr"],
      ["RK", "ac"], ["TP", "hp"], ["XP", "xp"], ["Quelle", undefined],
    ];
    for (const [label, sort] of columns) {
      const cell = doc.createElement("th");
      cell.scope = "col";
      if (sort) {
        const button = this.button(label, () => this.sort(sort));
        button.dataset.focusKey = `sort-${sort}`;
        const direction = this.state.sort === sort ? this.state.direction ?? "asc" : "none";
        cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none");
        cell.append(button);
      } else cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = doc.createElement("tbody");
    for (const creature of this.page?.rows ?? []) body.append(this.renderRow(creature));
    table.append(head, body);
    panel.append(table);

    const status = doc.createElement("span");
    status.setAttribute("role", this.validationError ? "alert" : "status");
    const first = (this.state.page ?? 0) * CREATURE_CATALOG_PAGE_SIZE + ((this.page?.rows.length ?? 0) ? 1 : 0);
    const last = first + (this.page?.rows.length ?? 0) - (first ? 1 : 0);
    status.textContent = this.validationError ?? (this.page?.total
      ? `${first}–${last} von ${this.page.total}` : "Keine Monster gefunden");
    const previous = this.button("Zurück", () => this.change({
      page: Math.max(0, (this.state.page ?? 0) - 1), resultsScroll: 0,
    }));
    previous.dataset.focusKey = "page-previous";
    previous.disabled = (this.state.page ?? 0) === 0;
    const next = this.button("Weiter", () => this.change({
      page: (this.state.page ?? 0) + 1, resultsScroll: 0,
    }));
    next.dataset.focusKey = "page-next";
    next.disabled = ((this.state.page ?? 0) + 1) * CREATURE_CATALOG_PAGE_SIZE >= (this.page?.total ?? 0);
    footer.append(status, previous, next);
    panel.append(footer);
  }

  private renderRow(creature: Creature): HTMLTableRowElement {
    const doc = this.contentEl.ownerDocument;
    const row = doc.createElement("tr");
    row.tabIndex = 0;
    row.dataset.focusKey = `row-${creature.id}`;
    row.setAttribute("aria-selected", String(this.state.selectedId === creature.id));
    const values = [creature.name, creature.type, creature.size, creature.challengeRating,
      String(creature.ac), String(creature.hp), String(creature.xp), "SRD 5.1"];
    for (const value of values) {
      const cell = doc.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const choose = () => this.change({ selectedId: creature.id, detailScroll: 0 });
    row.addEventListener("click", choose, { signal: this.renderAbort.signal });
    row.addEventListener("dblclick", choose, { signal: this.renderAbort.signal });
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        choose();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.moveSelection(creature.id, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Escape" && this.state.selectedId) {
        event.preventDefault();
        this.change({ selectedId: undefined, detailScroll: 0 });
      }
    }, { signal: this.renderAbort.signal });
    return row;
  }

  private renderDetail(panel: HTMLElement): void {
    const doc = this.contentEl.ownerDocument;
    if (this.detailStatus) {
      const heading = doc.createElement("h2");
      heading.textContent = this.detailStatus.title;
      const message = doc.createElement("p");
      message.setAttribute("role", this.detailStatus.retryable ? "alert" : "status");
      message.textContent = this.detailStatus.message;
      panel.append(heading, message);
      if (this.detailStatus.retryable)
        panel.append(this.button("Details erneut laden", () => void this.refresh()));
      return;
    }
    const creature = this.selected;
    if (!creature) {
      const empty = doc.createElement("p");
      empty.className = "dn-catalog-detail-empty";
      empty.textContent = "Monster auswählen, um den Statblock anzuzeigen.";
      panel.append(empty);
      return;
    }
    const heading = doc.createElement("h2");
    heading.textContent = creature.name;
    const meta = doc.createElement("p");
    meta.className = "dn-catalog-stat-meta";
    meta.textContent = `${creature.size} ${creature.type}${creature.subtype ? ` (${creature.subtype})` : ""}, ${creature.alignment} · HG ${creature.challengeRating} (${creature.xp} XP) · SRD 5.1`;
    panel.append(heading, meta);
    this.detailLine(panel, "Rüstungsklasse", String(creature.ac));
    this.detailLine(panel, "Trefferpunkte", `${creature.hp} (${creature.hitDice})`);
    this.detailLine(panel, "Bewegung", creature.speed);

    const abilities = doc.createElement("dl");
    abilities.className = "dn-catalog-abilities";
    for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      const term = doc.createElement("dt"), value = doc.createElement("dd");
      term.textContent = key.toUpperCase();
      value.textContent = `${creature.abilities[key]} (${modifier(creature.abilities[key])})`;
      abilities.append(term, value);
    }
    panel.append(abilities);
    for (const [label, value] of [
      ["Rettungswürfe", creature.savingThrows], ["Fertigkeiten", creature.skills],
      ["Sinne", creature.senses], ["Sprachen", creature.languages],
      ["Schadensverwundbarkeiten", creature.damageVulnerabilities],
      ["Schadensresistenzen", creature.damageResistances],
      ["Schadensimmunitäten", creature.damageImmunities],
      ["Zustandsimmunitäten", creature.conditionImmunities],
      ["Habitate", creature.biomes.join(", ")],
    ] as const) this.detailLine(panel, label, value);
    this.actionSection(panel, "Eigenschaften", creature.traits);
    this.actionSection(panel, "Aktionen", creature.actions);
    this.actionSection(panel, "Legendäre Aktionen", creature.legendaryActions);
    if (creature.details.trim()) {
      const details = doc.createElement("section"), title = doc.createElement("h3"), text = doc.createElement("p");
      title.textContent = "Beschreibung";
      text.textContent = creature.details;
      details.append(title, text);
      panel.append(details);
    }
  }

  private detailLine(parent: HTMLElement, label: string, value: string): void {
    if (!value.trim()) return;
    const paragraph = this.contentEl.ownerDocument.createElement("p");
    const strong = this.contentEl.ownerDocument.createElement("strong");
    strong.textContent = `${label}: `;
    paragraph.append(strong, value);
    parent.append(paragraph);
  }

  private actionSection(parent: HTMLElement, titleText: string, actions: Creature["actions"]): void {
    if (!actions.length) return;
    const section = this.contentEl.ownerDocument.createElement("section");
    const title = this.contentEl.ownerDocument.createElement("h3");
    title.textContent = titleText;
    section.append(title);
    for (const action of actions) {
      const paragraph = this.contentEl.ownerDocument.createElement("p");
      const strong = this.contentEl.ownerDocument.createElement("strong");
      strong.textContent = `${action.name}. `;
      paragraph.append(strong, action.description);
      section.append(paragraph);
    }
    parent.append(section);
  }

  private moveSelection(id: string, delta: number): void {
    const target = adjacentCreatureId(this.page?.rows ?? [], id, delta > 0 ? 1 : -1);
    if (!target) return;
    this.change({ selectedId: target, detailScroll: 0 });
    this.focusControl(`row-${target}`);
  }

  private sort(sort: CreatureCatalogSort): void {
    this.change(creatureCatalogSortChange(this.state, sort));
  }

  private change(change: Partial<CreatureCatalogViewState>): void {
    this.captureScroll();
    this.state = { ...this.state, ...change };
    void this.refresh();
  }

  private renderFilterChips(): HTMLElement {
    const region = this.contentEl.ownerDocument.createElement("section");
    region.className = "dn-catalog-chips";
    region.setAttribute("aria-label", "Aktive Filter");
    const chips = creatureCatalogFilterChips(this.state);
    region.hidden = chips.length === 0;
    for (const [index, chip] of chips.entries()) {
      const button = this.button(`${chip.label} ×`, () => {
        this.debouncers.get(chip.key as CreatureCatalogTextFilter)?.dispose();
        const fallback = chips[index + 1] ?? chips[index - 1];
        this.state = removeCreatureCatalogFilter(this.state, chip.key, chip.value);
        void this.refresh();
        this.focusControl(fallback ? this.chipFocusKey(fallback) : "search");
      });
      button.className = "dn-catalog-chip";
      button.setAttribute("aria-label", `Filter ${chip.label} entfernen`);
      button.dataset.focusKey = this.chipFocusKey(chip);
      region.append(button);
    }
    const reset = this.button("Filter zurücksetzen", () => {
      this.disposeDebouncers();
      this.state = resetCreatureCatalogFilters(this.state);
      void this.refresh();
      this.focusControl("search");
    });
    reset.className = "dn-catalog-reset";
    reset.dataset.focusKey = "filter-reset";
    region.append(reset);
    return region;
  }

  private chipFocusKey(chip: CreatureCatalogFilterChip): string {
    return `chip-${chip.key}-${chip.value ?? "value"}`;
  }

  private focusControl(key: string): void {
    [...this.contentEl.querySelectorAll<HTMLElement>("[data-focus-key]")]
      .find((element) => element.dataset.focusKey === key)?.focus({ preventScroll: true });
  }

  private debouncer(key: CreatureCatalogTextFilter): CreatureCatalogDebouncer {
    let debouncer = this.debouncers.get(key);
    if (!debouncer) {
      debouncer = new CreatureCatalogDebouncer();
      this.debouncers.set(key, debouncer);
    }
    return debouncer;
  }

  private disposeDebouncers(): void {
    for (const debouncer of this.debouncers.values()) debouncer.dispose();
  }

  private textFilterInput(labelText: string, key: string, stateKey: CreatureCatalogTextFilter,
    placeholder = labelText): HTMLInputElement {
    const draftKey = creatureCatalogDraftKeyForFilter(stateKey);
    const input = this.contentEl.ownerDocument.createElement("input");
    input.type = "search";
    input.value = this.state[draftKey] ?? this.state[stateKey] ?? "";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", labelText);
    input.dataset.focusKey = key;
    input.addEventListener("input", () => {
      this.state = { ...this.state, [draftKey]: input.value };
      this.debouncer(stateKey).schedule(() => this.publishTextFilter(stateKey));
    }, { signal: this.renderAbort.signal });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.debouncer(stateKey).flush(() => this.publishTextFilter(stateKey));
    }, { signal: this.renderAbort.signal });
    return input;
  }

  private publishTextFilter(stateKey: CreatureCatalogTextFilter): void {
    const draftKey = creatureCatalogDraftKeyForFilter(stateKey);
    this.change({ [stateKey]: this.state[draftKey]?.trim() || undefined, page: 0, resultsScroll: 0 });
  }

  private numberInput(labelText: string, key: string, value: number | undefined,
    change: (value: number | undefined) => void): HTMLInputElement {
    const input = this.contentEl.ownerDocument.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "any";
    input.value = value === undefined ? "" : String(value);
    input.placeholder = labelText;
    input.setAttribute("aria-label", labelText);
    input.dataset.focusKey = key;
    input.addEventListener("change", () => {
      const parsed = input.value === "" ? undefined : Number(input.value);
      if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) {
        input.setCustomValidity("Bitte eine nichtnegative Zahl eingeben.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      change(parsed);
    }, { signal: this.renderAbort.signal });
    return input;
  }

  private multiSelectInput(labelText: string, key: string, stateKey: CreatureCatalogArrayFilter,
    values: readonly string[]): HTMLSelectElement {
    const select = this.contentEl.ownerDocument.createElement("select");
    select.setAttribute("aria-label", `${labelText} hinzufügen`);
    select.dataset.focusKey = key;
    const all = this.contentEl.ownerDocument.createElement("option");
    all.value = "";
    all.textContent = `${labelText}: alle`;
    select.append(all);
    const selected = this.state[stateKey] ?? [];
    for (const entry of values) {
      if (selected.includes(entry)) continue;
      const option = this.contentEl.ownerDocument.createElement("option");
      option.value = entry;
      option.textContent = entry;
      select.append(option);
    }
    select.addEventListener("change", () => {
      if (!select.value) return;
      this.change({ [stateKey]: [...selected, select.value], page: 0, resultsScroll: 0 });
    }, { signal: this.renderAbort.signal });
    return select;
  }

  private button(text: string, click: () => void): HTMLButtonElement {
    const button = this.contentEl.ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", click, { signal: this.renderAbort.signal });
    return button;
  }

  private resetRenderEvents(): void {
    this.renderAbort.abort();
    this.renderAbort = new AbortController();
  }
}
