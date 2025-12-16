// src/workmodes/cartographer/components/inspector-panel-data.ts
// Data operations and state management for Inspector Panel

import { Notice, TFile, type App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-inspector-panel-data");
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";
import { BUILDING_TEMPLATES } from "@features/locations/building-production";
import { loadRegions } from "@features/maps/data/region-repository";
import { loadTile, saveTile } from "@features/maps/data/tile-repository";
import type { TileData } from "@domain";
import {
    getLocationInfluenceStore,
    getLocationMarkerStore,
    getTerrainFeatureStore,
    getWeatherOverlayStore,
} from "@features/maps";
import { isBuildingLocation } from "@features/locations";
import { LIBRARY_DATA_SOURCES } from "@services/orchestration";
import { BuildingManagementModal } from "../building-management-modal";
import * as bindings from "./inspector-panel-bindings";
import type { InspectorUI, InspectorState } from "./inspector-panel-types";
import type { LocationData } from "../../library/locations/location-types";
import type { AxialCoord, ToolPanelContext } from "../contracts/controller-interfaces";
import {
    getClimateEngine,
    getPhaseAbbrev,
    PHASES_IN_ORDER,
    type DiurnalPhase,
    calculateRainShadow,
    formatRainShadowResult,
} from "@services/climate";

/**
 * Create climate info display section showing terrain-derived climate data
 */
export function updateClimateInfo(
    ui: InspectorUI,
    ctx: ToolPanelContext | undefined,
    tile: TileData | undefined,
    dayOfYear: number = 180 // Default to mid-summer if not provided
): void {
    if (!ui.climateInfo) return;

    ui.climateInfo.empty();

    const section = ui.climateInfo.createDiv({ cls: "sm-cartographer__climate-section" });

    // Header with edit button
    const header = section.createDiv({ cls: "sm-cartographer__climate-header" });
    header.createEl("h4", { text: "Klima (berechnet)", cls: "sm-cartographer__info-header" });

    // Add "Edit Climate" button
    const editButton = header.createEl("button", {
        text: "🌡️ Temp-Offset",
        cls: "sm-cartographer__climate-edit-button"
    });
    editButton.title = "Open Climate Brush tool to edit temperature offset";
    editButton.addEventListener("click", async () => {
        if (ctx?.switchTool) {
            await ctx.switchTool("climate-brush");
            logger.info("Switched to climate-brush tool");
        } else {
            logger.warn("Context switchTool not available");
        }
    });

    // Check if tile has terrain data to calculate climate
    if (!tile || (!tile.terrain && !tile.moisture)) {
        const emptyDiv = section.createDiv({ cls: "sm-cartographer__info-empty" });
        emptyDiv.createSpan({ text: "Keine Terrain-Daten für Klima-Berechnung. " });
        emptyDiv.createSpan({
            text: "Füge Terrain und Moisture hinzu, um Klima anzuzeigen.",
            cls: "sm-cartographer__hint-text"
        });
        return;
    }

    const engine = getClimateEngine();

    // Get climate breakdown
    const breakdown = engine.formatClimateBreakdown(tile, dayOfYear);
    const dailyTemps = engine.getDailyTemperatures(tile, dayOfYear);

    // Display base temperature and amplitude
    const summaryDiv = section.createDiv({ cls: "sm-cartographer__climate-summary" });

    const baseTempDiv = summaryDiv.createDiv({ cls: "sm-cartographer__climate-row" });
    baseTempDiv.createSpan({ text: "Basis-Temperatur:", cls: "sm-cartographer__climate-label" });
    baseTempDiv.createSpan({
        text: `${breakdown.baseTemp.toFixed(0)}°C`,
        cls: "sm-cartographer__climate-value sm-cartographer__climate-value--highlight"
    });

    const amplitudeDiv = summaryDiv.createDiv({ cls: "sm-cartographer__climate-row" });
    amplitudeDiv.createSpan({ text: "Amplitude:", cls: "sm-cartographer__climate-label" });
    amplitudeDiv.createSpan({
        text: `${breakdown.amplitude.toFixed(0)}°C`,
        cls: "sm-cartographer__climate-value sm-cartographer__climate-value--highlight"
    });

    // Sources section
    const sourcesDiv = section.createDiv({ cls: "sm-cartographer__climate-sources" });
    sourcesDiv.createEl("h5", { text: "Quellen:", cls: "sm-cartographer__climate-sources-header" });

    const sourcesList = sourcesDiv.createDiv({ cls: "sm-cartographer__climate-sources-list" });

    // Display amplitude sources
    for (const line of breakdown.amplitudeLines) {
        const sourceItem = sourcesList.createDiv({ cls: "sm-cartographer__climate-source-item" });
        sourceItem.createSpan({ text: `• ${line}`, cls: "sm-cartographer__climate-source-text" });
    }

    // Display temperature sources
    for (const line of breakdown.temperatureLines) {
        const sourceItem = sourcesList.createDiv({ cls: "sm-cartographer__climate-source-item" });
        sourceItem.createSpan({ text: `• ${line}`, cls: "sm-cartographer__climate-source-text" });
    }

    // Display daily temperature curve
    const tempCurveDiv = section.createDiv({ cls: "sm-cartographer__climate-temp-curve" });
    tempCurveDiv.createEl("h5", { text: "Tagestemperaturen:", cls: "sm-cartographer__climate-curve-header" });

    const tempGrid = tempCurveDiv.createDiv({ cls: "sm-cartographer__climate-temp-grid" });

    // Display temperatures for each phase in a compact grid (3 columns x 2 rows)
    const phaseGroups = [
        ["dawn", "morning", "midday"] as DiurnalPhase[],
        ["afternoon", "evening", "night"] as DiurnalPhase[]
    ];

    for (const group of phaseGroups) {
        const rowDiv = tempGrid.createDiv({ cls: "sm-cartographer__climate-temp-row" });
        for (const phase of group) {
            const temp = dailyTemps[phase];
            const phaseDiv = rowDiv.createDiv({ cls: "sm-cartographer__climate-temp-phase" });
            phaseDiv.createSpan({
                text: `${getPhaseAbbrev(phase)}:`,
                cls: "sm-cartographer__climate-phase-label"
            });
            phaseDiv.createSpan({
                text: `${temp.toFixed(0)}°C`,
                cls: "sm-cartographer__climate-phase-temp"
            });
        }
    }

    // Rain shadow calculation (if wind direction available)
    const windDirection = 270; // Default to West wind

    // For rain shadow, we need elevation lookup. Since we don't have full map data here,
    // we'll show a placeholder or skip it. A full implementation would need map context.
    // For now, we'll add a comment about rain shadow but not calculate it without map data.

    const rainShadowDiv = section.createDiv({ cls: "sm-cartographer__climate-rain-shadow" });
    if (tile.elevation && tile.elevation >= 1500) {
        rainShadowDiv.createSpan({
            text: "⛰️ Berg (kann Regenschatten erzeugen)",
            cls: "sm-cartographer__climate-hint-text"
        });
    }

    // Editable temperature offset
    const offsetDiv = section.createDiv({ cls: "sm-cartographer__climate-offset" });
    offsetDiv.createSpan({ text: "Temp-Offset:", cls: "sm-cartographer__climate-label" });

    const currentOffset = tile.climate?.temperatureOffset ?? 0;
    offsetDiv.createSpan({
        text: `${currentOffset > 0 ? '+' : ''}${currentOffset}°C`,
        cls: "sm-cartographer__climate-value"
    });

    // Note about editing
    const hintDiv = section.createDiv({ cls: "sm-cartographer__climate-hint" });
    hintDiv.createSpan({
        text: "💡 Verwende den Temp-Offset Button, um die Temperatur anzupassen.",
        cls: "sm-cartographer__climate-hint-text"
    });
}

/**
 * Load region and faction options
 */
export async function loadOptions(app: App, ui: InspectorUI): Promise<void> {
    // Load region options
    try {
        const regions = await loadRegions(app);
        ui.region?.setOptions([
            { label: "(none)", value: "" },
            ...regions.map((r) => ({
                label: r.name || "(unnamed)",
                value: r.name ?? "",
            })),
        ]);
    } catch (err) {
        logger.error("failed to load regions", err);
    }

    // Load faction options
    try {
        const factionFiles = await LIBRARY_DATA_SOURCES.factions.list(app);
        const factions: Array<{ name: string }> = [];
        for (const file of factionFiles) {
            try {
                const entry = await LIBRARY_DATA_SOURCES.factions.load(app, file);
                factions.push({ name: entry.name });
            } catch (err) {
                logger.warn(`[inspector-panel] failed to load faction ${file.path}`, err);
            }
        }
        ui.faction?.setOptions([
            { label: "(none)", value: "" },
            ...factions.map((f) => ({
                label: f.name || "(unnamed)",
                value: f.name ?? "",
            })),
        ]);
    } catch (err) {
        logger.error("failed to load factions", err);
    }
}

/**
 * Load weather info display
 */
export async function loadWeatherInfo(
    app: App,
    ui: InspectorUI,
    file: TFile,
    selection: AxialCoord,
    WEATHER_ICONS: Record<string, string>
): Promise<void> {
    if (!ui.weatherInfo) return;

    ui.weatherInfo.empty();

    try {
        const weatherStore = getWeatherOverlayStore(app, file);
        const weather = weatherStore.get(selection);

        if (weather) {
            const section = ui.weatherInfo.createDiv({ cls: "sm-cartographer__weather-section" });
            section.createEl("h4", { text: "Weather", cls: "sm-cartographer__weather-header" });

            const info = section.createDiv({ cls: "sm-cartographer__weather-details" });

            // Weather emoji and type
            const weatherLine = info.createDiv({ cls: "sm-cartographer__weather-type" });
            const emoji = WEATHER_ICONS[weather.weatherType] || "☁️";
            weatherLine.createSpan({ text: `${emoji} ${weather.weatherType}`, cls: "sm-cartographer__weather-type-text" });

            // Severity
            const severityPercent = Math.round(weather.severity * 100);
            info.createDiv({
                text: `Severity: ${severityPercent}%`,
                cls: "sm-cartographer__weather-severity"
            });

            // Temperature
            const tempF = Math.round(weather.temperature * 9/5 + 32);
            info.createDiv({
                text: `Temperature: ${Math.round(weather.temperature)}°C / ${tempF}°F`,
                cls: "sm-cartographer__weather-temperature"
            });

            // Last updated
            if (weather.lastUpdate) {
                const lastUpdate = new Date(weather.lastUpdate);
                const formattedDate = lastUpdate.toLocaleDateString();
                const formattedTime = lastUpdate.toLocaleTimeString();
                info.createDiv({
                    text: `Last Updated: ${formattedDate} ${formattedTime}`,
                    cls: "sm-cartographer__weather-updated"
                });
            }
        }
    } catch (err) {
        logger.error("failed to load weather info", err);
    }
}

/**
 * Load feature info display
 */
export async function loadFeatureInfo(
    app: App,
    ui: InspectorUI,
    file: TFile,
    selection: AxialCoord
): Promise<void> {
    if (!ui.featuresInfo) return;

    ui.featuresInfo.empty();

    try {
        const featureStore = getTerrainFeatureStore(app, file);
        const features = featureStore.list();

        // Find all features that include this coordinate
        // Note: TerrainFeaturePath uses { r, c } format (row, column), not { q, r } (axial)
        const relevantFeatures = features.filter(f =>
            f.path.hexes?.some(h => h.r === selection.r && h.c === selection.q) ?? false
        );

        if (relevantFeatures.length > 0) {
            const section = ui.featuresInfo.createDiv({ cls: "sm-cartographer__features-section" });
            section.createEl("h4", { text: "Terrain Features", cls: "sm-cartographer__features-header" });

            const list = section.createDiv({ cls: "sm-cartographer__features-list" });

            for (const feature of relevantFeatures) {
                const featureEl = list.createDiv({ cls: "sm-cartographer__feature-item" });

                // Feature type with icon
                const typeIcons: Record<string, string> = {
                    river: "🌊",
                    cliff: "⛰️",
                    road: "🛤️",
                    border: "🚧",
                    "elevation-line": "📏",
                };
                const icon = typeIcons[feature.type] || "•";

                const header = featureEl.createDiv({ cls: "sm-cartographer__feature-header" });
                header.createSpan({ text: `${icon} ${feature.type}`, cls: "sm-cartographer__feature-type" });

                // Feature name (if available)
                if (feature.metadata?.name) {
                    featureEl.createDiv({
                        text: feature.metadata.name,
                        cls: "sm-cartographer__feature-name"
                    });
                }

                // Feature description (if available)
                if (feature.metadata?.description) {
                    featureEl.createDiv({
                        text: feature.metadata.description,
                        cls: "sm-cartographer__feature-description"
                    });
                }

                // Path length
                const hexCount = feature.path.hexes?.length ?? 0;
                featureEl.createDiv({
                    text: `Path: ${hexCount} hex${hexCount === 1 ? "" : "es"}`,
                    cls: "sm-cartographer__feature-path-length"
                });

                // Style info
                const styleInfo = featureEl.createDiv({ cls: "sm-cartographer__feature-style" });
                const colorSwatch = styleInfo.createSpan({ cls: "sm-cartographer__feature-color-swatch" });
                colorSwatch.style.backgroundColor = feature.style.color;
                colorSwatch.style.width = "12px";
                colorSwatch.style.height = "12px";
                colorSwatch.style.display = "inline-block";
                colorSwatch.style.marginRight = "4px";
                colorSwatch.style.border = "1px solid var(--background-modifier-border)";

                styleInfo.createSpan({
                    text: `Width: ${feature.style.width}px`,
                    cls: "sm-cartographer__feature-width"
                });
            }
        }
    } catch (err) {
        logger.error("failed to load feature info", err);
    }
}

/**
 * Load location info display
 *
 * @param cachedLocationData - Pre-loaded location data to avoid duplicate file reads
 */
export async function loadLocationInfo(
    app: App,
    ui: InspectorUI,
    file: TFile,
    selection: AxialCoord,
    INFLUENCE_RADIUS: Record<string, number>,
    cachedLocationData?: { locationFile: TFile; data: LocationData } | null
): Promise<void> {
    if (!ui.locationInfo) return;

    ui.locationInfo.empty();

    try {
        const markerStore = getLocationMarkerStore(app, file);
        const marker = markerStore.get(selection);

        // Use cached location data if available, otherwise load it
        let locationFile: TFile | null = cachedLocationData?.locationFile ?? null;
        let locationData: LocationData | null = cachedLocationData?.data ?? null;

        // Load location data only if not cached and marker exists
        if (!locationData && marker?.locationPath) {
            const file = app.vault.getAbstractFileByPath(marker.locationPath);
            if (file instanceof TFile) {
                locationFile = file;
                locationData = await readFrontmatter(app, file) as unknown as LocationData;
            }
        }

        if (marker && marker.locationPath) {
            // Show location marker info
            const section = ui.locationInfo.createDiv({ cls: "sm-cartographer__location-section" });
            section.createEl("h4", { text: "Location Marker", cls: "sm-cartographer__location-header" });

            const info = section.createDiv({ cls: "sm-cartographer__location-details" });
            const icon = info.createSpan({ cls: "sm-cartographer__location-icon" });
            icon.textContent = marker.icon || "📍";
            info.createSpan({ text: marker.locationName || "(unnamed)", cls: "sm-cartographer__location-name" });

            // Show coordinates
            info.createDiv({ text: `Coordinates: (${marker.coord.q}, ${marker.coord.r})`, cls: "sm-cartographer__location-coordinates" });

            // Use cached location data
            if (locationData) {
                if (locationData.type) {
                    info.createDiv({ text: `Type: ${locationData.type}`, cls: "sm-cartographer__location-type" });
                }

                if (locationData.parent) {
                    info.createDiv({ text: `Parent: ${locationData.parent}`, cls: "sm-cartographer__location-parent" });
                }

                if (locationData.owner_name) {
                    info.createDiv({ text: `Owner: ${locationData.owner_name} (${locationData.owner_type ?? "unknown"})`, cls: "sm-cartographer__location-owner" });
                }
            }

            const openBtn = section.createEl("button", { text: "Open in Library", cls: "sm-cartographer__location-open-btn" });
            openBtn.addEventListener("click", async () => {
                // Navigate directly to location file
                // locationPath is guaranteed to be defined here since we're inside if (marker && marker.locationPath)
                const navFile = app.vault.getAbstractFileByPath(marker.locationPath!);

                if (!navFile || !(navFile instanceof TFile)) {
                    new Notice(`Location file not found: ${marker.locationName}`);
                    logger.warn(`[inspector-panel] Location file not found for navigation: ${marker.locationName} (${marker.locationPath})`);
                    return;
                }

                // Open location in new leaf
                await (app.workspace as any).openLinkText(navFile.path, navFile.path, true);

                logger.info(`[inspector-panel] Navigated to location: ${marker.locationName} (${navFile.path})`);
            });
        }

        // Check for influence area
        const influenceStore = getLocationInfluenceStore(app, file);
        const influence = influenceStore.get(selection);

        if (influence) {
            const section = ui.locationInfo.createDiv({ cls: "sm-cartographer__influence-section" });
            section.createEl("h4", { text: "Influence Area", cls: "sm-cartographer__influence-header" });

            const info = section.createDiv({ cls: "sm-cartographer__influence-details" });
            info.createDiv({ text: `Location: ${influence.locationName}`, cls: "sm-cartographer__influence-location" });
            info.createDiv({ text: `Strength: ${Math.round(influence.strength * 100)}%`, cls: "sm-cartographer__influence-strength" });

            // Load influence location data only if different from marker location
            let influenceLocationData: LocationData | null = null;
            let influenceLocationFile: TFile | null = null;

            if (influence.locationPath === marker?.locationPath && locationData) {
                // Same location - reuse cached data
                influenceLocationData = locationData;
                influenceLocationFile = locationFile;
            } else if (influence.locationPath) {
                // Different location - need to load
                const infFile = app.vault.getAbstractFileByPath(influence.locationPath);
                if (infFile instanceof TFile) {
                    influenceLocationFile = infFile;
                    influenceLocationData = await readFrontmatter(app, infFile) as unknown as LocationData;
                }
            }

            // Show influence radius
            if (influenceLocationData?.type) {
                const radius = INFLUENCE_RADIUS[influenceLocationData.type] ?? 0;
                info.createDiv({ text: `Radius: ${radius} hexes`, cls: "sm-cartographer__influence-radius" });
            }

            if (influence.ownerName) {
                info.createDiv({ text: `Owner: ${influence.ownerName}`, cls: "sm-cartographer__influence-owner" });
            }

            // If it's a building location, show building details (using already loaded data)
            if (influenceLocationData && isBuildingLocation(influenceLocationData) && influenceLocationData.building_production) {
                const buildingSection = section.createDiv({ cls: "sm-cartographer__building-section" });
                buildingSection.createEl("h5", { text: "Building Details", cls: "sm-cartographer__building-header" });

                const building = influenceLocationData.building_production;
                const template = BUILDING_TEMPLATES[building.buildingType];

                if (template) {
                    const details = buildingSection.createDiv({ cls: "sm-cartographer__building-details" });

                    // Condition
                    const conditionClass =
                        building.condition >= 75 ? "good" :
                        building.condition >= 50 ? "warning" : "poor";
                    details.createDiv({
                        text: `${template.name}: ${building.condition}% condition`,
                        cls: `sm-cartographer__building-condition sm-cartographer__building-condition--${conditionClass}`
                    });

                    // Workers
                    details.createDiv({
                        text: `Workers: ${building.currentWorkers}/${template.maxWorkers}`,
                        cls: "sm-cartographer__building-workers"
                    });

                    // Maintenance
                    if (building.maintenanceOverdue > 0) {
                        details.createDiv({
                            text: `⚠️ Maintenance ${building.maintenanceOverdue} days overdue`,
                            cls: "sm-cartographer__building-maintenance-warning"
                        });
                    }

                    // Active jobs
                    const jobCount = building.activeJobs?.length || 0;
                    details.createDiv({
                        text: `Active Jobs: ${jobCount}`,
                        cls: "sm-cartographer__building-jobs"
                    });

                    // Production details
                    details.createDiv({
                        text: `Allowed Jobs: ${template.allowedJobs.join(", ")}`,
                        cls: "sm-cartographer__building-allowed-jobs"
                    });

                    details.createDiv({
                        text: `Production Efficiency: ${(template.productionMultiplier * 100).toFixed(0)}%`,
                        cls: "sm-cartographer__building-production"
                    });

                    // Bonuses
                    if (template.bonuses) {
                        const bonuses: string[] = [];
                        if (template.bonuses.qualityBonus) {
                            bonuses.push(`+${(template.bonuses.qualityBonus * 100).toFixed(0)}% Quality`);
                        }
                        if (template.bonuses.trainingSpeed) {
                            bonuses.push(`${(template.bonuses.trainingSpeed * 100).toFixed(0)}% Training Speed`);
                        }
                        if (template.bonuses.researchBonus) {
                            bonuses.push(`+${(template.bonuses.researchBonus * 100).toFixed(0)}% Research`);
                        }
                        if (bonuses.length > 0) {
                            details.createDiv({
                                text: `Bonuses: ${bonuses.join(", ")}`,
                                cls: "sm-cartographer__building-bonuses"
                            });
                        }
                    }

                    // Manage button - capture current data for modal
                    const capturedLocationFile = influenceLocationFile;
                    const capturedLocationData = influenceLocationData;
                    if (capturedLocationFile) {
                        const manageBtn = buildingSection.createEl("button", {
                            text: "Manage Building",
                            cls: "sm-cartographer__building-manage-btn"
                        });
                        manageBtn.addEventListener("click", () => {
                            const modal = new BuildingManagementModal(app, {
                                locationFile: capturedLocationFile,
                                locationData: capturedLocationData,
                                onSave: async (updatedData) => {
                                    logger.info("building updated, refreshing display");
                                    // Reload location info to show updated data (no cache - force fresh read)
                                    await loadLocationInfo(app, ui, file, selection, INFLUENCE_RADIUS);
                                },
                            });
                            modal.open();
                        });
                    }
                }
            }
        }
    } catch (err) {
        logger.error("failed to load location info", err);
    }
}

/**
 * Load tile data from disk and bind to UI
 *
 * Optimized to:
 * 1. Load tile data, marker, and stores in parallel
 * 2. Pre-load location file once for both marker and influence display
 * 3. Avoid sequential async cascades
 */
export async function loadSelection(
    app: App,
    ui: InspectorUI,
    state: InspectorState,
    ctx: ToolPanelContext | undefined,
    WEATHER_ICONS: Record<string, string>,
    INFLUENCE_RADIUS: Record<string, number>
): Promise<void> {
    if (!state.file || !state.selection) {
        bindings.resetAllInputs(ui);
        updateMessageDisplay(ui, state);
        return;
    }

    try {
        // Phase 1: Load all store data in parallel (fast, synchronous store access)
        const markerStore = getLocationMarkerStore(app, state.file);
        const marker = markerStore.get(state.selection);

        // Phase 2: Load tile data (async disk read)
        const data = await loadTile(app, state.file, state.selection);

        if (!data) {
            // Empty hex - enable for editing
            bindings.resetAllInputs(ui);
            bindings.bindTerrainToUI(ui, "", false);
            bindings.bindFloraToUI(ui, "", false);
            bindings.bindBackgroundColorToUI(ui, "", false);
            bindings.bindRegionToUI(ui, "", false);
            bindings.bindFactionToUI(ui, "", false);
            bindings.bindElevationToUI(ui, undefined, false);
            bindings.bindGroundwaterToUI(ui, undefined, false);
            bindings.bindNoteToUI(ui, "", false);
            bindings.updateMovementSpeedDisplay(ui);
            bindings.updateManualEditFlag(ui, false);

            updateMessageDisplay(ui, state);
            return;
        }

        // Bind data to UI (synchronous)
        bindings.bindTerrainToUI(ui, data.terrain ?? "", false);
        bindings.bindFloraToUI(ui, data.flora ?? "", false);
        bindings.bindBackgroundColorToUI(ui, data.backgroundColor ?? "", false);
        bindings.bindRegionToUI(ui, data.region ?? "", false);
        bindings.bindFactionToUI(ui, data.faction ?? "", false);
        bindings.bindElevationToUI(ui, data.elevation, false);
        bindings.bindGroundwaterToUI(ui, data.groundwater, false);
        bindings.bindNoteToUI(ui, data.note ?? "", false);
        bindings.updateMovementSpeedDisplay(ui);
        bindings.updateManualEditFlag(ui, data.manualFactionEdit ?? false);

        // Update climate info display (synchronous)
        // TODO: Get actual dayOfYear from Almanac/calendar context when available
        const dayOfYear = 180; // Default to mid-summer (day 180)
        updateClimateInfo(ui, ctx, data, dayOfYear);

        // Phase 3: Pre-load location data ONCE if marker exists (avoids duplicate reads in loadLocationInfo)
        let cachedLocationData: { locationFile: TFile; data: LocationData } | null = null;
        if (marker?.locationPath) {
            const locationFile = app.vault.getAbstractFileByPath(marker.locationPath);
            if (locationFile instanceof TFile) {
                const locationData = await readFrontmatter(app, locationFile) as unknown as LocationData;
                cachedLocationData = { locationFile, data: locationData };
            }
        }

        // Phase 4: Load weather, features, and location info in parallel
        // Note: These are now independent and can run concurrently
        await Promise.all([
            loadWeatherInfo(app, ui, state.file, state.selection, WEATHER_ICONS),
            loadFeatureInfo(app, ui, state.file, state.selection),
            loadLocationInfo(app, ui, state.file, state.selection, INFLUENCE_RADIUS, cachedLocationData),
        ]);

        updateMessageDisplay(ui, state);
    } catch (err) {
        logger.error("failed to load tile", err);
        ui.message?.set({ message: "Fehler beim Laden der Tile-Daten.", tone: "error" });
    }
}

/**
 * Save tile data to disk
 */
export async function saveSelection(
    app: App,
    ui: InspectorUI,
    state: InspectorState
): Promise<void> {
    if (!state.file || !state.selection) return;

    try {
        const data: TileData = {
            terrain: bindings.getTerrainFromUI(ui) as TileData["terrain"],
            flora: bindings.getFloraFromUI(ui) as TileData["flora"],
            backgroundColor: bindings.getBackgroundColorFromUI(ui),
            region: bindings.getRegionFromUI(ui),
            faction: bindings.getFactionFromUI(ui),
            elevation: bindings.getElevationFromUI(ui),
            groundwater: bindings.getGroundwaterFromUI(ui),
            note: bindings.getNoteFromUI(ui),
        };

        await saveTile(app, state.file, state.selection, data);
        logger.info("saved tile data", { coord: state.selection });
    } catch (err) {
        logger.error("failed to save tile", err);
    }
}

/**
 * Update message display based on current state
 */
export function updateMessageDisplay(ui: InspectorUI, state: InspectorState): void {
    if (!ui.message) return;

    if (!state.file) {
        ui.message.set({ message: "Keine Karte ausgewählt.", tone: "info" });
    } else if (!state.selection) {
        ui.message.set({ message: "Hex anklicken, um Daten anzuzeigen.", tone: "info" });
    } else {
        ui.message.set({ message: `Hex r${state.selection.q}, r${state.selection.r}`, tone: "info" });
    }
}

/**
 * Update file label display
 */
export function updateFileLabel(ui: InspectorUI, state: InspectorState): void {
    if (!ui.fileLabel) return;

    ui.fileLabel.empty();
    if (state.file) {
        ui.fileLabel.createSpan({ text: state.file.basename, cls: "sm-cartographer__file-name" });
    }
}
