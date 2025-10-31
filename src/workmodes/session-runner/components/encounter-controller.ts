/**
 * Encounter Controller for Session Runner
 *
 * Manages random encounter generation lifecycle including:
 * - Loading encounter tables from vault
 * - Building encounter context from current hex
 * - Generating balanced encounters
 * - Managing initiative tracker UI
 * - Coordinating with loot and audio systems
 */

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import { logger } from "../../../app/plugin-logger";
import type { EncounterTableData } from "../../library/encounter-tables/types";
import type { EncounterCombatant, GeneratedEncounter } from "../../../features/encounters/types";
import { generateEncounter, type EncounterGenerationContext } from "../../../features/encounters/encounter-generator";
import { LIBRARY_DATA_SOURCES } from "../../library/storage/data-sources";
import { createInitiativeTracker, type InitiativeTrackerHandle, type InitiativeTrackerCallbacks } from "./initiative-tracker";

export type EncounterControllerHandle = {
	readonly trackerHost: HTMLElement;
	generateRandomEncounter(context: EncounterGenerationContext): Promise<void>;
	clearEncounter(): void;
	dispose(): void;
};

type EncounterControllerOptions = {
	app: App;
	host: HTMLElement;
	onLootRequested?: (encounter: GeneratedEncounter) => Promise<void>;
	onCombatStart?: () => void;
	onCombatEnd?: () => void;
};

