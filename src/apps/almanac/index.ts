/**
 * Almanac View
 *
 * Main view entry point for the Almanac workmode.
 * Registers as an Obsidian ItemView.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { App } from 'obsidian';
import { AlmanacController } from './mode/almanac-controller';

export const VIEW_TYPE_ALMANAC = 'almanac-view';
export const VIEW_ALMANAC = VIEW_TYPE_ALMANAC;

export class AlmanacView extends ItemView {
  controller: AlmanacController;
  hostEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.controller = new AlmanacController(this.app as App);
  }

  getViewType(): string {
    return VIEW_TYPE_ALMANAC;
  }

  getDisplayText(): string {
    return 'Almanac';
  }

  getIcon(): string {
    return 'calendar';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl;
    const content = container.children[1] as HTMLElement;
    content.empty();

    this.hostEl = content.createDiv({ cls: 'almanac-host' });

    await this.controller.onOpen(this.hostEl);
  }

  async onClose(): Promise<void> {
    await this.controller.onClose();
    this.hostEl = null;
  }
}

/**
 * Opens or activates the Almanac view in the main workspace
 */
export async function openAlmanac(app: App): Promise<void> {
  const { workspace } = app;

  // Check if view is already open
  const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_ALMANAC);

  if (existingLeaves.length > 0) {
    // Activate existing leaf
    workspace.revealLeaf(existingLeaves[0]);
    return;
  }

  // Create new leaf in main workspace (new tab)
  const leaf = workspace.getLeaf(true);
  await leaf.setViewState({ type: VIEW_TYPE_ALMANAC, active: true });
  workspace.revealLeaf(leaf);
}
