// src/workmodes/cartographer/components/inspector-panel-ui.ts
// UI creation and rendering logic for Inspector Panel

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-inspector-panel-ui");
import {
    TERRAIN_ICONS,
    FLORA_ICONS,
    type TerrainType,
    type FloraType,
} from "@features/maps/config/terrain";
import {
    buildForm,
} from "@ui/components/form-builder";
import { enhanceSelectToSearch } from "@ui/components/search-dropdown";
import type { InspectorUI, WeatherControlsUI } from "./inspector-panel-types";
import type { Season } from "@features/weather/weather-types";

/**
 * Create the inspector panel UI structure and return all element references
 */
export function createInspectorPanelUI(
    container: HTMLElement,
    onScheduleSave: () => void
): InspectorUI {
    // Use container directly as root (no wrapper div)
    const root = container;
    root.classList.add("sm-cartographer__tool-panel", "is-disabled");

    const header = root.createDiv({ cls: "sm-cartographer__inspector-header" });
    header.createSpan({ cls: "sm-cartographer__inspector-title", text: "Inspector" });

    const body = root.createDiv({ cls: "sm-cartographer__inspector-body" });

    const ui: InspectorUI = {
        root,
        header,
        body,
        form: null,
        fileLabel: null,
        message: null,
        terrain: null,
        flora: null,
        backgroundColor: null,
        movementSpeed: null,
        region: null,
        faction: null,
        manualEditFlag: null,
        elevation: null,
        groundwater: null,
        climateInfo: null,
        note: null,
        weatherInfo: null,
        featuresInfo: null,
        locationInfo: null,
        weatherControlsSection: null,
    };

    // Build form UI
    ui.form = buildForm(body, {
        sections: [
            { kind: "static", id: "file", cls: "sm-cartographer__panel-file" },
            { kind: "status", id: "message", cls: "sm-cartographer__panel-info" },
            {
                kind: "row",
                label: "Terrain Type:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "terrain",
                        options: [
                            { value: "", label: "(none)" },
                            ...Object.keys(TERRAIN_ICONS).map((key) => ({
                                value: key,
                                label: `${TERRAIN_ICONS[key as TerrainType].emoji} ${TERRAIN_ICONS[key as TerrainType].label}`,
                            }))
                        ],
                        disabled: true,
                        enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                        onChange: () => {
                            onScheduleSave();
                        },
                    },
                ],
            },
            {
                kind: "row",
                label: "Flora Type:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "flora",
                        options: [
                            { value: "", label: "(none)" },
                            ...Object.keys(FLORA_ICONS).map((key) => ({
                                value: key,
                                label: `${FLORA_ICONS[key as FloraType].emoji} ${FLORA_ICONS[key as FloraType].label}`,
                            }))
                        ],
                        disabled: true,
                        enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                        onChange: () => {
                            onScheduleSave();
                        },
                    },
                ],
            },
            { kind: "static", id: "backgroundColor", cls: "sm-cartographer__background-color-row" },
            { kind: "static", id: "movementSpeed", cls: "sm-cartographer__movement-speed-row" },
            { kind: "separator" },
            {
                kind: "row",
                label: "Region:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "region",
                        options: [],
                        disabled: true,
                        enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                        onChange: () => onScheduleSave(),
                    },
                ],
            },
            {
                kind: "row",
                label: "Faction:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "faction",
                        options: [],
                        disabled: true,
                        enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                        onChange: () => onScheduleSave(),
                    },
                ],
            },
            { kind: "static", id: "manualEditFlag", cls: "sm-cartographer__manual-edit-flag" },
            {
                kind: "row",
                label: "Elevation (-100m to +5000m):",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "slider",
                        id: "elevation",
                        value: 0,
                        min: -100,
                        max: 5000,
                        step: 10,
                        showValue: true,
                        disabled: true,
                        onChange: () => onScheduleSave(),
                    },
                ],
            },
            {
                kind: "row",
                label: "Groundwater (0.0-1.0):",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "slider",
                        id: "groundwater",
                        value: 0,
                        min: 0,
                        max: 1,
                        step: 0.05,
                        showValue: true,
                        disabled: true,
                        onChange: () => {
                            onScheduleSave();
                        },
                    },
                ],
            },
            { kind: "separator" },
            { kind: "static", id: "climateInfo", cls: "sm-cartographer__climate-info" },
            { kind: "separator" },
            {
                kind: "row",
                label: "Notiz:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "textarea",
                        id: "note",
                        rows: 6,
                        disabled: true,
                        onInput: () => onScheduleSave(),
                    },
                ],
            },
            { kind: "separator" },
            { kind: "static", id: "weather", cls: "sm-cartographer__weather-info" },
            { kind: "separator" },
            { kind: "static", id: "weatherControls", cls: "sm-cartographer__weather-controls-container" },
            { kind: "separator" },
            { kind: "static", id: "features", cls: "sm-cartographer__features-info" },
            { kind: "separator" },
            { kind: "static", id: "location", cls: "sm-cartographer__location-info" },
        ],
    });

    ui.fileLabel = ui.form.getElement("file");
    ui.message = ui.form.getStatus("message");
    ui.terrain = ui.form.getControl("terrain") as any;
    ui.flora = ui.form.getControl("flora") as any;
    ui.region = ui.form.getControl("region") as any;
    ui.faction = ui.form.getControl("faction") as any;
    ui.elevation = ui.form.getControl("elevation") as any;
    ui.groundwater = ui.form.getControl("groundwater") as any;
    ui.note = ui.form.getControl("note") as any;
    ui.climateInfo = ui.form.getElement("climateInfo");
    ui.weatherInfo = ui.form.getElement("weather");
    ui.featuresInfo = ui.form.getElement("features");
    ui.locationInfo = ui.form.getElement("location");
    ui.weatherControlsSection = ui.form.getElement("weatherControls");

    // Render background color input
    const backgroundColorContainer = ui.form.getElement("backgroundColor");
    if (backgroundColorContainer) {
        backgroundColorContainer.empty();
        const row = backgroundColorContainer.createDiv({ cls: "sm-cartographer__panel-row" });
        row.createSpan({ text: "Background Color:", cls: "sm-cartographer__panel-label" });
        const input = row.createEl("input", { type: "color", cls: "sm-cartographer__color-input" });
        input.disabled = true;
        input.addEventListener("change", () => onScheduleSave());
        ui.backgroundColor = input;
    }

    // Render movement speed display
    const movementSpeedContainer = ui.form.getElement("movementSpeed");
    if (movementSpeedContainer) {
        movementSpeedContainer.empty();
        const row = movementSpeedContainer.createDiv({ cls: "sm-cartographer__panel-row" });
        row.createSpan({ text: "Movement Speed:", cls: "sm-cartographer__panel-label" });
        ui.movementSpeed = row.createSpan({ text: "—", cls: "sm-cartographer__movement-speed-value" });
    }

    // Render manual edit flag
    const manualEditFlagContainer = ui.form.getElement("manualEditFlag");
    if (manualEditFlagContainer) {
        manualEditFlagContainer.empty();
        ui.manualEditFlag = manualEditFlagContainer.createDiv({ cls: "sm-cartographer__manual-edit-indicator" });
    }

    // Diagnostic: Log which form controls were successfully created
    logger.info("Form controls created", {
        terrain: !!ui.terrain,
        flora: !!ui.flora,
        backgroundColor: !!ui.backgroundColor,
        movementSpeed: !!ui.movementSpeed,
        region: !!ui.region,
        faction: !!ui.faction,
        manualEditFlag: !!ui.manualEditFlag,
        elevation: !!ui.elevation,
        groundwater: !!ui.groundwater,
        note: !!ui.note,
    });

    return ui;
}

