// src/workmodes/cartographer/components/inspector-panel.ts
// Inspector Panel orchestrator - coordinates all sub-modules

import { type App, type TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-inspector-panel");
import { LifecycleManager } from "@services/app-lifecycle-manager";
import { getWeatherOverlayStore, type WeatherOverlayStore } from "@features/maps";

// Import types
import * as bindings from "./inspector-panel-bindings";
import * as data from "./inspector-panel-data";
import { WEATHER_ICONS, INFLUENCE_RADIUS } from "./inspector-panel-types";
import type { WeatherControlsUI } from "./inspector-panel-types";

// Import modules
import { createInspectorPanelUI, renderWeatherControls } from "./inspector-panel-ui";
import type { InspectorPanelHandle, InspectorState } from "./inspector-panel-types";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { ToolPanelContext } from "../editor/tool-panel.interface";

/**
 * Create a persistent inspector panel
 */
export function createInspectorPanel(
    app: App,
    container: HTMLElement,
    ctx?: ToolPanelContext
): InspectorPanelHandle {
    // Initialize UI
    const ui = createInspectorPanelUI(container, scheduleSave);

    // Initialize state
    const state: InspectorState = {
        app,
        file: null,
        handles: null,
        selection: null,
        saveTimer: null,
    };

    // Type-safe weather controls reference (replaces as any casting)
    let weatherControls: WeatherControlsUI | null = null;
    // Cached weather store (replaces repeated dynamic imports)
    let weatherStore: WeatherOverlayStore | null = null;

    // Lifecycle management for proper cleanup
    const lifecycle = new LifecycleManager();

    // Initial setup
    data.updateFileLabel(ui, state);
    data.updateMessageDisplay(ui, state);
    void data.loadOptions(app, ui);

    // Render weather controls section
    if (ui.weatherControlsSection) {
        weatherControls = renderWeatherControls(
            ui.weatherControlsSection,
            handleSeasonChange,
            handleDayChange,
            handleRegenerateAll,
            handleRegenerateHex
        );
    }

    // ==================== Helpers ====================

    function clearSaveTimer() {
        if (state.saveTimer !== null) {
            clearTimeout(state.saveTimer);
            state.saveTimer = null;
        }
    }

    function scheduleSave() {
        clearSaveTimer();
        const timer = setTimeout(() => {
            void data.saveSelection(app, ui, state);
        }, 250);
        state.saveTimer = timer;
        lifecycle.addTimer(timer);
    }

    async function handleSeasonChange(season: any, dayOfYear: number) {
        if (!state.file || !weatherStore || !weatherControls) return;

        try {
            // Show confirmation dialog
            const confirmed = confirm(
                `This will regenerate weather for all hexes with the new season (${season}). Continue?`
            );

            if (!confirmed) {
                // Revert select to previous value
                const storeState = weatherStore.state.get();
                weatherControls.seasonSelect.value = storeState.currentSeason;
                return;
            }

            await weatherStore.updateSeason(season, dayOfYear);

            logger.info("season updated", { season, dayOfYear });

            // Refresh displays
            await data.loadWeatherInfo(app, ui, state.file, state.selection!, WEATHER_ICONS);
            updateWeatherControlsDisplay();
        } catch (err) {
            logger.error("failed to update season", err);
        }
    }

    async function handleDayChange(season: any, dayOfYear: number) {
        if (!state.file || !weatherStore) return;

        try {
            await weatherStore.updateSeason(season, dayOfYear);

            logger.info("day of year updated", { season, dayOfYear });

            // Refresh displays
            await data.loadWeatherInfo(app, ui, state.file, state.selection!, WEATHER_ICONS);
            updateWeatherControlsDisplay();
        } catch (err) {
            logger.error("failed to update day of year", err);
        }
    }

    async function handleRegenerateAll(season: any, dayOfYear: number) {
        if (!state.file || !weatherStore) return;

        try {
            const confirmed = confirm(
                "This will regenerate weather for ALL hexes on the map. Continue?"
            );

            if (!confirmed) return;

            await weatherStore.updateSeason(season, dayOfYear);

            logger.info("regenerated all weather", { season, dayOfYear });

            // Refresh displays
            await data.loadWeatherInfo(app, ui, state.file, state.selection!, WEATHER_ICONS);
            updateWeatherControlsDisplay();
        } catch (err) {
            logger.error("failed to regenerate all weather", err);
        }
    }

    async function handleRegenerateHex() {
        if (!state.file || !state.selection || !weatherStore) return;

        try {
            await weatherStore.generateWeatherForHex(state.selection);

            logger.info("regenerated hex weather", { coord: state.selection });

            // Refresh displays
            await data.loadWeatherInfo(app, ui, state.file, state.selection, WEATHER_ICONS);
            updateWeatherControlsDisplay();
        } catch (err) {
            logger.error("failed to regenerate hex weather", err);
        }
    }

    function updateWeatherControlsDisplay() {
        if (!weatherControls || !weatherStore) return;

        try {
            // Get current state using standard store.get() method
            const storeState = weatherStore.state.get();

            // Update season and day from store
            weatherControls.seasonSelect.value = storeState.currentSeason;
            weatherControls.dayInput.value = String(storeState.currentDayOfYear);

            // Update current weather display if hex selected
            if (state.selection) {
                const weather = weatherStore.get(state.selection);

                if (weather) {
                    // Update icon
                    weatherControls.weatherIcon.textContent = WEATHER_ICONS[weather.weatherType] || "☁️";

                    // Update type and severity
                    const severityPercent = Math.round(weather.severity * 100);
                    weatherControls.weatherType.textContent = `${weather.weatherType.charAt(0).toUpperCase() + weather.weatherType.slice(1)} (Severity: ${severityPercent}%)`;

                    // Update temperature
                    weatherControls.weatherTemp.textContent = `Temperature: ${Math.round(weather.temperature)}°C`;
                } else {
                    // No weather data
                    weatherControls.weatherIcon.textContent = "❓";
                    weatherControls.weatherType.textContent = "No weather data";
                    weatherControls.weatherTemp.textContent = "Temperature: --°C";
                }

                // Enable buttons when hex selected
                weatherControls.regenerateAllBtn.disabled = false;
                weatherControls.regenerateHexBtn.disabled = false;
            } else {
                // No hex selected
                weatherControls.weatherIcon.textContent = "☁️";
                weatherControls.weatherType.textContent = "Select a hex";
                weatherControls.weatherTemp.textContent = "Temperature: --°C";

                // Disable hex-specific button, but allow regenerate all
                weatherControls.regenerateAllBtn.disabled = false;
                weatherControls.regenerateHexBtn.disabled = true;
            }
        } catch (err) {
            logger.error("failed to update weather controls display", err);
        }
    }

    // Public API (ToolPanelHandle + Inspector-specific)
    return {
        activate() {
            logger.info("activated");
            ui.root.classList.remove("is-disabled");
        },

        deactivate() {
            logger.info("deactivated");
            ui.root.classList.add("is-disabled");
        },

        destroy() {
            clearSaveTimer();
            lifecycle.cleanup();
            ui.form?.destroy();
            ui.root.remove();
        },

        async setSelection(coord: any) {
            state.selection = coord;
            clearSaveTimer();

            if (coord) {
                await data.loadSelection(app, ui, state, ctx, WEATHER_ICONS, INFLUENCE_RADIUS);
                await updateWeatherControlsDisplay();
            } else {
                bindings.resetAllInputs(ui);
                data.updateMessageDisplay(ui, state);
                await updateWeatherControlsDisplay();
            }
        },

        async setFile(file: TFile | null, handles: RenderHandles | null) {
            state.file = file;
            state.handles = handles;
            clearSaveTimer();
            bindings.resetAllInputs(ui);
            data.updateFileLabel(ui, state);
            data.updateMessageDisplay(ui, state);

            // Update cached weather store for new file
            weatherStore = file ? getWeatherOverlayStore(app, file) : null;

            // Re-render weather controls for new file
            if (ui.weatherControlsSection) {
                weatherControls = renderWeatherControls(
                    ui.weatherControlsSection,
                    handleSeasonChange,
                    handleDayChange,
                    handleRegenerateAll,
                    handleRegenerateHex
                );
            }
            updateWeatherControlsDisplay();

            if (state.selection && file && handles) {
                await data.loadSelection(app, ui, state, ctx, WEATHER_ICONS, INFLUENCE_RADIUS);
            }
        },
    };
}
