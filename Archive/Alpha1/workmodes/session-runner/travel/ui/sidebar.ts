// src/workmodes/session-runner/travel/ui/sidebar.ts
// Sidebar-Layout und Steuerung für Travel-Modus.
import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-travel-sidebar");
import { createEventsCards } from "../../calendar/events-cards";
import { createCurrentHexCard, type HexInfo } from "./current-hex-card";
import { createPartySettingsCard } from "./party-settings-card";
import { createTravelControls } from "./travel-controls";
import { createWeatherPanel } from "./weather-panel";
import type { TravelControlCallbacks } from './calendar-types';
import type { WeatherState } from "@features/weather/weather-types";
import type { WeatherHistoryEntry, WeatherForecast } from "@features/weather/weather-store";
import type { CalendarStateGateway } from "@services/orchestration";
import type { CalendarTimestamp } from "@domain";
import type { LogicStateSnapshot } from "../engine/travel-engine-types";

export type Sidebar = {
    root: HTMLElement;
    gateway: CalendarStateGateway;
    travelId: string | null;
    setTitle?: (title: string) => void;
    setWeather(weather: WeatherState | null): void;
    setWeatherHistory(history: WeatherHistoryEntry[]): void;
    setWeatherForecast(forecast: WeatherForecast[]): void;
    setWeatherPlaceholder(message: string): void;
    setCurrentHex(data: HexInfo | null): void;
    setTimestamp(timestamp: CalendarTimestamp | null): void;
    setPlaybackState(state: Pick<LogicStateSnapshot, "playing" | "route" | "tokenCoord">): void;
    setCurrentTime(timestamp: CalendarTimestamp | null): void;
    setTempo(tempo: number): void;
    setSpeed(v: number): void;
    setSpeedCalculation(data: { terrain?: string; terrainMod?: number; flora?: string; floraMod?: number; combined?: number; hoursPerHex?: number }): void;
    onSpeedChange(fn: (v: number) => void): void;
    refreshCalendar(): Promise<void>;
    refreshEvents(): Promise<void>;
    destroy(): void;
};

