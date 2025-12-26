/**
 * Salt Marcher - Obsidian Plugin Entry Point
 *
 * D&D 5e world-building and session management tool.
 * Phase 2: Travel-Minimal (with Vault Persistence + Time)
 */

import { Plugin } from 'obsidian';
import type { EventBus } from '@core/index';
import { createEventBus, isSome, EventTypes, createEvent, newCorrelationId, now } from '@core/index';
import type { QuestSlotAssignmentAvailablePayload, QuestAssignEncounterRequestedPayload } from '@core/events/domain-events';
import type { QuestDefinition, Item } from '@core/schemas';

// Infrastructure
import {
  // Settings
  loadSettings,
  createSettingsService,
  SaltMarcherSettingTab,
  type SettingsService,
  // Vault I/O
  createVaultIO,
  type VaultIO,
  // Vault-backed adapters
  createVaultMapAdapter,
  createVaultPartyAdapter,
  createVaultTimeAdapter,
  createVaultCalendarAdapter,
  createAndPreloadEntityRegistry,
  // Character Storage
  createCharacterStorageAdapter,
  // In-memory adapters (terrain/items stay in-memory as preset data)
  createTerrainRegistry,
  createItemRegistry,
  // Constants for default IDs (used until proper map/party selection UI)
  TEST_MAP_ID,
  DEFAULT_PARTY_ID,
} from './infrastructure';
import type { EntityRegistryPort } from '@core/types/entity-registry.port';

// Features
import { createMapStore, createMapService, type MapFeaturePort } from './features/map';
import { createPartyStore, createPartyService, type PartyFeaturePort } from './features/party';
import { createTravelService, type TravelFeaturePort } from './features/travel';
import { createTimeStore, createTimeService, type TimeFeaturePort } from './features/time';
import { createWeatherStore, createWeatherService, type WeatherFeaturePort } from './features/weather';
import { createCombatService, type CombatFeaturePort } from './features/combat';
import { createQuestService, type QuestFeaturePort, type SerializableQuestState } from './features/quest';
import { addDuration, diffInHours } from './features/time';

// ============================================================================
// Plugin Data (Resumable State)
// ============================================================================

interface SaltMarcherPluginData {
  questState?: SerializableQuestState;
}

// Application
import {
  VIEW_TYPE_SESSION_RUNNER,
  SessionRunnerView,
} from './application/session-runner';
import {
  VIEW_TYPE_DETAIL_VIEW,
  DetailView,
} from './application/detail-view';
import {
  VIEW_TYPE_CARTOGRAPHER,
  CartographerView,
} from './application/cartographer';
import {
  VIEW_TYPE_LIBRARY,
  LibraryView,
} from './application/library';
import { createNotificationService, showSlotAssignmentDialog, type NotificationService } from './application/shared';

// Presets (for bootstrap)
import testOverworldPreset from '../presets/maps/test-overworld.json';
import demoPartyPreset from '../presets/parties/demo-party.json';
import gregorianCalendarPreset from '../presets/almanac/gregorian.json';
import questsPreset from '../presets/quests/demo-quests.json';
import itemsPreset from '../presets/items/base-items.json';
import charactersPreset from '../presets/characters/demo-characters.json';

// ============================================================================
// Bootstrap Fixtures
// ============================================================================

/**
 * Copy preset fixtures to vault if they don't exist.
 * Ensures a working demo state on first plugin load.
 */