export async function createEncounterController(options: EncounterControllerOptions): Promise<EncounterControllerHandle> {
	const { app, host, onLootRequested, onCombatStart, onCombatEnd } = options;

	// UI State
	const trackerHost = host.createDiv({ cls: "sm-encounter-controller" });
	let initiativeTracker: InitiativeTrackerHandle | null = null;

	// Encounter State
	let currentEncounter: GeneratedEncounter | null = null;
	let encounterTables: EncounterTableData[] = [];
	let combatants: EncounterCombatant[] = [];
	let activeTurnIndex = -1;

	// Load available encounter tables
	await loadEncounterTables();

	/**
	 * Load all encounter tables from vault
	 */
	async function loadEncounterTables(): Promise<void> {
		try {
			const dataSource = LIBRARY_DATA_SOURCES["encounter-tables"];
			const files = await dataSource.list(app);

			const tables: EncounterTableData[] = [];
			for (const file of files) {
				try {
					const entry = await dataSource.load(app, file);
					if (entry) {
						tables.push(entry);
					}
				} catch (err) {
					logger.warn("[EncounterController] Failed to load encounter table", { file: file.path, err });
				}
			}

			encounterTables = tables;
			logger.info("[EncounterController] Loaded encounter tables", { count: tables.length });
		} catch (err) {
			logger.error("[EncounterController] Failed to load encounter tables", err);
			new Notice("Failed to load encounter tables");
		}
	}

	/**
	 * Generate random encounter based on context
	 */
	async function generateRandomEncounter(context: EncounterGenerationContext): Promise<void> {
		if (encounterTables.length === 0) {
			new Notice("No encounter tables available. Create some in the Library!");
			logger.warn("[EncounterController] Cannot generate encounter: no tables loaded");
			return;
		}

		try {
			logger.info("[EncounterController] Generating encounter", { context });

			const encounter = await generateEncounter(app, encounterTables, context);

			logger.info("[EncounterController] Encounter generated", {
				tableName: encounter.tableName,
				combatantCount: encounter.combatants.length,
				difficulty: encounter.difficulty,
				totalXP: encounter.totalXP,
				adjustedXP: encounter.adjustedXP,
			});

			currentEncounter = encounter;
			combatants = [...encounter.combatants];
			activeTurnIndex = 0; // Start with first combatant

			// Show warnings if any
			if (encounter.warnings.length > 0) {
				logger.warn("[EncounterController] Encounter generation warnings", { warnings: encounter.warnings });
				new Notice(`Encounter generated with warnings: ${encounter.warnings.join(", ")}`);
			} else {
				new Notice(`${encounter.difficulty.toUpperCase()} encounter: ${encounter.combatants.length} combatants (${encounter.adjustedXP} XP)`);
			}

			// Render initiative tracker
			renderInitiativeTracker();

			// Notify combat start
			if (onCombatStart) {
				onCombatStart();
			}
		} catch (err) {
			logger.error("[EncounterController] Failed to generate encounter", err);
			new Notice("Failed to generate encounter. Check console for details.");
		}
	}

	/**
	 * Render initiative tracker UI
	 */
	function renderInitiativeTracker(): void {
		// Clear existing tracker
		if (initiativeTracker) {
			initiativeTracker.destroy();
			initiativeTracker = null;
		}

		// Create new tracker
		const callbacks: InitiativeTrackerCallbacks = {
			onHpChange: handleHpChange,
			onRemoveCombatant: handleRemoveCombatant,
			onAdvanceTurn: handleAdvanceTurn,
		};

		initiativeTracker = createInitiativeTracker(trackerHost, callbacks);
		initiativeTracker.setCombatants(combatants);

		if (activeTurnIndex >= 0 && activeTurnIndex < combatants.length) {
			initiativeTracker.setActiveTurn(combatants[activeTurnIndex].id);
		}
	}

	/**
	 * Handle HP change for a combatant
	 */
	function handleHpChange(combatantId: string, newHp: number): void {
		const combatant = combatants.find((c) => c.id === combatantId);
		if (!combatant) {
			logger.warn("[EncounterController] Combatant not found for HP change", { combatantId });
			return;
		}

		combatant.currentHp = Math.max(0, newHp);
		logger.debug("[EncounterController] HP updated", { combatantId, newHp: combatant.currentHp });

		// Re-render
		if (initiativeTracker) {
			initiativeTracker.setCombatants(combatants);
			if (activeTurnIndex >= 0 && activeTurnIndex < combatants.length) {
				initiativeTracker.setActiveTurn(combatants[activeTurnIndex].id);
			}
		}

		// Check if combat ended
		checkCombatEnd();
	}

	/**
	 * Handle removing a combatant
	 */
	function handleRemoveCombatant(combatantId: string): void {
		const index = combatants.findIndex((c) => c.id === combatantId);
		if (index === -1) {
			logger.warn("[EncounterController] Combatant not found for removal", { combatantId });
			return;
		}

		logger.debug("[EncounterController] Removing combatant", { combatantId });
		combatants.splice(index, 1);

		// Adjust active turn index if needed
		if (activeTurnIndex >= combatants.length) {
			activeTurnIndex = 0;
		}

		// Re-render
		if (initiativeTracker) {
			initiativeTracker.setCombatants(combatants);
			if (activeTurnIndex >= 0 && activeTurnIndex < combatants.length) {
				initiativeTracker.setActiveTurn(combatants[activeTurnIndex].id);
			}
		}

		// Check if combat ended
		checkCombatEnd();
	}

	/**
	 * Handle advancing to next turn
	 */
	function handleAdvanceTurn(): void {
		if (combatants.length === 0) return;

		activeTurnIndex = (activeTurnIndex + 1) % combatants.length;
		logger.debug("[EncounterController] Advanced turn", {
			activeTurnIndex,
			combatantId: combatants[activeTurnIndex]?.id
		});

		if (initiativeTracker) {
			initiativeTracker.setActiveTurn(combatants[activeTurnIndex].id);
		}
	}

	/**
	 * Check if combat has ended (all enemies defeated)
	 */
	function checkCombatEnd(): void {
		const allDefeated = combatants.every((c) => c.currentHp <= 0);

		if (allDefeated && combatants.length > 0) {
			logger.info("[EncounterController] Combat ended - all combatants defeated");
			new Notice("Combat ended! All enemies defeated.");

			// Trigger loot generation
			if (currentEncounter && onLootRequested) {
				void onLootRequested(currentEncounter);
			}

			// Notify combat end
			if (onCombatEnd) {
				onCombatEnd();
			}
		}
	}

	/**
	 * Clear current encounter
	 */
	function clearEncounter(): void {
		if (initiativeTracker) {
			initiativeTracker.destroy();
			initiativeTracker = null;
		}

		currentEncounter = null;
		combatants = [];
		activeTurnIndex = -1;

		logger.debug("[EncounterController] Encounter cleared");
	}

	/**
	 * Dispose controller
	 */
	function dispose(): void {
		clearEncounter();
		trackerHost.remove();
		logger.debug("[EncounterController] Disposed");
	}

	return {
		trackerHost,
		generateRandomEncounter,
		clearEncounter,
		dispose,
	};
}
