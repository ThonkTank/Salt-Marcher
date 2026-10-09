import { ItemView, type WorkspaceLeaf } from "obsidian";
import type DungeonPlugin from "../../main";
import { CREATURE_CATALOG_VIEW } from "../../ui/view-types";
import {
  CreatureCatalogController,
  type CreatureCatalogScheduler,
} from "./creature-catalog-controller";

function browserScheduler(root: HTMLElement): CreatureCatalogScheduler {
  const window = root.ownerDocument.defaultView;
  return {
    schedule: (callback, delayMs) =>
      window?.setTimeout(callback, delayMs) ??
      globalThis.setTimeout(callback, delayMs),
    cancel: (handle) => {
      if (typeof handle !== "number") return;
      if (window) window.clearTimeout(handle);
      else globalThis.clearTimeout(handle);
    },
  };
}

export class CreatureCatalogView extends ItemView {
  private readonly controller: CreatureCatalogController;
  private resizeObserver?: ResizeObserver;

  constructor(leaf: WorkspaceLeaf, plugin: DungeonPlugin) {
    super(leaf);
    this.controller = new CreatureCatalogController({
      root: this.contentEl,
      loadCatalog: () => plugin.creatureCatalog.load(),
      notice: plugin.creatureCatalog.notice,
      scheduler: browserScheduler(this.contentEl),
    });
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
    return this.controller.getState();
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    await this.controller.setState(state);
  }

  async onOpen(): Promise<void> {
    await this.controller.open();
    this.observeSize();
  }

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.controller.close();
  }

  private observeSize(): void {
    const update = () => {
      const bounds = this.contentEl.getBoundingClientRect();
      this.controller.setViewport(
        bounds.width || this.contentEl.clientWidth,
        bounds.height || this.contentEl.clientHeight,
      );
    };
    update();
    const ResizeObserverType =
      this.contentEl.ownerDocument.defaultView?.ResizeObserver ??
      globalThis.ResizeObserver;
    if (typeof ResizeObserverType !== "function") return;
    this.resizeObserver = new ResizeObserverType(update);
    this.resizeObserver.observe(this.contentEl);
  }
}
