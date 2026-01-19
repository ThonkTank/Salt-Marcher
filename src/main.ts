// Ziel: Obsidian Plugin Entry Point für Salt Marcher
// Siehe: docs/architecture/Orchestration.md

import { Plugin } from 'obsidian';
// TODO: CombatTestView not yet implemented
// import { CombatTestView, VIEW_TYPE_COMBAT_TEST } from '@/views/CombatTestView/CombatTestView';

export default class SaltMarcherPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('[Salt Marcher] Loading plugin...');

    // TODO: Register Combat Test View when implemented
    // this.registerView(
    //   VIEW_TYPE_COMBAT_TEST,
    //   (leaf) => new CombatTestView(leaf)
    // );

    // TODO: Add command to open Combat Test View when implemented
    // this.addCommand({
    //   id: 'open-combat-test',
    //   name: 'Open Combat Test View',
    //   callback: () => {
    //     this.activateView(VIEW_TYPE_COMBAT_TEST);
    //   },
    // });

    // TODO: Add ribbon icon for quick access when implemented
    // this.addRibbonIcon('swords', 'Combat Test', () => {
    //   this.activateView(VIEW_TYPE_COMBAT_TEST);
    // });

    console.log('[Salt Marcher] Plugin loaded');
  }

  async onunload(): Promise<void> {
    console.log('[Salt Marcher] Unloading plugin...');
  }

  /**
   * Aktiviert eine View im Workspace.
   * Öffnet einen neuen Tab oder fokussiert einen existierenden.
   */
  private async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;

    // Check if view is already open
    let leaf = workspace.getLeavesOfType(viewType)[0];

    if (!leaf) {
      // Create new leaf in main area (center)
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: viewType, active: true });
    }

    // Focus the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
