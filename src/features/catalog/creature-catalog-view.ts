import { ItemView, type WorkspaceLeaf } from "obsidian";
import type DungeonPlugin from "../../main";
import { CREATURE_CATALOG_VIEW } from "../../ui/view-types";
import { CreatureCatalogViewContent } from "./creature-catalog-view-content";

export class CreatureCatalogView extends ItemView {
  private readonly content: CreatureCatalogViewContent;

  constructor(leaf: WorkspaceLeaf, plugin: DungeonPlugin) {
    super(leaf);
    this.content = new CreatureCatalogViewContent(this.contentEl, {
      notice: plugin.creatureCatalog.notice,
      load: () => plugin.creatureCatalog.load(),
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
    return this.content.getState();
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    await this.content.setState(state);
  }

  async onOpen(): Promise<void> {
    await this.content.onOpen();
  }

  async onClose(): Promise<void> {
    await this.content.onClose();
  }
}