export function createSidebar(
    leftHost: HTMLElement,
    rightHost: HTMLElement,
    app: App,
    gateway: CalendarStateGateway,
    travelId: string | null,
    onOpenAlmanac: () => void,
    callbacks: TravelControlCallbacks,
): Sidebar {
    leftHost.empty();
    rightHost.empty();

    // Add sidebar class (parent already has sm-session-runner)
    leftHost.addClass("sm-session__sidebar");
    rightHost.addClass("sm-session__sidebar");

    // ══════════════════════════════════════════════════════════════════
    // LEFT SIDEBAR: Travel Controls + Audio + Party
    // ══════════════════════════════════════════════════════════════════
    const leftRoot = leftHost;

    // 1. Travel Control Card
    const travelCard = leftRoot.createDiv({ cls: "sm-panel-card is-expanded" });
    const travelHeader = travelCard.createDiv({ cls: "sm-panel-card__header" });
    travelHeader.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    travelHeader.createDiv({ cls: "sm-panel-card__title", text: "Travel Controls" });
    const travelBody = travelCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle travel card
    travelHeader.addEventListener("click", () => {
        if (travelCard.hasClass("is-expanded")) {
            travelCard.removeClass("is-expanded");
            travelCard.addClass("is-collapsed");
        } else {
            travelCard.removeClass("is-collapsed");
            travelCard.addClass("is-expanded");
        }
    });

    let speedChangeCallback: (v: number) => void = () => {};

    const travelControls = createTravelControls({
        host: travelBody,
        app,
        gateway,
        callbacks: {
            ...callbacks,
            onSpeedChange: (speed) => {
                // Update weather panel when speed changes
                weatherPanel.setBaseSpeed(speed);
                speedChangeCallback(speed);
                callbacks.onSpeedChange?.(speed);
            },
        },
    });

    // 2. Container for audio and encounter panels (will be added dynamically)
    const actionsContainer = leftRoot.createDiv({ cls: "sm-session__actions-container sm-audio-panel" });

    // 3. Party Settings Card (below audio)
    const partySettingsCard = createPartySettingsCard(leftRoot);

    // ══════════════════════════════════════════════════════════════════
    // RIGHT SIDEBAR: Weather + Events
    // ══════════════════════════════════════════════════════════════════
    const rightRoot = rightHost;

    // 1. Weather Panel Card
    const weatherCard = rightRoot.createDiv({ cls: "sm-panel-card is-expanded" });
    const weatherHeader = weatherCard.createDiv({ cls: "sm-panel-card__header" });
    weatherHeader.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    weatherHeader.createDiv({ cls: "sm-panel-card__title", text: "Wetter" });
    const weatherBody = weatherCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle weather card
    weatherHeader.addEventListener("click", () => {
        if (weatherCard.hasClass("is-expanded")) {
            weatherCard.removeClass("is-expanded");
            weatherCard.addClass("is-collapsed");
        } else {
            weatherCard.removeClass("is-collapsed");
            weatherCard.addClass("is-expanded");
        }
    });

    const weatherPanel = createWeatherPanel(weatherBody);

    // 2. Current Hex Card
    const currentHexCard = rightRoot.createDiv({ cls: "sm-panel-card is-expanded" });
    const hexHeader = currentHexCard.createDiv({ cls: "sm-panel-card__header" });
    hexHeader.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    hexHeader.createDiv({ cls: "sm-panel-card__title", text: "Aktuelles Hex" });
    const hexBody = currentHexCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle current hex card
    hexHeader.addEventListener("click", () => {
        if (currentHexCard.hasClass("is-expanded")) {
            currentHexCard.removeClass("is-expanded");
            currentHexCard.addClass("is-collapsed");
        } else {
            currentHexCard.removeClass("is-collapsed");
            currentHexCard.addClass("is-expanded");
        }
    });

    const hexCardPanel = createCurrentHexCard(hexBody);

    // 3. Events Cards (Current + Upcoming)
    const eventsCards = createEventsCards({
        host: rightRoot,
        app,
        gateway,
        travelId,
        onOpenAlmanac,
    });

    // ══════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════

    const setTitle = (title: string) => {
        if (title && title.trim().length > 0) {
            leftHost.dataset.mapTitle = title;
        } else {
            delete leftHost.dataset.mapTitle;
        }
    };

    return {
        root: actionsContainer, // Container for audio/encounter panels
        gateway,
        travelId,
        setTitle,
        setWeather: (weather: WeatherState | null) => {
            weatherPanel.setWeather(weather);
        },
        setWeatherHistory: (history: WeatherHistoryEntry[]) => {
            weatherPanel.setHistory(history);
        },
        setWeatherForecast: (forecast: WeatherForecast[]) => {
            weatherPanel.setForecast(forecast);
        },
        setWeatherPlaceholder: (message: string) => {
            weatherPanel.setPlaceholder(message);
        },
        setCurrentHex: (data: HexInfo | null) => {
            hexCardPanel.setHexData(data);
        },
        setTimestamp: (timestamp) => {
            travelControls.setTimestamp(timestamp);
        },
        setPlaybackState: (state) => {
            travelControls.setPlaybackState(state);
        },
        setCurrentTime: (timestamp) => {
            travelControls.setCurrentTime(timestamp);
        },
        setTempo: (tempo) => {
            travelControls.setTempo(tempo);
        },
        setSpeed: (v: number) => {
            travelControls.setSpeed(v);
            weatherPanel.setBaseSpeed(v);
        },
        setSpeedCalculation: (data) => {
            travelControls.setSpeedCalculation(data);
            hexCardPanel.setSpeedCalculation(data);
        },
        onSpeedChange: (fn) => {
            speedChangeCallback = fn;
        },
        refreshCalendar: async () => {
            logger.info("[sidebar] refreshCalendar called");
            await travelControls.refresh();
            logger.info("[sidebar] travelControls.refresh completed");
        },
        refreshEvents: async () => {
            await eventsCards.refresh();
        },
        destroy: () => {
            travelControls.destroy();
            eventsCards.destroy();
            weatherPanel.destroy();
            hexCardPanel.destroy();
            partySettingsCard.destroy();
            // Clear DOM (automatically removes event listeners)
            leftHost.empty();
            rightHost.empty();
            delete leftHost.dataset.mapTitle;
        },
    };
}
