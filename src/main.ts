/**
 * Salt Marcher - Obsidian Plugin Entry Point
 *
 * D&D 5e world-building and session management tool.
 * Phase 2: Travel-Minimal (with Vault Persistence)
 */

import { Plugin } from 'obsidian';

// Infrastructure
import {
  // Settings
  loadSettings,
  createSettingsService,
  SaltMarcherSettingTab,
  // Vault I/O
  createVaultIO,
  // Vault-backed adapters
  createVaultMapAdapter,
  createVaultPartyAdapter,
  // In-memory adapters (terrain stays in-memory as preset data)
  createTerrainRegistry,
  // Constants for default IDs (used until proper map/party selection UI)
  TEST_MAP_ID,
  DEFAULT_PARTY_ID,
} from './infrastructure';

// Features
import { createMapStore, createMapService } from './features/map';
import { createPartyStore, createPartyService } from './features/party';
import { createTravelService } from './features/travel';

// Application
import {
  VIEW_TYPE_SESSION_RUNNER,
  SessionRunnerView,
} from './application/session-runner';

// ============================================================================
// Plugin
// ============================================================================

export default class SaltMarcherPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('Salt Marcher: Loading plugin...');

    // =========================================================================
    // Bootstrap: Settings
    // =========================================================================

    const initialSettings = await loadSettings(this);
    const settingsService = createSettingsService(this, initialSettings);

    // Register settings tab in Obsidian settings
    this.addSettingTab(
      new SaltMarcherSettingTab(this.app, this, settingsService)
    );

    // =========================================================================
    // Bootstrap: Infrastructure
    // =========================================================================

    // Vault I/O for file operations
    const vaultIO = createVaultIO(this.app.vault);

    // Vault-backed storage adapters
    const mapStorage = createVaultMapAdapter({
      vaultIO,
      getMapsPath: () => settingsService.getMapsPath(),
    });

    const partyStorage = createVaultPartyAdapter({
      vaultIO,
      getPartiesPath: () => settingsService.getPartiesPath(),
    });

    // Terrain stays in-memory (preset data, not user-created)
    const terrainStorage = createTerrainRegistry();

    // =========================================================================
    // Bootstrap: Features
    // =========================================================================

    // Map Feature
    const mapStore = createMapStore();
    const mapFeature = createMapService({
      store: mapStore,
      mapStorage,
      terrainStorage,
    });

    // Party Feature
    const partyStore = createPartyStore();
    const partyFeature = createPartyService({
      store: partyStore,
      storage: partyStorage,
    });

    // Travel Feature
    const travelFeature = createTravelService({
      mapFeature,
      partyFeature,
    });

    // =========================================================================
    // Bootstrap: Views
    // =========================================================================

    this.registerView(VIEW_TYPE_SESSION_RUNNER, (leaf) => {
      return new SessionRunnerView(leaf, {
        mapFeature,
        partyFeature,
        travelFeature,
        terrainStorage,
        defaultMapId: TEST_MAP_ID,
        defaultPartyId: DEFAULT_PARTY_ID,
      });
    });

    // =========================================================================
    // UI: Ribbon Icon
    // =========================================================================

    this.addRibbonIcon('map', 'Open Session Runner', async () => {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_RUNNER);

      if (existing.length > 0) {
        // Focus existing view
        this.app.workspace.revealLeaf(existing[0]);
      } else {
        // Open new view in right sidebar
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
          await leaf.setViewState({
            type: VIEW_TYPE_SESSION_RUNNER,
            active: true,
          });
          this.app.workspace.revealLeaf(leaf);
        }
      }
    });

    // =========================================================================
    // Commands
    // =========================================================================

    this.addCommand({
      id: 'open-session-runner',
      name: 'Open Session Runner',
      callback: async () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_RUNNER);

        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
        } else {
          const leaf = this.app.workspace.getRightLeaf(false);
          if (leaf) {
            await leaf.setViewState({
              type: VIEW_TYPE_SESSION_RUNNER,
              active: true,
            });
            this.app.workspace.revealLeaf(leaf);
          }
        }
      },
    });

    console.log('Salt Marcher: Plugin loaded!');
  }

  async onunload(): Promise<void> {
    console.log('Salt Marcher: Unloading plugin...');
  }
}
