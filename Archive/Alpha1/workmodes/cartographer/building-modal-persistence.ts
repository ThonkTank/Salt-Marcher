// src/workmodes/cartographer/building-modal-persistence.ts
// Persistence logic for building management modal
//
// Extracted from building-management-modal.ts to reduce file size.
// Handles saving building changes, faction resource deduction, and worker assignments.

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import * as yaml from "js-yaml";
import { configurableLogger } from "@services/logging/configurable-logger";
import { repairBuilding } from "@features/locations/building-production";
import type { FactionData, FactionMember } from "../../workmodes/library/factions/faction-types";
import type { LocationData, BuildingProduction } from "../../workmodes/library/locations/location-types";

const logger = configurableLogger.forModule("cartographer-building-modal-persistence");

/**
 * Dependencies for persistence operations
 */
export interface BuildingPersistenceDeps {
	app: App;
	locationFile: TFile;
	locationData: LocationData;
	production: BuildingProduction;
	assignedWorkers: Array<{ faction: FactionData; member: FactionMember }>;
}

/**
 * Find faction file by name
 */
export async function findFactionFile(app: App, factionName: string): Promise<TFile | null> {
	const files = app.vault.getMarkdownFiles();
	const factionFiles = files.filter(f =>
		f.path.startsWith("SaltMarcher/Factions/") &&
		!f.path.includes("Presets")
	);

	for (const file of factionFiles) {
		const content = await app.vault.read(file);
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) continue;

		const parsed = yaml.load(fmMatch[1]) as any;
		if (parsed && parsed.name === factionName) {
			return file;
		}
	}

	return null;
}

/**
 * Load all factions from vault
 */
export async function loadAllFactions(app: App): Promise<FactionData[]> {
	const factions: FactionData[] = [];

	try {
		const files = app.vault.getMarkdownFiles();
		const factionFiles = files.filter(f =>
			f.path.startsWith("SaltMarcher/Factions/") &&
			!f.path.includes("Presets")
		);

		for (const file of factionFiles) {
			try {
				const content = await app.vault.read(file);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;

				const fm = fmMatch[1];
				if (!fm.includes("smType: faction")) continue;

				const parsed = yaml.load(fm) as any;
				if (!parsed || typeof parsed !== "object") continue;

				if (!parsed.name || typeof parsed.name !== "string") continue;

				factions.push(parsed as FactionData);
			} catch (error) {
				logger.warn('Error loading faction file', {
					file: file.path,
					error
				});
			}
		}
	} catch (error) {
		logger.error('Failed to load factions', { error });
	}

	return factions;
}

/**
 * Repair building and deduct resources from owning faction
 */
export async function repairBuildingWithResources(
	deps: BuildingPersistenceDeps,
	goldCost: number,
	equipmentCost: number,
	_conditionIncrease: number
): Promise<{ success: boolean; actualRepair?: number }> {
	try {
		const { app, locationData, production } = deps;

		// 1. Check if location has an owning faction
		if (locationData.owner_type !== "faction" || !locationData.owner_name) {
			new Notice("Building has no owning faction. Cannot deduct repair costs.");
			return { success: false };
		}

		const factionName = locationData.owner_name;

		// 2. Find and load faction file
		const factionFile = await findFactionFile(app, factionName);
		if (!factionFile) {
			new Notice(`Faction "${factionName}" not found.`);
			return { success: false };
		}

		const content = await app.vault.read(factionFile);
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) {
			new Notice(`Invalid faction file format for "${factionName}".`);
			return { success: false };
		}

		const faction = yaml.load(fmMatch[1]) as FactionData;

		// 3. Ensure faction has resources
		if (!faction.resources) {
			faction.resources = {};
		}

		// 4. Check if faction has enough resources
		const currentGold = faction.resources.gold || 0;
		const currentEquipment = faction.resources.equipment || 0;

		if (currentGold < goldCost || currentEquipment < equipmentCost) {
			new Notice(
				`Insufficient resources. Faction has ${currentGold} gold (need ${goldCost}) and ${currentEquipment} equipment (need ${equipmentCost}).`
			);
			return { success: false };
		}

		// 5. Deduct resources from faction
		faction.resources.gold = currentGold - goldCost;
		faction.resources.equipment = currentEquipment - equipmentCost;

		// 6. Save updated faction file
		const updatedFrontmatter = yaml.dump(faction);
		const updatedContent = `---\n${updatedFrontmatter}---${content.substring(fmMatch[0].length)}`;
		await app.vault.modify(factionFile, updatedContent);

		// 7. Apply repair to building
		const actualRepair = repairBuilding(production, goldCost, equipmentCost);

		logger.info('Building repaired', {
			location: locationData.name,
			faction: factionName,
			goldSpent: goldCost,
			equipmentSpent: equipmentCost,
			conditionIncrease: actualRepair,
			newCondition: production.condition
		});

		new Notice(
			`Repaired building: +${actualRepair.toFixed(0)} condition (now ${production.condition}%). Spent ${goldCost} gold and ${equipmentCost} equipment.`
		);

		return { success: true, actualRepair };
	} catch (error) {
		logger.error('Failed to repair building', { error });
		new Notice("Failed to repair building. Check console for details.");
		return { success: false };
	}
}

