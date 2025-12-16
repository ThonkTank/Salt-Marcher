/**
 * Salt Marcher - Obsidian Plugin
 *
 * D&D world-building tool with hex map editor, travel system,
 * and session management.
 *
 * @module main
 */

import { Plugin, WorkspaceLeaf } from 'obsidian';

// Features
import { createGeographyOrchestrator, type GeographyFeaturePort } from './features/geography';
import { createTimeOrchestrator, type TimeFeaturePort } from './features/time';
import { createEntityOrchestrator, type EntityFeaturePort } from './features/entity';
import { createTravelOrchestrator, type TravelFeaturePort } from './features/travel';
import { createEncounterOrchestrator, type EncounterFeaturePort } from './features/encounter';

// Infrastructure (Vault Adapters)
import {
  createVaultGeographyAdapter,
  createVaultTimeAdapter,
  createVaultEntityAdapter,
} from './infrastructure/vault';

// Application Layer
import {
  CARTOGRAPHER_VIEW_TYPE,
  CartographerView,
  createCartographerViewFactory,
} from './application/cartographer';
import {
  SESSION_RUNNER_VIEW_TYPE,
  SessionRunnerView,
  createSessionRunnerViewFactory,
} from './application/session-runner';
import {
  DETAIL_VIEW_TYPE,
  createDetailViewFactory,
} from './application/detail-view';

// Core
import { getEventBus, type EventBus } from './core/events/event-bus';

// ═══════════════════════════════════════════════════════════════
// Plugin
// ═══════════════════════════════════════════════════════════════

export default class SaltMarcherPlugin extends Plugin {
  private geographyFeature: GeographyFeaturePort | null = null;
  private timeFeature: TimeFeaturePort | null = null;
  private entityFeature: EntityFeaturePort | null = null;
  private travelFeature: TravelFeaturePort | null = null;
  private encounterFeature: EncounterFeaturePort | null = null;
  private eventBus: EventBus | null = null;