async function bootstrapFixtures(
  vaultIO: VaultIO,
  settingsService: SettingsService
): Promise<void> {
  const mapsPath = settingsService.getMapsPath();
  const partiesPath = settingsService.getPartiesPath();
  const almanacPath = settingsService.getAlmanacPath();

  // Bootstrap map if it doesn't exist
  const mapPath = `${mapsPath}/${TEST_MAP_ID}.json`;
  const mapExists = await vaultIO.exists(mapPath);
  if (!mapExists) {
    console.log('Salt Marcher: Bootstrapping test map...');
    const result = await vaultIO.writeJson(mapPath, testOverworldPreset);
    if (!result.ok) {
      console.error('Salt Marcher: Failed to bootstrap map:', result.error);
    }
  }

  // Bootstrap party if it doesn't exist
  const partyPath = `${partiesPath}/${DEFAULT_PARTY_ID}.json`;
  const partyExists = await vaultIO.exists(partyPath);
  if (!partyExists) {
    console.log('Salt Marcher: Bootstrapping demo party...');
    const result = await vaultIO.writeJson(partyPath, demoPartyPreset);
    if (!result.ok) {
      console.error('Salt Marcher: Failed to bootstrap party:', result.error);
    }
  }

  // Bootstrap calendar if it doesn't exist
  const calendarPath = `${almanacPath}/gregorian-001.json`;
  const calendarExists = await vaultIO.exists(calendarPath);
  if (!calendarExists) {
    console.log('Salt Marcher: Bootstrapping Gregorian calendar...');
    const result = await vaultIO.writeJson(calendarPath, gregorianCalendarPreset);
    if (!result.ok) {
      console.error('Salt Marcher: Failed to bootstrap calendar:', result.error);
    }
  }

  // Bootstrap characters (always overwrite to ensure schema compatibility)
  const basePath = settingsService.getSettings().basePath;
  const charactersPath = `${basePath}/data/character`;
  await vaultIO.ensureDir(charactersPath);
  const characters = (charactersPreset as { characters: Array<{ id: string }> }).characters;
  for (const character of characters) {
    const charPath = `${charactersPath}/${character.id}.json`;
    const result = await vaultIO.writeJson(charPath, character);
    if (!result.ok) {
      console.error(`Salt Marcher: Failed to bootstrap character ${character.id}:`, result.error);
    }
  }
  console.log(`Salt Marcher: Character presets imported (${characters.length})`);
}

// ============================================================================
// Plugin
// ============================================================================

export default class SaltMarcherPlugin extends Plugin {
  // Instance variables for features (needed for onunload persistence and cleanup)
  private eventBus?: EventBus;
  private entityRegistry?: EntityRegistryPort;
  private mapFeature?: MapFeaturePort;
  private partyFeature?: PartyFeaturePort;
  private travelFeature?: TravelFeaturePort;
  private timeFeature?: TimeFeaturePort;
  private weatherFeature?: WeatherFeaturePort;
  private combatFeature?: CombatFeaturePort;
  private questFeature?: QuestFeaturePort;
  private notificationService?: NotificationService;
  private eventUnsubscribers: Array<() => void> = [];

  /**
   * Opens the session layout: SessionRunner in center, DetailView in right.
   */
  private async openSessionLayout(): Promise<void> {
    // Open SessionRunner in center leaf (or focus existing)
    const existingRunner = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_RUNNER);
    if (existingRunner.length > 0) {
      this.app.workspace.revealLeaf(existingRunner[0]);
    } else {
      // Get or create a center leaf
      const centerLeaf = this.app.workspace.getLeaf('tab');
      if (centerLeaf) {
        await centerLeaf.setViewState({
          type: VIEW_TYPE_SESSION_RUNNER,
          active: true,
        });
        this.app.workspace.revealLeaf(centerLeaf);
      }
    }