/**
 * Update faction files to reflect worker position and job assignments
 */
export async function saveFactionWorkerAssignments(deps: BuildingPersistenceDeps): Promise<void> {
	const { app, locationData, assignedWorkers } = deps;
	const locationName = locationData.name;

	// Group assigned workers by faction
	const workersByFaction = new Map<string, FactionMember[]>();
	for (const { faction, member } of assignedWorkers) {
		if (!workersByFaction.has(faction.name)) {
			workersByFaction.set(faction.name, []);
		}
		workersByFaction.get(faction.name)!.push(member);
	}

	// Update each faction file
	for (const [factionName, members] of workersByFaction.entries()) {
		try {
			const factionFile = await findFactionFile(app, factionName);
			if (!factionFile) {
				logger.warn('Faction file not found', { factionName });
				continue;
			}

			const content = await app.vault.read(factionFile);
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!fmMatch) continue;

			const parsed = yaml.load(fmMatch[1]) as FactionData;
			if (!parsed.members) parsed.members = [];

			// Update members that are assigned to this building
			for (const assignedMember of members) {
				const member = parsed.members.find(m => m.name === assignedMember.name);
				if (member) {
					// Update position to POI
					member.position = {
						type: "poi",
						location_name: locationName
					};
					// Set building reference for job
					if (!member.job) {
						member.job = {
							type: "guard", // Default job type
							building: locationName,
							progress: 0
						};
					} else {
						member.job.building = locationName;
					}
				}
			}

			// Serialize and save
			const yamlStr = yaml.dump(parsed, { lineWidth: -1, noRefs: true });
			const body = content.split(/\n---\n/)[1] || "";
			const newContent = `---\n${yamlStr}---\n${body}`;
			await app.vault.modify(factionFile, newContent);

			logger.info('Updated faction file', {
				faction: factionName,
				workers: members.length
			});
		} catch (error) {
			logger.error('Failed to update faction', {
				faction: factionName,
				error
			});
		}
	}
}

/**
 * Save all building changes to the location file
 */
export async function saveBuildingChanges(
	deps: BuildingPersistenceDeps,
	onSave?: (updatedData: LocationData) => void
): Promise<boolean> {
	try {
		const { app, locationFile, locationData, production } = deps;

		// 1. Update building production in location file
		await app.fileManager.processFrontMatter(
			locationFile,
			(frontmatter) => {
				frontmatter.building_production = production;
			}
		);

		// 2. Update faction files to reflect worker assignments
		await saveFactionWorkerAssignments(deps);

		logger.info('Saved building changes', {
			location: locationData.name,
			buildingType: production.buildingType,
			condition: production.condition,
			workers: production.currentWorkers
		});

		new Notice("Building changes saved");

		// Callback for parent components
		if (onSave) {
			const updatedData = { ...locationData };
			updatedData.building_production = production;
			onSave(updatedData);
		}

		return true;
	} catch (error) {
		logger.error('Failed to save building changes', { error });
		new Notice("Failed to save changes. Check console for details.");
		return false;
	}
}