  async onload(): Promise<void> {
    console.log('[SaltMarcher] Loading plugin...');

    // Initialize core services
    this.eventBus = getEventBus();

    // Create infrastructure adapters
    const geographyAdapter = createVaultGeographyAdapter(this.app.vault, 'SaltMarcher');
    const timeAdapter = createVaultTimeAdapter(this.app.vault, 'SaltMarcher');
    const entityAdapter = createVaultEntityAdapter(this.app.vault, 'Presets');

    // Initialize features
    this.geographyFeature = createGeographyOrchestrator(geographyAdapter);
    await this.geographyFeature.initialize();

    this.timeFeature = createTimeOrchestrator(timeAdapter);
    await this.timeFeature.initialize();

    this.entityFeature = createEntityOrchestrator(entityAdapter);
    await this.entityFeature.initialize();

    // Initialize cross-feature orchestrators
    this.travelFeature = createTravelOrchestrator(
      this.geographyFeature,
      this.timeFeature,
      this.eventBus
    );
    await this.travelFeature.initialize();

    this.encounterFeature = createEncounterOrchestrator(
      this.entityFeature,
      this.geographyFeature,
      this.eventBus
    );
    await this.encounterFeature.initialize();

    // Register Cartographer view
    const cartographerFactory = createCartographerViewFactory(
      this.geographyFeature,
      this.eventBus
    );
    this.registerView(CARTOGRAPHER_VIEW_TYPE, cartographerFactory);

    // Register SessionRunner view
    const sessionRunnerFactory = createSessionRunnerViewFactory({
      geographyFeature: this.geographyFeature,
      timeFeature: this.timeFeature,
      eventBus: this.eventBus,
    });
    this.registerView(SESSION_RUNNER_VIEW_TYPE, sessionRunnerFactory);

    // Register DetailView (companion to SessionRunner, opened automatically)
    const detailViewFactory = createDetailViewFactory({
      eventBus: this.eventBus,
    });
    this.registerView(DETAIL_VIEW_TYPE, detailViewFactory);

    // Add ribbon icon for Cartographer
    this.addRibbonIcon('map', 'Open Cartographer', () => {
      this.activateCartographerView();
    });

    // Add ribbon icon for SessionRunner
    this.addRibbonIcon('play-circle', 'Open Session Runner', () => {
      this.activateSessionRunnerView();
    });

    // Add command palette entries
    this.addCommand({
      id: 'open-cartographer',
      name: 'Open Cartographer',
      callback: () => {
        this.activateCartographerView();
      },
    });

    this.addCommand({
      id: 'open-session-runner',
      name: 'Open Session Runner',
      callback: () => {
        this.activateSessionRunnerView();
      },
    });

    // Cartographer undo/redo commands (user configures hotkeys in Settings)
    this.addCommand({
      id: 'cartographer-undo',
      name: 'Cartographer: Undo',
      checkCallback: (checking) => {
        const view = this.getActiveCartographerView();
        if (view) {
          if (!checking) view.triggerUndo();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'cartographer-redo',
      name: 'Cartographer: Redo',
      checkCallback: (checking) => {
        const view = this.getActiveCartographerView();
        if (view) {
          if (!checking) view.triggerRedo();
          return true;
        }
        return false;
      },
    });

    // Cartographer save command
    this.addCommand({
      id: 'cartographer-save',
      name: 'Cartographer: Save Map',
      checkCallback: (checking) => {
        const view = this.getActiveCartographerView();
        if (view) {
          if (!checking) view.triggerSave();
          return true;
        }
        return false;
      },
    });

    console.log('[SaltMarcher] Plugin loaded successfully');
  }

  async onunload(): Promise<void> {
    console.log('[SaltMarcher] Unloading plugin...');

    // Detach all views
    this.app.workspace.detachLeavesOfType(CARTOGRAPHER_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(SESSION_RUNNER_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(DETAIL_VIEW_TYPE);

    // Cleanup cross-feature orchestrators (encounter first, then travel)
    if (this.encounterFeature) {
      this.encounterFeature.dispose();
      this.encounterFeature = null;
    }

    if (this.travelFeature) {
      this.travelFeature.dispose();
      this.travelFeature = null;
    }

    // Cleanup features
    if (this.entityFeature) {
      this.entityFeature.dispose();
      this.entityFeature = null;
    }

    if (this.timeFeature) {
      this.timeFeature.dispose();
      this.timeFeature = null;
    }

    if (this.geographyFeature) {
      this.geographyFeature.dispose();
      this.geographyFeature = null;
    }

    this.eventBus = null;

    console.log('[SaltMarcher] Plugin unloaded');
  }

  // ─────────────────────────────────────────────────────────────
  // View Activation
  // ─────────────────────────────────────────────────────────────

  private async activateCartographerView(): Promise<void> {
    await this.activateView(CARTOGRAPHER_VIEW_TYPE);
  }

  private async activateSessionRunnerView(): Promise<void> {
    await this.activateView(SESSION_RUNNER_VIEW_TYPE);
  }

  private async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(viewType);

    if (leaves.length > 0) {
      // Focus existing view
      leaf = leaves[0];
    } else {
      // Open as new tab in main area
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: viewType,
        active: true,
      });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Service Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the geography feature instance.
   * Used by views that need access to map data.
   */
  getGeographyFeature(): GeographyFeaturePort | null {
    return this.geographyFeature;
  }

  /**
   * Get the entity feature instance.
   * Used by encounter generators and entity queries.
   */
  getEntityFeature(): EntityFeaturePort | null {
    return this.entityFeature;
  }

  /**
   * Get the event bus instance.
   */
  getEventBus(): EventBus | null {
    return this.eventBus;
  }

  /**
   * Get the encounter feature instance.
   * Used for manual encounter triggers and party configuration.
   */
  getEncounterFeature(): EncounterFeaturePort | null {
    return this.encounterFeature;
  }

  // ─────────────────────────────────────────────────────────────
  // View Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the active CartographerView if it exists and is focused.
   */
  private getActiveCartographerView(): CartographerView | null {
    return this.app.workspace.getActiveViewOfType(CartographerView);
  }
}
