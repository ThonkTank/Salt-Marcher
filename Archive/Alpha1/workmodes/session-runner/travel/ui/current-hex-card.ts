/**
 * Current Hex Card UI Component
 *
 * Displays information about the currently selected hex in the Session Runner sidebar.
 * Shows coordinates, terrain, flora, moisture level, and travel speed calculations.
 */

import { MOISTURE_LABELS, MOISTURE_COLORS } from "@features/maps";
import { getTerrainWithEmoji, getFloraWithEmoji, formatModifier } from "./terrain-flora-display";
import type { TerrainType, FloraType, MoistureLevel } from "@domain";

import type { AxialCoord } from "@geometry";

/**
 * Hex information data structure
 */
export interface HexInfo {
	coord: AxialCoord; // { q: number; r: number }
	terrain?: TerrainType;
	flora?: FloraType;
	moisture?: MoistureLevel;
}

/**
 * Speed calculation data structure
 */
export interface SpeedCalculation {
	terrain?: string;
	terrainMod?: number;
	flora?: string;
	floraMod?: number;
	combined?: number;
	hoursPerHex?: number;
}

/**
 * Current hex card interface
 * Creates content directly in provided host element (no wrapper)
 */
export interface CurrentHexCard {
	/** Update hex information display */
	setHexData(data: HexInfo | null): void;
	/** Update speed calculation display */
	setSpeedCalculation(data: SpeedCalculation): void;
	/** Destroy card */
	destroy(): void;
}

/**
 * Create current hex card component
 * Creates content directly in the provided host element (no wrapper div)
 */
export function createCurrentHexCard(host: HTMLElement): CurrentHexCard {
	// Placeholder state
	const placeholder = host.createDiv({
		cls: "sm-current-hex-card__placeholder",
		text: "Wähle ein Hex aus, um Details zu sehen",
	});

	// Content container (hidden initially)
	const content = host.createDiv({ cls: "sm-current-hex-card__content" });
	content.style.display = "none";

	// Coordinate display (prominent)
	const coordRow = content.createDiv({ cls: "sm-current-hex-card__coord-row" });
	coordRow.createSpan({ cls: "sm-current-hex-card__coord-label", text: "Hex:" });
	const coordValue = coordRow.createSpan({ cls: "sm-current-hex-card__coord-value" });

	// Data rows container - all info in one flat section
	const dataRows = content.createDiv({ cls: "sm-current-hex-card__data-rows" });

	// Terrain row (emoji + modifier when available)
	const terrainRow = dataRows.createDiv({ cls: "sm-current-hex-card__data-row" });
	terrainRow.createSpan({ cls: "sm-current-hex-card__data-label", text: "Terrain" });
	const terrainValue = terrainRow.createSpan({ cls: "sm-current-hex-card__data-value" });

	// Flora row (emoji + modifier when available)
	const floraRow = dataRows.createDiv({ cls: "sm-current-hex-card__data-row" });
	floraRow.createSpan({ cls: "sm-current-hex-card__data-label", text: "Flora" });
	const floraValue = floraRow.createSpan({ cls: "sm-current-hex-card__data-value" });

	// Moisture row
	const moistureRow = dataRows.createDiv({ cls: "sm-current-hex-card__data-row" });
	moistureRow.createSpan({ cls: "sm-current-hex-card__data-label", text: "Feuchtigkeit" });
	const moistureValue = moistureRow.createSpan({ cls: "sm-current-hex-card__data-value" });

	// Combined modifier row (hidden until speed data)
	const combinedRow = dataRows.createDiv({ cls: "sm-current-hex-card__data-row" });
	combinedRow.createSpan({ cls: "sm-current-hex-card__data-label", text: "Kombiniert" });
	const combinedValue = combinedRow.createSpan({ cls: "sm-current-hex-card__data-value" });
	combinedRow.style.display = "none";

	// Travel duration row (hidden until speed data)
	const durationRow = dataRows.createDiv({ cls: "sm-current-hex-card__data-row" });
	durationRow.createSpan({ cls: "sm-current-hex-card__data-label", text: "Reisedauer" });
	const durationValue = durationRow.createSpan({ cls: "sm-current-hex-card__data-value" });
	durationRow.style.display = "none";

	/**
	 * Update hex information display
	 * Sets terrain/flora/moisture - modifiers added later by setSpeedCalculation
	 */
	const setHexData = (data: HexInfo | null) => {
		if (!data) {
			// Show placeholder
			placeholder.style.display = "block";
			content.style.display = "none";
			return;
		}

		// Hide placeholder, show content
		placeholder.style.display = "none";
		content.style.display = "block";

		// Update coordinates
		const { coord, terrain, flora, moisture } = data;
		coordValue.textContent = `q=${coord.q}, r=${coord.r}`;

		// Update terrain (emoji only, modifier added by setSpeedCalculation)
		terrainValue.textContent = getTerrainWithEmoji(terrain);

		// Update flora (emoji only, modifier added by setSpeedCalculation)
		floraValue.textContent = getFloraWithEmoji(flora);

		// Update moisture with colored indicator
		if (moisture) {
			const label = MOISTURE_LABELS[moisture];
			const color = MOISTURE_COLORS[moisture];

			moistureValue.empty();
			const indicator = moistureValue.createSpan({ cls: "sm-current-hex-card__moisture-indicator" });
			indicator.style.backgroundColor = color;
			moistureValue.createSpan({ text: label });
		} else {
			moistureValue.textContent = "-";
		}
	};

	/**
	 * Update speed calculation display
	 * Adds modifiers to terrain/flora rows, shows combined + duration
	 */
	const setSpeedCalculation = (data: SpeedCalculation) => {
		// Show speed rows if we have any data
		if (data.hoursPerHex !== undefined || data.terrain || data.flora) {
			// Update terrain row - add modifier if present
			const terrainWithEmoji = getTerrainWithEmoji(data.terrain);
			if (data.terrainMod !== undefined) {
				const terrainMod = formatModifier(data.terrainMod);
				terrainValue.textContent = `${terrainWithEmoji} ${terrainMod}`;
			} else {
				terrainValue.textContent = terrainWithEmoji;
			}

			// Update flora row - add modifier if present
			const floraWithEmoji = getFloraWithEmoji(data.flora);
			if (data.floraMod !== undefined) {
				const floraMod = formatModifier(data.floraMod);
				floraValue.textContent = `${floraWithEmoji} ${floraMod}`;
			} else {
				floraValue.textContent = floraWithEmoji;
			}

			// Show combined modifier if present
			if (data.combined !== undefined) {
				combinedValue.textContent = formatModifier(data.combined);
				combinedRow.style.display = "flex";
			} else {
				combinedRow.style.display = "none";
			}

			// Show travel duration if present
			if (data.hoursPerHex !== undefined) {
				const hours = data.hoursPerHex.toFixed(1);
				durationValue.textContent = `${hours} h/Hex`;
				durationRow.style.display = "flex";
			} else {
				durationRow.style.display = "none";
			}
		} else {
			// Hide speed-specific rows
			combinedRow.style.display = "none";
			durationRow.style.display = "none";
		}
	};

	/**
	 * Destroy card (clears host content)
	 */
	const destroy = () => {
		host.empty();
	};

	return {
		setHexData,
		setSpeedCalculation,
		destroy,
	};
}
