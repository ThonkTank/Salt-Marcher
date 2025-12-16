/**
 * ============================================================================
 * ENCOUNTER TRACKER VIEW - Combat Tracker UI for Live Session Encounters
 * ============================================================================
 *
 * Obsidian ItemView that displays:
 * - Nearby creatures based on current hex location (habitat-scored)
 * - Active combat with initiative tracking and HP management
 * - Generated encounter integration from the encounter-generator
 *
 * ## Architecture Position
 *
 * This view is a **consumer** of the encounter system components:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     ENCOUNTER TRACKER ARCHITECTURE                       │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   Session Runner Controller        Encounter Tracker View                │
 * │   ─────────────────────────       ────────────────────────               │
 * │                                                                          │
 * │   Hex selection change ──►  updateHex(coord, tileData)                  │
 * │                                    │                                     │
 * │                                    ▼                                     │
 * │                             ┌──────────────┐                            │
 * │                             │ CreatureStore │ (global store)            │
 * │                             └──────┬───────┘                            │
 * │                                    │                                     │
 * │                                    ▼                                     │
 * │                      filterCreaturesByHabitat()                         │
 * │                                    │                                     │
 * │                                    ▼                                     │
 * │                          nearbyCreatures[] (with scores)                │
 * │                                    │                                     │
 * │                                    ▼                                     │
 * │                              CombatView.render()                        │
 * │                                                                          │
 * │   Encounter Generated ──►  receiveEncounter(encounter)                  │
 * │                                    │                                     │
 * │                                    ▼                                     │
 * │                             CombatPresenter                              │
 * │                             (initiative tracking)                        │
 * │                                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Integration Points
 *
 * 1. **CreatureStore** (`@features/encounters/creature-store`)
 *    - `getCreatureStore()` - Get all creatures from global store
 *    - Used in `updateHex()` and `getAvailableTypes()`
 *
 * 2. **Encounter Filter** (`@features/encounters/encounter-filter`)
 *    - `filterCreaturesByHabitat()` - Score creatures by terrain/flora/moisture
 *    - Called in `updateHex()` to build nearbyCreatures list
 *
 * 3. **Encounter Generator** (`@features/encounters/encounter-generator`)
 *    - Produces `Encounter` objects
 *    - Received via `receiveEncounter()` from Session Runner controller
 *
 * ## Usage
 *
 * ```typescript
 * import { openEncounterTracker } from '@workmodes/session-runner/view/controllers/encounter';
 *
 * // Open tracker and get handle
 * const handle = await openEncounterTracker(app);
 *
 * // Update when hex changes (called by Session Runner)
 * await handle.updateHex(
 *     { x: 10, y: 20 },
 *     { terrain: 'forest', flora: 'dense', moisture: 'wet' }
 * );
 *
 * // Inject a generated encounter
 * await handle.receiveEncounter(generatedEncounter);
 *
 * // Close when done
 * await handle.close();
 * ```
 *
 * ## Related Files
 *
 * - `creature-store.ts` - Source of creature data
 * - `encounter-filter.ts` - Habitat scoring for nearby creatures
 * - `encounter-generator.ts` - Generates encounters that this view displays
 * - `combat-presenter.ts` - Initiative and HP tracking state management
 * - `combat-view.ts` - DOM rendering for combat UI
 * - `encounter-tracker-handle.ts` - Interface for external control
 *
 * @see creature-store.ts for how creatures are loaded and cached
 * @see encounter-filter.ts for habitat scoring algorithm
 * @module workmodes/session-runner/view/controllers/encounter
 */