/**
 * Render the Weather Controls section
 * Returns typed UI references instead of storing them via 'as any' casting
 */
export function renderWeatherControls(
    container: HTMLElement,
    onSeasonChange: (season: Season, dayOfYear: number) => Promise<void>,
    onDayChange: (season: Season, dayOfYear: number) => Promise<void>,
    onRegenerateAll: (season: Season, dayOfYear: number) => Promise<void>,
    onRegenerateHex: () => Promise<void>
): WeatherControlsUI {
    container.empty();

    // Create collapsible section
    const section = container.createDiv({
        cls: "sm-inspector-section is-collapsible"
    });

    // Section header
    const header = section.createDiv({ cls: "sm-inspector-section__header" });
    const titleWrapper = header.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 8px;" }
    });
    const toggleIcon = titleWrapper.createSpan({
        cls: "sm-inspector-section__toggle-icon",
        text: "▼"
    });
    titleWrapper.createSpan({
        cls: "sm-inspector-section__title",
        text: "Weather Controls"
    });

    // Section body
    const body = section.createDiv({ cls: "sm-inspector-section__body" });

    // Season dropdown
    const seasonRow = body.createDiv({ cls: "sm-form-row" });
    seasonRow.createDiv({ cls: "sm-form-label", text: "Season:" });
    const seasonSelect = seasonRow.createEl("select", { cls: "sm-form-control" });
    const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
    seasons.forEach(season => {
        seasonSelect.createEl("option", {
            value: season,
            text: season.charAt(0).toUpperCase() + season.slice(1)
        });
    });

    // Day of year input
    const dayRow = body.createDiv({ cls: "sm-form-row" });
    dayRow.createDiv({ cls: "sm-form-label", text: "Day of Year:" });
    const dayInputWrapper = dayRow.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 4px;" }
    });
    const dayInput = dayInputWrapper.createEl("input", {
        cls: "sm-form-control",
        type: "number",
        attr: { min: "1", max: "365", value: "1" }
    });
    dayInputWrapper.createSpan({ text: "/ 365" });

    // Current weather display
    const weatherDisplay = body.createDiv({ cls: "sm-weather-display" });
    weatherDisplay.createDiv({
        cls: "sm-form-label",
        text: "Current Weather (this hex):",
        attr: { style: "margin-bottom: 8px;" }
    });

    const weatherStatus = weatherDisplay.createDiv({
        cls: "sm-weather-status",
        attr: { style: "margin-bottom: 8px;" }
    });
    const weatherIcon = weatherStatus.createDiv({ cls: "sm-weather-status__icon" });
    weatherIcon.textContent = "☁️";

    const weatherDetails = weatherStatus.createDiv({ cls: "sm-weather-status__details" });
    const weatherType = weatherDetails.createDiv({ cls: "sm-weather-status__type" });
    weatherType.textContent = "Cloudy (Severity: 0%)";
    const weatherTemp = weatherDetails.createDiv({ cls: "sm-weather-status__temp" });
    weatherTemp.textContent = "Temperature: 0°C";

    // Action buttons
    const actions = body.createDiv({ cls: "sm-inspector-section__actions" });
    const regenerateAllBtn = actions.createEl("button", {
        cls: "sm-btn sm-btn--primary",
        text: "Regenerate All Weather"
    });
    const regenerateHexBtn = actions.createEl("button", {
        cls: "sm-btn sm-btn--secondary",
        text: "Regenerate This Hex"
    });

    // Initially disable buttons (enabled when hex selected)
    regenerateAllBtn.disabled = true;
    regenerateHexBtn.disabled = true;

    // Collapsible functionality
    header.addEventListener("click", () => {
        section.toggleClass("is-collapsed");
    });

    // Event handlers
    seasonSelect.addEventListener("change", async () => {
        await onSeasonChange(seasonSelect.value as Season, Number(dayInput.value));
    });

    dayInput.addEventListener("change", async () => {
        const day = Number(dayInput.value);
        if (day >= 1 && day <= 365) {
            await onDayChange(seasonSelect.value as Season, day);
        }
    });

    regenerateAllBtn.addEventListener("click", async () => {
        await onRegenerateAll(seasonSelect.value as Season, Number(dayInput.value));
    });

    regenerateHexBtn.addEventListener("click", async () => {
        await onRegenerateHex();
    });

    // Return typed UI references
    return {
        section,
        seasonSelect,
        dayInput,
        weatherIcon,
        weatherType,
        weatherTemp,
        regenerateAllBtn,
        regenerateHexBtn,
    };
}
