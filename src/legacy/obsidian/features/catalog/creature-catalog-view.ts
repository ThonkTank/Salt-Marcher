import { ItemView, type WorkspaceLeaf } from "obsidian";
import type DungeonPlugin from "../../main";
import { CREATURE_CATALOG_VIEW } from "../../ui/view-types";
import { CatalogWorkspaceViewContent } from "../../../../features/catalog/catalog-workspace-view-content";

export class CreatureCatalogView extends ItemView {
  private readonly content: CatalogWorkspaceViewContent;

  constructor(leaf: WorkspaceLeaf, plugin: DungeonPlugin) {
    super(leaf);
    this.content = new CatalogWorkspaceViewContent(this.contentEl, {
      notice: plugin.creatureCatalog.notice,
      loadCreatures: () => plugin.creatureCatalog.load(),
    });
  }

  getViewType(): string {
    return CREATURE_CATALOG_VIEW;
  }

  getDisplayText(): string {
    return "Katalog";
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