import type { WorkspaceLeaf } from "obsidian";
import { ItemView, Notice, type App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { getRightLeaf } from "@ui/utils/layout";

const logger = configurableLogger.forModule("session-encounter-tracker");
import type { AxialCoord } from "@geometry";
import type { EncounterEvent, EncounterCreature } from "@services/domain/encounter-types";
import {
    CombatPresenter,
    type CombatStateWithTemp,
    type CombatParticipantWithTemp,
} from "../../combat-presenter";
import { CombatView, type CombatViewCallbacks } from "../../combat-view";
import {
    getCreatureStore,
    type Creature,
} from "@features/encounters/creature-store";
import { filterCreaturesByHabitat } from "@features/encounters/encounter-filter";
import type { Encounter } from "@features/encounters/encounter-types";
import { combatantToParticipant } from "../../../combat-logic";
import {
    initializeSharedLifecycle,
    type LifecycleHandles,
    type SubscriptionConfig,
} from "../../../session-runner-lifecycle-manager";

export const VIEW_ENCOUNTER_TRACKER = "salt-encounter-tracker";

/**
 * Persisted state for the encounter tracker
 */
export interface EncounterTrackerState {
    encounter: EncounterEvent | null;
    creatures: EncounterCreature[];
    combat: CombatStateWithTemp | null;
}

export class EncounterTrackerView extends ItemView {
    private presenter: CombatPresenter | null = null;
    private combatView: CombatView | null = null;
    private lifecycle: LifecycleHandles | null = null;
    private pendingState: EncounterTrackerState | null = null;

    // Current encounter metadata and creatures
    private currentEncounter: EncounterEvent | null = null;
    private creatures: EncounterCreature[] = [];
    private isGenerating: boolean = false;

    // Nearby creatures by habitat (with scores)
    private nearbyCreatures: Array<{ creature: Creature; score: number }> = [];

    // Filter state
    private crMin: number = 0;
    private crMax: number = 30;
    private selectedTypes: Set<string> = new Set(["Beast"]);

    // Current hex context for re-filtering when filters change
    private currentHexCoord: { x: number; y: number } | null = null;
    private currentHexTileData: { terrain?: string; flora?: string; moisture?: string } | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_ENCOUNTER_TRACKER;
    }
    getDisplayText() {
        return "Encounter Tracker";
    }
    getIcon() {
        return "sword" as any;
    }

    async onOpen() {
        const callbacks: CombatViewCallbacks = {
            onStartCombat: () => this.handleStartCombat(),
            onEndCombat: () => this.presenter?.endCombat(),
            onUpdateInitiative: (id, init) => this.presenter?.updateInitiative(id, init),
            onUpdateHp: (id, curr, max) => this.presenter?.updateHp(id, curr, max),
            onUpdateTempHp: (id, temp) => this.presenter?.updateTempHp(id, temp),
            onApplyDamage: (id, amount) => this.presenter?.applyDamage(id, amount),
            onApplyHealing: (id, amount) => this.presenter?.applyHealing(id, amount),
            onToggleDefeated: (id) => this.presenter?.toggleDefeated(id),
            onSetActive: (id) => this.presenter?.setActiveParticipant(id),
            onSortByInitiative: () => this.presenter?.sortByInitiative(),
            onUpdateCrRange: (min, max) => this.updateCrRange(min, max),
            onAddTypeFilter: (type) => this.addTypeFilter(type),
            onRemoveTypeFilter: (type) => this.removeTypeFilter(type),
        };

        const combatView = new CombatView(this.contentEl, callbacks);
        combatView.mount();
        this.combatView = combatView;

        const initialCombat = this.pendingState?.combat ?? null;
        const presenter = new CombatPresenter(initialCombat);
        this.presenter = presenter;

        const subscriptions: SubscriptionConfig[] = [
            {
                id: "presenter-state",
                subscribe: () =>
                    presenter.subscribe((state) => {
                        this.renderCombat(state);
                    }),
            },
        ];

        this.lifecycle = initializeSharedLifecycle({
            name: "encounter-tracker",
            subscriptions,
            listeners: [],
        });

        if (this.pendingState) {
            this.currentEncounter = this.pendingState.encounter;
            this.creatures = this.pendingState.creatures;
            this.pendingState = null;
        }

        this.renderCombat(presenter.getState());
        logger.info("View opened");
    }

    async onClose() {
        this.lifecycle?.dispose();
        this.lifecycle = null;
        this.presenter?.dispose();
        this.presenter = null;
        this.combatView?.unmount();
        this.combatView = null;
        this.pendingState = null;
    }

    private handleStartCombat() {
        if (!this.presenter || this.creatures.length === 0) {
            logger.warn("Cannot start combat: no creatures");
            return;
        }

        const participants: CombatParticipantWithTemp[] = [];
        for (const creature of this.creatures) {
            for (let i = 0; i < creature.count; i++) {
                const participantId = `${creature.id}-${i}`;
                const name =
                    creature.count > 1 ? `${creature.name} ${i + 1}` : creature.name;
                participants.push({
                    id: participantId,
                    creatureId: creature.id,
                    name,
                    initiative: 0,
                    currentHp: 0,
                    maxHp: 0,
                    tempHp: 0,
                    defeated: false,
                });
            }
        }

        this.presenter.startCombat(participants);
        logger.info("Combat started", {
            participantCount: participants.length,
        });
    }

    private renderCombat(combat: CombatStateWithTemp | null) {
        if (!this.combatView) return;

        const hasCreatures = this.creatures.length > 0;
        const filterState = {
            crMin: this.crMin,
            crMax: this.crMax,
            selectedTypes: this.selectedTypes,
            availableTypes: this.getAvailableTypes(),
        };

        this.combatView.render(
            combat,
            hasCreatures,
            this.isGenerating,
            this.creatures,
            this.nearbyCreatures,
            filterState
        );
    }

    updateCrRange(min: number, max: number): void {
        this.crMin = Math.max(0, min);
        this.crMax = Math.min(30, max);
        logger.info("CR range updated", {
            min: this.crMin,
            max: this.crMax,
        });
        // Re-filter creatures with updated CR range
        void this.refreshNearbyCreatures();
    }

    addTypeFilter(type: string): void {
        this.selectedTypes.add(type);
        logger.info("Type filter added", { type });
        // Re-filter creatures with updated type filter
        void this.refreshNearbyCreatures();
    }

    removeTypeFilter(type: string): void {
        this.selectedTypes.delete(type);
        logger.info("Type filter removed", { type });
        // Re-filter creatures with updated type filter
        void this.refreshNearbyCreatures();
    }

    getAvailableTypes(): string[] {
        // Get types from actual creatures in store (dynamic)
        try {
            const store = getCreatureStore();
            return store.getAllTypes();
        } catch {
            // Fallback to common D&D types if store not ready
            return [
                "Aberration",
                "Beast",
                "Celestial",
                "Construct",
                "Dragon",
                "Elemental",
                "Fey",
                "Fiend",
                "Giant",
                "Humanoid",
                "Monstrosity",
                "Ooze",
                "Plant",
                "Undead",
            ];
        }
    }

    /**
     * Update nearby creatures list when hex changes.
     *
     * **Called by**: Session Runner controller when user selects a different hex
     *
     * **Data Flow**:
     * 1. Get all creatures from global CreatureStore
     * 2. Apply type filter (e.g., "Beast" only)
     * 3. Apply CR range filter (e.g., CR 0-5)
     * 4. Score by habitat match using `filterCreaturesByHabitat()`
     * 5. Take top 15 highest-scoring creatures
     * 6. Re-render the view
     *
     * **Important**: Uses global CreatureStore, NOT a repository parameter.
     * The store is initialized once at plugin load and shared across all consumers.
     *
     * @param coord - Hex coordinate { x, y }
     * @param tileData - Tile environment data for habitat scoring
     *
     * @see filterCreaturesByHabitat for scoring algorithm
     * @see getCreatureStore for where creature data comes from
     */
    async updateHex(
        coord: { x: number; y: number },
        tileData: { terrain?: string; flora?: string; moisture?: string }
    ): Promise<void> {
        try {
            logger.info("updateHex", { coord, tileData });

            // Store hex context for re-filtering when filters change
            this.currentHexCoord = coord;
            this.currentHexTileData = tileData;

            if (!tileData) {
                this.nearbyCreatures = [];
                this.renderCombat(this.presenter?.getState() ?? null);
                return;
            }

            // Get creatures from global store
            const store = getCreatureStore();
            const allCreatures = store.get().creatures;

            // 1. Type filter
            const typeFiltered =
                this.selectedTypes.size > 0
                    ? allCreatures.filter((c) => this.selectedTypes.has(c.type))
                    : [...allCreatures];

            // 2. CR filter
            const crFiltered = typeFiltered.filter(
                (c) => c.cr >= this.crMin && c.cr <= this.crMax
            );

            // 3. Habitat scoring
            const creaturesForFilter = crFiltered.map((c) => ({
                name: c.name,
                type: c.type,
                cr: c.cr,
                terrainPreference: c.terrainPreference,
                floraPreference: c.floraPreference,
                moisturePreference: c.moisturePreference,
                file: c.file,
                data: {},
                habitatScore: 0,
            }));

            const scored = filterCreaturesByHabitat(creaturesForFilter, tileData, 0);

            // Sort by score and take top 15
            const sorted = scored
                .sort((a, b) => (b.habitatScore ?? 0) - (a.habitatScore ?? 0))
                .slice(0, 15);

            // Map back to Creature format with scores
            this.nearbyCreatures = sorted
                .map((s) => {
                    const original = allCreatures.find((c) => c.name === s.name);
                    return original ? { creature: original, score: s.habitatScore ?? 0 } : null;
                })
                .filter((x): x is { creature: Creature; score: number } => x !== null);

            logger.info("Updated nearby creatures", {
                total: allCreatures.length,
                displayed: this.nearbyCreatures.length,
            });

            this.renderCombat(this.presenter?.getState() ?? null);
        } catch (error) {
            logger.error("updateHex failed", error);
            this.nearbyCreatures = [];
            this.renderCombat(this.presenter?.getState() ?? null);
        }
    }

    /**
     * Re-filter nearby creatures using stored hex context.
     * Called when filter state changes (CR range, type filters).
     */
    private async refreshNearbyCreatures(): Promise<void> {
        if (!this.currentHexCoord || !this.currentHexTileData) {
            logger.debug("No hex context for refresh");
            return;
        }
        await this.updateHex(this.currentHexCoord, this.currentHexTileData);
    }

    /**
     * Receive a generated encounter and start combat.
     *
     * **Called by**: Session Runner controller after `generateEncounterFromHabitat()`
     *
     * **What happens**:
     * 1. End any existing combat
     * 2. Convert encounter combatants to combat participants
     * 3. Start new combat with the participants
     * 4. Re-render the view
     *
     * @param encounter - Generated encounter from encounter-generator.ts
     *
     * @see generateEncounterFromHabitat for how encounters are created
     * @see combatantToParticipant for conversion logic
     */
    async receiveEncounter(encounter: Encounter): Promise<void> {
        try {
            logger.info("Receiving encounter", {
                title: encounter.title,
                combatants: encounter.combatants.length,
            });

            const participants: CombatParticipantWithTemp[] =
                encounter.combatants.map((c) => combatantToParticipant(c));

            this.currentEncounter = {
                id: `encounter-${Date.now()}`,
                source: "generated",
                title: encounter.title,
                difficulty: encounter.difficulty,
                totalXp: encounter.totalXp,
                adjustedXp: encounter.adjustedXp,
            } as EncounterEvent;

            this.creatures = encounter.combatants.map((c) => ({
                id: c.id,
                name: c.name,
                count: 1,
                cr: c.cr,
            }));

            if (this.presenter) {
                if (this.presenter.getState().isActive) {
                    this.presenter.endCombat();
                }
                this.presenter.startCombat(participants);
            } else {
                this.pendingState = {
                    encounter: this.currentEncounter,
                    creatures: this.creatures,
                    combat: {
                        isActive: true,
                        participants,
                        activeParticipantId: participants[0]?.id || null,
                    },
                };
            }

            this.renderCombat(this.presenter?.getState() ?? null);
        } catch (error) {
            logger.error("receiveEncounter failed", error);
            new Notice("Failed to load encounter");
        }
    }

    getViewData(): EncounterTrackerState | null {
        const combat =
            this.presenter?.getState() ?? this.pendingState?.combat ?? null;
        return {
            encounter: this.currentEncounter,
            creatures: this.creatures,
            combat,
        };
    }

    setViewData(data: EncounterTrackerState | null | undefined) {
        const normalized: EncounterTrackerState = data ?? {
            encounter: null,
            creatures: [],
            combat: null,
        };

        if (this.presenter && normalized.combat?.isActive) {
            this.presenter.startCombat(normalized.combat.participants);
        } else {
            this.pendingState = normalized;
        }

        this.currentEncounter = normalized.encounter;
        this.creatures = normalized.creatures;
    }
}

