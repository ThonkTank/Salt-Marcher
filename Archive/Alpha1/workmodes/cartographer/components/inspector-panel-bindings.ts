// src/workmodes/cartographer/components/inspector-panel-bindings.ts
// Data binding functions between UI and data layer

import { getMovementSpeed } from "@features/maps/config/terrain";
import type { TerrainType, FloraType } from "@domain";
import type { InspectorUI } from "./inspector-panel-types";

/**
 * Bind terrain value to UI element
 */
export function bindTerrainToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    if (ui.terrain) {
        ui.terrain.setValue(value);
        ui.terrain.setDisabled(disabled);

        // Update search dropdown input if enhanced
        const searchInput = (ui.terrain.element as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            const option = Array.from(ui.terrain.element.options).find(opt => opt.value === value);
            searchInput.value = option?.text || '';
        }
    }
}

/**
 * Get terrain value from UI element
 */
export function getTerrainFromUI(ui: InspectorUI): string | undefined {
    return ui.terrain?.getValue() || undefined;
}

/**
 * Bind flora value to UI element
 */
export function bindFloraToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    if (ui.flora) {
        ui.flora.setValue(value);
        ui.flora.setDisabled(disabled);

        // Update search dropdown input if enhanced
        const searchInput = (ui.flora.element as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            const option = Array.from(ui.flora.element.options).find(opt => opt.value === value);
            searchInput.value = option?.text || '';
        }
    }
}

/**
 * Get flora value from UI element
 */
export function getFloraFromUI(ui: InspectorUI): string | undefined {
    return ui.flora?.getValue() || undefined;
}

/**
 * Bind background color value to UI element
 */
export function bindBackgroundColorToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    if (ui.backgroundColor) {
        // Color input requires # prefix, default to white if empty
        ui.backgroundColor.value = value || "#ffffff";
        ui.backgroundColor.disabled = disabled;
    }
}

/**
 * Get background color value from UI element
 */
export function getBackgroundColorFromUI(ui: InspectorUI): string | undefined {
    return ui.backgroundColor?.value || undefined;
}

/**
 * Bind region value to UI element
 */
export function bindRegionToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    if (ui.region) {
        ui.region.setValue(value);
        ui.region.setDisabled(disabled);

        // Update search dropdown input if enhanced
        const searchInput = (ui.region.element as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            const option = Array.from(ui.region.element.options).find(opt => opt.value === value);
            searchInput.value = option?.text || '';
        }
    }
}

/**
 * Get region value from UI element
 */
export function getRegionFromUI(ui: InspectorUI): string | undefined {
    return ui.region?.getValue() || undefined;
}

/**
 * Bind faction value to UI element
 */
export function bindFactionToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    if (ui.faction) {
        ui.faction.setValue(value);
        ui.faction.setDisabled(disabled);

        // Update search dropdown input if enhanced
        const searchInput = (ui.faction.element as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            const option = Array.from(ui.faction.element.options).find(opt => opt.value === value);
            searchInput.value = option?.text || '';
        }
    }
}

/**
 * Get faction value from UI element
 */
export function getFactionFromUI(ui: InspectorUI): string | undefined {
    return ui.faction?.getValue() || undefined;
}

/**
 * Bind elevation value to UI element
 */
export function bindElevationToUI(ui: InspectorUI, value: number | undefined, disabled: boolean = false): void {
    if (ui.elevation) {
        ui.elevation.setValue(value ?? 0);
        ui.elevation.setDisabled(disabled);
    }
}

/**
 * Get elevation value from UI element
 */
export function getElevationFromUI(ui: InspectorUI): number | undefined {
    return ui.elevation?.getValue();
}

/**
 * Bind groundwater value to UI element
 */
export function bindGroundwaterToUI(ui: InspectorUI, value: number | undefined, disabled: boolean = false): void {
    if (ui.groundwater) {
        ui.groundwater.setValue(value ?? 0);
        ui.groundwater.setDisabled(disabled);
    }
}

/**
 * Get groundwater value from UI element
 */
export function getGroundwaterFromUI(ui: InspectorUI): number | undefined {
    return ui.groundwater?.getValue();
}

/**
 * Bind note value to UI element
 */
export function bindNoteToUI(ui: InspectorUI, value: string, disabled: boolean = false): void {
    ui.note?.setValue(value);
    ui.note?.setDisabled(disabled);
}

/**
 * Get note value from UI element
 */
export function getNoteFromUI(ui: InspectorUI): string | undefined {
    return ui.note?.getValue() || undefined;
}

/**
 * Update movement speed display based on current terrain + flora + groundwater
 */
export function updateMovementSpeedDisplay(ui: InspectorUI): void {
    if (!ui.movementSpeed) return;

    const terrainValue = getTerrainFromUI(ui);
    const floraValue = getFloraFromUI(ui);
    const groundwaterValue = getGroundwaterFromUI(ui);

    if (!terrainValue && !floraValue) {
        ui.movementSpeed.textContent = "—";
        return;
    }

    const speed = getMovementSpeed(
        terrainValue as TerrainType | undefined,
        floraValue as FloraType | undefined,
        groundwaterValue
    );

    // Show wet terrain warning if groundwater is high
    const wetWarning = groundwaterValue !== undefined && groundwaterValue > 0.5
        ? " ⚠️ Nasses Gelände"
        : "";

    ui.movementSpeed.textContent = `${(speed * 100).toFixed(0)}% (${speed.toFixed(2)}x)${wetWarning}`;
}

/**
 * Update manual edit flag indicator
 */
export function updateManualEditFlag(ui: InspectorUI, isManualEdit: boolean): void {
    if (!ui.manualEditFlag) return;

    ui.manualEditFlag.empty();

    if (isManualEdit) {
        const indicator = ui.manualEditFlag.createDiv({ cls: "sm-cartographer__manual-edit-badge" });
        indicator.createSpan({ text: "🔒", cls: "sm-cartographer__manual-edit-icon" });
        indicator.createSpan({ text: "Manual Edit (protected)", cls: "sm-cartographer__manual-edit-text" });
    }
}

/**
 * Reset all UI inputs to empty/disabled state
 */
export function resetAllInputs(ui: InspectorUI): void {
    const emptyValue = "";
    const emptyElevation = undefined;
    const emptyGroundwater = undefined;
    const disabledState = true;

    bindTerrainToUI(ui, emptyValue, disabledState);
    bindFloraToUI(ui, emptyValue, disabledState);
    bindBackgroundColorToUI(ui, emptyValue, disabledState);
    bindRegionToUI(ui, emptyValue, disabledState);
    bindFactionToUI(ui, emptyValue, disabledState);
    bindElevationToUI(ui, emptyElevation, disabledState);
    bindGroundwaterToUI(ui, emptyGroundwater, disabledState);
    bindNoteToUI(ui, emptyValue, disabledState);
    updateMovementSpeedDisplay(ui);
    updateManualEditFlag(ui, false);

    // Clear info sections
    if (ui.climateInfo) {
        ui.climateInfo.empty();
    }
    if (ui.weatherInfo) {
        ui.weatherInfo.empty();
    }
    if (ui.featuresInfo) {
        ui.featuresInfo.empty();
    }
    if (ui.locationInfo) {
        ui.locationInfo.empty();
    }
}
