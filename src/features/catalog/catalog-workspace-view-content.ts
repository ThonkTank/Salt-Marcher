import type { CreatureCatalog } from "./creature-catalog";
import { CreatureCatalogViewContent } from "./creature-catalog-view-content";
import { createCatalogSectionFrame } from "./catalog-section-frame";
import { createCatalogProviderRegistry, type CatalogProviderRegistry } from "./catalog-provider";
import {
  CATALOG_SECTIONS,
  restoreCatalogWorkspaceState,
  type CatalogSectionKey,
  type CatalogWorkspaceState,
} from "./catalog-workspace-state";

export interface CatalogWorkspaceViewPort {
  readonly notice: string;
  loadCreatures(): Promise<CreatureCatalog>;
}

export class CatalogWorkspaceViewContent {
  private state: CatalogWorkspaceState = restoreCatalogWorkspaceState({});
  private readonly providers: CatalogProviderRegistry;
  private creature?: CreatureCatalogViewContent;
  private events = new AbortController();
  private generation = 0;
  private opened = false;

  constructor(
    private readonly contentEl: HTMLElement,
    private readonly port: CatalogWorkspaceViewPort,
  ) {
    this.providers = createCatalogProviderRegistry(port.loadCreatures);
  }

  getState(): Record<string, unknown> {
    this.captureCreatureState();
    return restoreCatalogWorkspaceState(this.state) as unknown as Record<string, unknown>;
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    await this.creature?.onClose();
    this.creature = undefined;
    this.state = restoreCatalogWorkspaceState(state);
    if (this.opened) await this.render();
  }

  async onOpen(): Promise<void> {
    this.opened = true;
    this.contentEl.classList.add("dn-catalog-workspace");
    await this.render();
  }

  async onClose(): Promise<void> {
    this.opened = false;
    this.generation++;
    this.captureCreatureState();
    await this.creature?.onClose();
    this.creature = undefined;
    this.events.abort();
    this.contentEl.replaceChildren();
    this.contentEl.classList.remove("dn-catalog-workspace");
  }

  private captureCreatureState(): void {
    if (!this.creature) return;
    this.state = { ...this.state, sections: {
      ...this.state.sections,
      creatures: this.creature.getState(),
    } } as CatalogWorkspaceState;
  }

  private async activate(section: CatalogSectionKey): Promise<void> {
    if (section === this.state.activeSection) return;
    this.captureCreatureState();
    this.state = { ...this.state, activeSection: section };
    await this.render();
    if (this.opened && this.state.activeSection === section)
      this.contentEl.querySelector<HTMLElement>(`[data-catalog-section="${section}"]`)?.focus();
  }

  private tabList(doc: Document): HTMLElement {
    const tabs = doc.createElement("nav");
    tabs.className = "dn-catalog-section-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Katalogbereiche");
    for (const section of CATALOG_SECTIONS) {
      const button = doc.createElement("button");
      button.type = "button";
      button.id = `dn-catalog-tab-${section.key}`;
      button.dataset.catalogSection = section.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "dn-catalog-section-panel");
      button.setAttribute("aria-selected", String(section.key === this.state.activeSection));
      button.classList.toggle("is-active", section.key === this.state.activeSection);
      button.tabIndex = section.key === this.state.activeSection ? 0 : -1;
      button.textContent = section.label;
      button.addEventListener("click", () => void this.activate(section.key),
        { signal: this.events.signal });
      button.addEventListener("keydown", (event) => this.onTabKey(event, section.key),
        { signal: this.events.signal });
      tabs.append(button);
    }
    return tabs;
  }

  private onTabKey(event: KeyboardEvent, section: CatalogSectionKey): void {
    const index = CATALOG_SECTIONS.findIndex(({ key }) => key === section);
    let target: number | undefined;
    if (event.key === "ArrowRight") target = (index + 1) % CATALOG_SECTIONS.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + CATALOG_SECTIONS.length) % CATALOG_SECTIONS.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = CATALOG_SECTIONS.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void this.activate(section);
      return;
    } else return;
    event.preventDefault();
    const buttons = [...this.contentEl.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    for (const button of buttons) button.tabIndex = -1;
    const next = buttons[target];
    if (next) {
      next.tabIndex = 0;
      next.focus();
    }
  }

  private renderUnavailable(panel: HTMLElement, section: CatalogSectionKey): void {
    const doc = panel.ownerDocument;
    const definition = CATALOG_SECTIONS.find(({ key }) => key === section)!;
    const capability = this.providers[section].capability;
    const frame = createCatalogSectionFrame(doc, definition.label,
      `${definition.label} Ergebnisse`, `${definition.label} Details`);
    frame.root.classList.add("dn-catalog-unavailable");
    const message = doc.createElement("p");
    message.className = "dn-catalog-message";
    message.setAttribute("role", "status");
    message.textContent = capability.status === "unavailable" ? capability.reason : "Keine Einträge";
    frame.results.prepend(message);
    const footerStatus = doc.createElement("span");
    footerStatus.setAttribute("role", "status");
    footerStatus.textContent = "Keine Datenquelle verbunden";
    frame.footer.append(footerStatus);
    frame.detail.textContent = "Kein Eintrag ausgewählt.";
    panel.append(frame.root);
  }

  private async render(): Promise<void> {
    const generation = ++this.generation;
    this.captureCreatureState();
    await this.creature?.onClose();
    this.creature = undefined;
    if (!this.opened || generation !== this.generation) return;
    this.events.abort();
    this.events = new AbortController();
    const doc = this.contentEl.ownerDocument;
    this.contentEl.replaceChildren();
    const tabs = this.tabList(doc);
    const panel = doc.createElement("section");
    panel.id = "dn-catalog-section-panel";
    panel.className = "dn-catalog-section-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `dn-catalog-tab-${this.state.activeSection}`);
    this.contentEl.append(tabs, panel);
    if (this.state.activeSection !== "creatures") {
      this.renderUnavailable(panel, this.state.activeSection);
      return;
    }
    const host = doc.createElement("div");
    panel.append(host);
    const creature = new CreatureCatalogViewContent(host, {
      notice: this.port.notice,
      provider: this.providers.creatures,
    });
    this.creature = creature;
    await creature.setState(this.state.sections.creatures as Record<string, unknown>);
    await creature.onOpen();
    if (!this.opened || generation !== this.generation) await creature.onClose();
  }
}