// ============================================================================
// External Handle Factory
// ============================================================================

/**
 * Create an external handle for the encounter tracker view.
 *
 * The handle provides a controlled interface for other components to interact
 * with the tracker without direct access to the view internals.
 *
 * @param view - The EncounterTrackerView instance
 * @param leaf - The Obsidian workspace leaf containing the view
 * @returns Handle with updateHex, receiveEncounter, and close methods
 *
 * @see EncounterTrackerHandle interface in encounter-tracker-handle.ts
 */
function createEncounterTrackerHandle(
    view: EncounterTrackerView,
    leaf: WorkspaceLeaf
): import("../../../encounter-tracker-handle").EncounterTrackerHandle {
    return {
        updateHex: (coord, tileData) => view.updateHex(coord, tileData),
        receiveEncounter: (encounter) => view.receiveEncounter(encounter),
        close: async () => {
            await leaf.detach();
        },
    };
}

/**
 * Opens the Encounter Tracker in the right leaf.
 *
 * **Primary entry point** for opening the encounter tracker from other components.
 *
 * **Behavior**:
 * - If tracker already exists: Returns handle to existing view
 * - If no tracker: Creates new view in right panel
 * - Always reveals the leaf (brings to focus)
 *
 * @param app - Obsidian App instance
 * @returns Promise resolving to EncounterTrackerHandle for external control
 *
 * @example
 * ```typescript
 * // In Session Runner controller
 * const tracker = await openEncounterTracker(this.app);
 *
 * // Update when hex changes
 * tracker.updateHex({ x: 10, y: 20 }, currentTileData);
 *
 * // Send generated encounter
 * const encounter = generateEncounterFromHabitat(context);
 * tracker.receiveEncounter(encounter);
 * ```
 */
export async function openEncounterTracker(
    app: App
): Promise<import("../../../types/encounter-tracker-handle").EncounterTrackerHandle> {
    const leaves = app.workspace.getLeavesOfType(VIEW_ENCOUNTER_TRACKER);
    let leaf: WorkspaceLeaf;
    let view: EncounterTrackerView;

    if (leaves.length > 0) {
        leaf = leaves[0];
        view = leaf.view as EncounterTrackerView;
    } else {
        leaf = getRightLeaf(app);
        await leaf.setViewState({ type: VIEW_ENCOUNTER_TRACKER, active: true });
        view = leaf.view as EncounterTrackerView;
    }

    app.workspace.revealLeaf(leaf);
    return createEncounterTrackerHandle(view, leaf);
}
