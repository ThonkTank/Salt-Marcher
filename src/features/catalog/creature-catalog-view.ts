import { ItemView, type WorkspaceLeaf } from "obsidian";
import type DungeonPlugin from "../../main";
import {
  type Creature,
  type CreatureCatalog,
  type CreatureCatalogPage,
  type CreatureCatalogQuery,
  type CreatureCatalogSort,
  creatureMatchesQuery,
} from "./creature-catalog";
import {
  CREATURE_CATALOG_PAGE_SIZE,
  adjacentCreatureId,
  creatureCatalogQueryForState,
  creatureCatalogSortChange,
  normalizeCreatureCatalogViewState,
  type CreatureCatalogViewState,
} from "./creature-catalog-view-state";
import { CREATURE_CATALOG_VIEW } from "../../ui/view-types";

interface FocusState {
  readonly key: string;
  readonly start?: number | null;
  readonly end?: number | null;
}

function modifier(score: number): string {
  const value = Math.floor((score - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export class CreatureCatalogView extends ItemView {
  private catalog?: CreatureCatalog;
  private page?: CreatureCatalogPage;
  private state: CreatureCatalogViewState = { sort: "name", direction: "asc", page: 0 };
  private generation = 0;
  private abort = new AbortController();
  private renderAbort = new AbortController();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: DungeonPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CREATURE_CATALOG_VIEW;
  }

  getDisplayText(): string {
    return "Monsterkatalog";
  }

  getIcon(): string {
    return "book-open";
  }

  getState(): Record<string, unknown> {
    this.captureScroll();
    return { ...this.state };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    this.state = { sort: "name", direction: "asc", page: 0, ...normalizeCreatureCatalogViewState(state) };
    if (this.contentEl.isConnected) await this.loadCatalog();
  }

  async onOpen(): Promise<void> {
    this.contentEl.classList.add("dn-creature-catalog");
    await this.loadCatalog();
  }

  async onClose(): Promise<void> {
    this.captureScroll();
    this.abort.abort();
    this.renderAbort.abort();
    this.generation++;
    this.contentEl.replaceChildren();
  }

  private async loadCatalog(): Promise<void> {
    const generation = ++this.generation;
    this.abort.abort();
    this.abort = new AbortController();
    this.renderMessage("Monsterkatalog wird geladen …", "status");
    try {
      const catalog = await this.plugin.creatureCatalog.load();
      if (generation !== this.generation || this.abort.signal.aborted) return;
      this.catalog = catalog;
      this.refresh();
    } catch (error) {
      if (generation !== this.generation || this.abort.signal.aborted) return;
      this.renderError(error);
    }
  }

  private query(): CreatureCatalogQuery {
    return creatureCatalogQueryForState(this.state);
  }

  private refresh(): void {
    if (!this.catalog) return;
    const query = this.query();
    try {
      let page = this.catalog.search(query);
      const lastPage = Math.max(0, Math.ceil(page.total / CREATURE_CATALOG_PAGE_SIZE) - 1);
      if ((this.state.page ?? 0) > lastPage) {
        this.state = { ...this.state, page: lastPage };
        page = this.catalog.search(this.query());
      }
      if (this.state.selectedId) {
        const selected = this.catalog.detail(this.state.selectedId);
        if (!selected || !creatureMatchesQuery(selected, this.query()))
          this.state = { ...this.state, selectedId: undefined, detailScroll: 0 };
      }
      this.page = page;
      this.render();
    } catch (error) {
      this.renderError(error);
    }
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

  private renderError(error: unknown): void {
    this.resetRenderEvents();
    this.contentEl.replaceChildren();
    const alert = this.contentEl.ownerDocument.createElement("section");
    alert.className = "dn-catalog-message is-error";
    alert.setAttribute("role", "alert");
    const heading = this.contentEl.ownerDocument.createElement("h2");
    heading.textContent = "Monsterkatalog nicht verfügbar";
    const detail = this.contentEl.ownerDocument.createElement("p");
    detail.textContent = String(error);
    const retry = this.button("Erneut versuchen", () => void this.loadCatalog());
    alert.append(heading, detail, retry);
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
    if (!this.catalog || !this.page) return;
    const focus = this.captureFocus();
    this.captureScroll();
    this.resetRenderEvents();
    const doc = this.contentEl.ownerDocument;
    this.contentEl.replaceChildren();

    const header = doc.createElement("header");
    header.className = "dn-catalog-header";
    const title = doc.createElement("h1");
    title.textContent = "Monsterkatalog";
    const license = this.button("Quelle & Lizenz", () => {
      const notice = this.contentEl.querySelector<HTMLElement>(".dn-catalog-notice");
      if (!notice) return;
      notice.hidden = !notice.hidden;
      license.setAttribute("aria-expanded", String(!notice.hidden));
    });
    license.dataset.focusKey = "license";
    license.setAttribute("aria-expanded", "false");
    header.append(title, license);

    const notice = doc.createElement("aside");
    notice.className = "dn-catalog-notice";
    notice.hidden = true;
    notice.textContent = this.plugin.creatureCatalog.notice + " ";
    const licenseLink = doc.createElement("a");
    licenseLink.href = "https://creativecommons.org/licenses/by/4.0/";
    licenseLink.textContent = "CC BY 4.0";
    notice.append(licenseLink);

    const filters = doc.createElement("section");
    filters.className = "dn-catalog-filters";
    filters.setAttribute("aria-label", "Monster filtern");
    filters.append(
      this.textInput("Name", "search", this.state.text ?? "", (value) =>
        this.change({ text: value || undefined, page: 0, resultsScroll: 0 })),
      this.numberInput("HG min", "cr-min", this.state.crMin, (value) =>
        this.change({ crMin: value, page: 0, resultsScroll: 0 })),
      this.numberInput("HG max", "cr-max", this.state.crMax, (value) =>
        this.change({ crMax: value, page: 0, resultsScroll: 0 })),
      this.selectInput("Typ", "type", this.state.type, this.values("type"), (value) =>
        this.change({ type: value || undefined, page: 0, resultsScroll: 0 })),
      this.selectInput("Größe", "size", this.state.size, this.values("size"), (value) =>
        this.change({ size: value || undefined, page: 0, resultsScroll: 0 })),
    );

    const body = doc.createElement("div");
    body.className = "dn-catalog-body";
    const results = this.renderResults();
    const detail = this.renderDetail();
    body.append(results, detail);
    this.contentEl.append(header, notice, filters, body);
    results.scrollTop = this.state.resultsScroll ?? 0;
    detail.scrollTop = this.state.detailScroll ?? 0;
    this.restoreFocus(focus);
  }

  private values(field: "type" | "size"): readonly string[] {
    return [...new Set(this.catalog?.creatures.map((creature) => creature[field]).filter(Boolean) ?? [])]
      .sort((left, right) => left.localeCompare(right, "en"));
  }

  private renderResults(): HTMLElement {
    const doc = this.contentEl.ownerDocument;
    const panel = doc.createElement("section");
    panel.className = "dn-catalog-results";
    panel.setAttribute("aria-label", "Monsterergebnisse");
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

    const footer = doc.createElement("footer");
    footer.className = "dn-catalog-footer";
    const status = doc.createElement("span");
    status.setAttribute("role", "status");
    const first = (this.state.page ?? 0) * CREATURE_CATALOG_PAGE_SIZE + ((this.page?.rows.length ?? 0) ? 1 : 0);
    const last = first + (this.page?.rows.length ?? 0) - (first ? 1 : 0);
    status.textContent = this.page?.total
      ? `${first}–${last} von ${this.page.total}` : "Keine Monster gefunden";
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
    return panel;
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

  private renderDetail(): HTMLElement {
    const doc = this.contentEl.ownerDocument;
    const panel = doc.createElement("article");
    panel.className = "dn-catalog-detail";
    panel.setAttribute("aria-label", "Monster-Statblock");
    const creature = this.state.selectedId ? this.catalog?.detail(this.state.selectedId) : undefined;
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
    return panel;
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
    this.contentEl.querySelector<HTMLElement>(`[data-focus-key="row-${target}"]`)
      ?.focus({ preventScroll: true });
  }

  private sort(sort: CreatureCatalogSort): void {
    this.change(creatureCatalogSortChange(this.state, sort));
  }

  private change(change: Partial<CreatureCatalogViewState>): void {
    this.state = { ...this.state, ...change };
    this.refresh();
  }

  private textInput(labelText: string, key: string, value: string,
    change: (value: string) => void): HTMLLabelElement {
    const label = this.contentEl.ownerDocument.createElement("label");
    label.textContent = labelText;
    const input = this.contentEl.ownerDocument.createElement("input");
    input.type = "search";
    input.value = value;
    input.dataset.focusKey = key;
    input.addEventListener("input", () => change(input.value), { signal: this.renderAbort.signal });
    label.append(input);
    return label;
  }

  private numberInput(labelText: string, key: string, value: number | undefined,
    change: (value: number | undefined) => void): HTMLLabelElement {
    const label = this.contentEl.ownerDocument.createElement("label");
    label.textContent = labelText;
    const input = this.contentEl.ownerDocument.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "any";
    input.value = value === undefined ? "" : String(value);
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
    label.append(input);
    return label;
  }

  private selectInput(labelText: string, key: string, value: string | undefined,
    values: readonly string[], change: (value: string) => void): HTMLLabelElement {
    const label = this.contentEl.ownerDocument.createElement("label");
    label.textContent = labelText;
    const select = this.contentEl.ownerDocument.createElement("select");
    select.dataset.focusKey = key;
    const all = this.contentEl.ownerDocument.createElement("option");
    all.value = "";
    all.textContent = "Alle";
    select.append(all);
    for (const entry of values) {
      const option = this.contentEl.ownerDocument.createElement("option");
      option.value = entry;
      option.textContent = entry;
      select.append(option);
    }
    select.value = value ?? "";
    select.addEventListener("change", () => change(select.value), { signal: this.renderAbort.signal });
    label.append(select);
    return label;
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