    // Open DetailView in right leaf (or focus existing)
    const existingDetail = this.app.workspace.getLeavesOfType(VIEW_TYPE_DETAIL_VIEW);
    if (existingDetail.length > 0) {
      this.app.workspace.revealLeaf(existingDetail[0]);
    } else {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_DETAIL_VIEW,
          active: true,
        });
      }
    }
  }

  /**
   * Ensures DetailView is open in the right leaf. Called on key events.
   */
  private async ensureDetailViewOpen(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DETAIL_VIEW);
    if (existing.length === 0) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_DETAIL_VIEW,
          active: true,
        });
      }
    }
  }

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

    // Bootstrap preset fixtures on first run
    await bootstrapFixtures(vaultIO, settingsService);

    // Event bus for cross-feature communication
    this.eventBus = createEventBus();

    // Vault-backed storage adapters
    const mapStorage = createVaultMapAdapter({
      vaultIO,
      getMapsPath: () => settingsService.getMapsPath(),
    });

    const partyStorage = createVaultPartyAdapter({
      vaultIO,
      getPartiesPath: () => settingsService.getPartiesPath(),
    });

    const timeStorage = createVaultTimeAdapter({
      vaultIO,
      getTimePath: () => settingsService.getTimePath(),
    });

    const calendarRegistry = createVaultCalendarAdapter({
      vaultIO,
      getAlmanacPath: () => settingsService.getAlmanacPath(),
    });

    // Terrain stays in-memory (preset data, not user-created)
    const terrainStorage = createTerrainRegistry();

    // Items stay in-memory (preset data for encumbrance calculation)
    const itemRegistry = createItemRegistry(itemsPreset as unknown as Item[]);

    // EntityRegistry - Preload all entity types for sync access
    // Note: Features still use preset arrays for now; EntityRegistry integration is separate task
    this.entityRegistry = await createAndPreloadEntityRegistry(
      this.app.vault,
      settingsService.getSettings().basePath,
      [
        'creature',
        'npc',
        'faction',
        'quest',
        'item',
        'terrain',
        'map',
        'poi',
        'calendar',
        'journal',
        'worldevent',
        'track',
        'shop',
        'party',
        'character',
      ]
    );
    console.log('Salt Marcher: EntityRegistry preloaded');

    // =========================================================================
    // Bootstrap: Notification Service
    // =========================================================================

    this.notificationService = createNotificationService();

    // =========================================================================
    // Bootstrap: Features
    // =========================================================================

    // Map Feature
    const mapStore = createMapStore();
    this.mapFeature = createMapService({
      store: mapStore,
      mapStorage,
      terrainStorage,
      eventBus: this.eventBus,
    });

    // Character Storage (EntityRegistry-backed)
    const characterStorage = createCharacterStorageAdapter(this.entityRegistry);

    // Party Feature (with itemLookup for encumbrance calculation)
    const partyStore = createPartyStore();
    this.partyFeature = createPartyService({
      store: partyStore,
      storage: partyStorage,
      characterStorage,
      eventBus: this.eventBus,
      itemLookup: (id) => itemRegistry.lookup(id),
    });

    // Time Feature
    const timeStore = createTimeStore();
    this.timeFeature = createTimeService({
      store: timeStore,
      storage: timeStorage,
      calendarRegistry,
      eventBus: this.eventBus,
    });

    // Load time state
    const timeLoadResult = await this.timeFeature.loadTime();
    if (!timeLoadResult.ok) {
      console.warn('Salt Marcher: Failed to load time state:', timeLoadResult.error);
    }

    // Weather Feature (depends on Map, Party, Time)
    const weatherStore = createWeatherStore();
    this.weatherFeature = createWeatherService({
      store: weatherStore,
      mapFeature: this.mapFeature,
      partyFeature: this.partyFeature,
      timeFeature: this.timeFeature,
      eventBus: this.eventBus,
    });

    // Combat Feature
    this.combatFeature = createCombatService({
      eventBus: this.eventBus,
    });

    // Quest Feature (depends on Time for deadline, EventBus for encounter integration)
    this.questFeature = createQuestService({
      eventBus: this.eventBus,
      questDefinitions: questsPreset as unknown as QuestDefinition[],
      getCurrentTime: () => this.timeFeature!.getCurrentTime(),
      addDurationToTime: (time, duration) => {
        const calendarOpt = this.timeFeature!.getActiveCalendar();
        if (!isSome(calendarOpt)) {
          // Fallback: just return time unchanged if no calendar loaded
          return time;
        }
        return addDuration(time, duration, calendarOpt.value);
      },
      isAfter: (a, b) => {
        const calendarOpt = this.timeFeature!.getActiveCalendar();
        if (!isSome(calendarOpt)) {
          // Fallback: simple comparison
          return a.year > b.year || (a.year === b.year && a.month > b.month) ||
                 (a.year === b.year && a.month === b.month && a.day > b.day);
        }
        return diffInHours(b, a, calendarOpt.value) > 0;
      },
    });

    // Initialize Quest Feature and restore state from plugin data
    await this.questFeature.initialize();
    const pluginData = await this.loadData() as SaltMarcherPluginData | null;
    if (pluginData?.questState) {
      this.questFeature.restoreState(pluginData.questState);
      console.log('Salt Marcher: Restored quest state from plugin data');
    }

    // Travel Feature (now with Weather)
    this.travelFeature = createTravelService({
      mapFeature: this.mapFeature,
      partyFeature: this.partyFeature,
      timeFeature: this.timeFeature,
      weatherFeature: this.weatherFeature,
      eventBus: this.eventBus,
    });

    // =========================================================================
    // Bootstrap: Views
    // =========================================================================

    // SessionRunner - Map view (opens in center leaf)
    this.registerView(VIEW_TYPE_SESSION_RUNNER, (leaf) => {
      return new SessionRunnerView(leaf, {
        mapFeature: this.mapFeature!,
        partyFeature: this.partyFeature!,
        travelFeature: this.travelFeature!,
        timeFeature: this.timeFeature!,
        weatherFeature: this.weatherFeature,
        questFeature: this.questFeature,
        terrainStorage,
        notificationService: this.notificationService!,
        eventBus: this.eventBus!,
        defaultMapId: TEST_MAP_ID,
        defaultPartyId: DEFAULT_PARTY_ID,
      });
    });

    // DetailView - Context-dependent details (opens in right leaf)
    this.registerView(VIEW_TYPE_DETAIL_VIEW, (leaf) => {
      return new DetailView(leaf, {
        combatFeature: this.combatFeature,
        partyFeature: this.partyFeature,
        eventBus: this.eventBus!,
        entityRegistry: this.entityRegistry,
      });
    });

    // Cartographer - Map editor (opens in center leaf)
    this.registerView(VIEW_TYPE_CARTOGRAPHER, (leaf) => {
      return new CartographerView(leaf, {
        defaultMapId: TEST_MAP_ID,
        eventBus: this.eventBus!,
        mapFeature: this.mapFeature!,
        notificationService: this.notificationService!,
      });
    });

    // Library - Entity CRUD interface (opens in center leaf)
    this.registerView(VIEW_TYPE_LIBRARY, (leaf) => {
      return new LibraryView(leaf, {
        entityRegistry: this.entityRegistry!,
        eventBus: this.eventBus,
      });
    });

    // =========================================================================
    // UI: Ribbon Icon - Opens both views in correct layout
    // =========================================================================

    this.addRibbonIcon('map', 'Open Session Runner', async () => {
      await this.openSessionLayout();
    });

    this.addRibbonIcon('edit', 'Open Cartographer', async () => {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
      if (existing.length > 0) {
        this.app.workspace.revealLeaf(existing[0]);
      } else {
        const leaf = this.app.workspace.getLeaf('tab');
        if (leaf) {
          await leaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
          this.app.workspace.revealLeaf(leaf);
        }
      }
    });

    this.addRibbonIcon('book-open', 'Open Library', async () => {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIBRARY);
      if (existing.length > 0) {
        this.app.workspace.revealLeaf(existing[0]);
      } else {
        const leaf = this.app.workspace.getLeaf('tab');
        if (leaf) {
          await leaf.setViewState({ type: VIEW_TYPE_LIBRARY, active: true });
          this.app.workspace.revealLeaf(leaf);
        }
      }
    });

    // =========================================================================
    // Commands
    // =========================================================================

    // Open full session layout (SessionRunner in center, DetailView in right)
    this.addCommand({
      id: 'open-session-runner',
      name: 'Open Session Runner',
      callback: async () => {
        await this.openSessionLayout();
      },
    });

    // Open only DetailView (for when you need details without map)
    this.addCommand({
      id: 'open-detail-view',
      name: 'Open Detail View',
      callback: async () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DETAIL_VIEW);
        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
        } else {
          const leaf = this.app.workspace.getRightLeaf(false);
          if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_DETAIL_VIEW, active: true });
            this.app.workspace.revealLeaf(leaf);
          }
        }
      },
    });

    // Open Cartographer (map editor)
    this.addCommand({
      id: 'open-cartographer',
      name: 'Open Cartographer',
      callback: async () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARTOGRAPHER);
        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
        } else {
          const leaf = this.app.workspace.getLeaf('tab');
          if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_CARTOGRAPHER, active: true });
            this.app.workspace.revealLeaf(leaf);
          }
        }
      },
    });

    // Open Library
    this.addCommand({
      id: 'open-library',
      name: 'Open Library',
      callback: async () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIBRARY);
        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
        } else {
          const leaf = this.app.workspace.getLeaf('tab');
          if (leaf) {
            await leaf.setViewState({ type: VIEW_TYPE_LIBRARY, active: true });
            this.app.workspace.revealLeaf(leaf);
          }
        }
      },
    });

    // Debug command - logs current state to console
    this.addCommand({
      id: 'debug-log-state',
      name: 'Debug: Log Current State',
      callback: () => {
        console.group('Salt Marcher Debug State');
        console.log('Map:', this.mapFeature?.getCurrentMap());
        console.log('Party:', this.partyFeature?.getCurrentParty());
        console.log('Time:', this.timeFeature?.getCurrentTime());
        console.log('Weather:', this.weatherFeature?.getCurrentWeather());
        console.log('Combat:', this.combatFeature?.getState());
        console.log('Quest:', this.questFeature?.getActiveQuests());
        console.groupEnd();
      },
    });

    // =========================================================================
    // Auto-Open DetailView on Key Events
    // =========================================================================

    // Auto-open DetailView when combat starts
    this.eventUnsubscribers.push(
      this.eventBus.subscribe('combat:started', () => {
        this.ensureDetailViewOpen();
      })
    );

    // Show Slot Assignment Dialog when quest slots are available
    this.eventUnsubscribers.push(
      this.eventBus.subscribe<QuestSlotAssignmentAvailablePayload>(
        EventTypes.QUEST_SLOT_ASSIGNMENT_AVAILABLE,
        async (event) => {
          const { encounterId, encounterXP, openSlots } = event.payload;

          // Only show if there are actually open slots
          if (openSlots.length === 0) return;

          const result = await showSlotAssignmentDialog(this.app, {
            encounterId,
            encounterXP,
            openSlots,
          });

          if (result.assigned && result.questId && result.slotId) {
            // Publish quest:assign-encounter-requested event
            this.eventBus?.publish(
              createEvent<QuestAssignEncounterRequestedPayload>(
                EventTypes.QUEST_ASSIGN_ENCOUNTER_REQUESTED,
                {
                  questId: result.questId,
                  slotId: result.slotId,
                  encounterId,
                  encounterXP,
                },
                {
                  correlationId: newCorrelationId(),
                  timestamp: now(),
                  source: 'slot-assignment-dialog',
                }
              )
            );
          }
        }
      )
    );

    console.log('Salt Marcher: Plugin loaded!');
  }

  async onunload(): Promise<void> {
    console.log('Salt Marcher: Unloading plugin...');

    // Save party state if dirty
    if (this.partyFeature) {
      const party = this.partyFeature.getCurrentParty();
      if (isSome(party)) {
        const saveResult = await this.partyFeature.saveParty();
        if (!saveResult.ok) {
          console.error('Salt Marcher: Failed to save party on unload:', saveResult.error);
        }
      }
    }

    // Save time state
    if (this.timeFeature?.isLoaded()) {
      const saveResult = await this.timeFeature.saveTime();
      if (!saveResult.ok) {
        console.error('Salt Marcher: Failed to save time on unload:', saveResult.error);
      }
    }

    // Save quest state to plugin data (Resumable)
    if (this.questFeature) {
      const questState = this.questFeature.getResumableState();
      const existingData = await this.loadData() as SaltMarcherPluginData | null;
      await this.saveData({ ...existingData, questState });
      console.log('Salt Marcher: Saved quest state to plugin data');
    }

    // Unsubscribe from auto-open events
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    // Dispose features (clean up EventBus subscriptions)
    this.travelFeature?.dispose();
    this.questFeature?.dispose();
    this.combatFeature?.dispose();
    this.weatherFeature?.dispose();
    this.partyFeature?.dispose();
    this.mapFeature?.dispose();
    this.timeFeature?.dispose();

    // Clear EventBus
    this.eventBus?.clear();
  }
}
