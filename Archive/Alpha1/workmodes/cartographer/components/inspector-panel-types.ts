// src/workmodes/cartographer/components/inspector-panel-types.ts
// Type definitions and constants for Inspector Panel

import type { App, TFile } from "obsidian";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type {
    FormBuilderInstance,
    FormSelectHandle,
    FormSliderHandle,
    FormStatusHandle,
    FormTextareaHandle,
} from "@ui/components/form-builder";
import type { LocationType } from "../../library/locations/location-types";
import type { AxialCoord } from "../contracts/controller-interfaces";

/**
 * Extended handle for Inspector Panel with additional public methods
 * for direct access (beyond ToolPanelHandle interface)
 */
export interface InspectorPanelHandle {
    /** Activate panel (enable UI) */
    activate(): void;

    /** Deactivate panel (disable UI) */
    deactivate(): void;

    /** Cleanup and destroy panel */
    destroy(): void;

    /** Update when hex is clicked */
    setSelection(coord: AxialCoord | null): Promise<void>;

    /** Update when map file changes */
    setFile(file: TFile | null, handles: RenderHandles | null): Promise<void>;
}

/**
 * All UI element references in the inspector panel
 */
export interface InspectorUI {
    root: HTMLElement;
    header: HTMLElement;
    body: HTMLElement;
    form: FormBuilderInstance<
        | "file"
        | "terrain"
        | "flora"
        | "backgroundColor"
        | "movementSpeed"
        | "region"
        | "faction"
        | "manualEditFlag"
        | "elevation"
        | "groundwater"
        | "climateInfo"
        | "note"
        | "weather"
        | "features"
        | "location"
        | "weatherControls",
        never,
        never,
        "message"
    > | null;
    fileLabel: HTMLElement | null;
    message: FormStatusHandle | null;
    terrain: FormSelectHandle | null;
    flora: FormSelectHandle | null;
    backgroundColor: HTMLInputElement | null;
    movementSpeed: HTMLElement | null;
    region: FormSelectHandle | null;
    faction: FormSelectHandle | null;
    manualEditFlag: HTMLElement | null;
    elevation: FormSliderHandle | null;
    groundwater: FormSliderHandle | null;
    climateInfo: HTMLElement | null;
    note: FormTextareaHandle | null;
    weatherInfo: HTMLElement | null;
    featuresInfo: HTMLElement | null;
    locationInfo: HTMLElement | null;
    weatherControlsSection: HTMLElement | null;
}

/**
 * Internal state tracking for the inspector panel
 */
export interface InspectorState {
    app: App;
    file: TFile | null;
    handles: RenderHandles | null;
    selection: AxialCoord | null;
    saveTimer: number | null;
}

/**
 * Weather emoji mapping (same as weather-overlay-layer)
 */
export const WEATHER_ICONS: Record<string, string> = {
    clear: "☀️",
    cloudy: "☁️",
    rain: "🌧️",
    storm: "⚡",
    snow: "❄️",
    fog: "🌫️",
    wind: "💨",
    hot: "🔥",
    cold: "🧊",
};

/**
 * Influence radius configuration by location type
 */
export const INFLUENCE_RADIUS: Record<LocationType, number> = {
    "Stadt": 8,
    "Dorf": 5,
    "Weiler": 3,
    "Gebäude": 1,
    "Dungeon": 4,
    "Camp": 3,
    "Landmark": 6,
    "Ruine": 4,
    "Festung": 7,
};

/**
 * Type-safe UI references for Weather Controls section
 * Replaces fragile (ui.weatherControlsSection as any)._property pattern
 */
export interface WeatherControlsUI {
    section: HTMLElement;
    seasonSelect: HTMLSelectElement;
    dayInput: HTMLInputElement;
    weatherIcon: HTMLElement;
    weatherType: HTMLElement;
    weatherTemp: HTMLElement;
    regenerateAllBtn: HTMLButtonElement;
    regenerateHexBtn: HTMLButtonElement;
}
