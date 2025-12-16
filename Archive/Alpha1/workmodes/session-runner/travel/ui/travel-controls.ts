// src/workmodes/session-runner/travel/ui/travel-controls.ts
// Consolidated travel control panel for Session Runner

import "../travel-controls.css";
import "../../calendar/calendar-panel.css";
import type { App } from "obsidian";
import { setIcon } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-travel-controls");
import { openDatePickerModal } from "../../calendar/date-picker-modal";
import { createTimeControls } from "../../calendar/time-controls";
import { createTimestampDisplay } from "../../calendar/timestamp-display";
import type { TravelControlCallbacks } from './calendar-types';
import type { CalendarStateGateway } from "@services/orchestration";
import type { CalendarTimestamp } from "@domain";
import type { LogicStateSnapshot } from "../engine/travel-engine-types";

export interface TravelControlsOptions {
    readonly host: HTMLElement;
    readonly app: App;
    readonly gateway: CalendarStateGateway;
    readonly callbacks: TravelControlCallbacks;
}

export interface TravelControlsHandle {
    readonly root: HTMLElement;
    setTimestamp(timestamp: CalendarTimestamp | null): void;
    setPlaybackState(state: Pick<LogicStateSnapshot, "playing" | "route" | "tokenCoord">): void;
    setCurrentTime(timestamp: CalendarTimestamp | null): void;
    setTempo(tempo: number): void;
    setSpeed(speed: number): void;
    setSpeedCalculation(data: { terrain?: string; terrainMod?: number; flora?: string; floraMod?: number; combined?: number; hoursPerHex?: number }): void;
    refresh(): Promise<void>;
    destroy(): void;
}

/**
 * Creates the consolidated travel control panel with unified visual style.
 *
 * Layout (flat hierarchy - no section wrappers):
 * ```
 * Card Body (direct children):
 * │ 📅 Year 1489, Day 15 of Flamerule       │ ← Timestamp Display
 * │    14:30 • afternoon                    │
 * │ ─────────────────────────────────────── │ ← Divider
 * │ [▶ Play] [⏹ Stop] [↻] [⚔️]  1.5 h/Hex   │ ← Playback Row w/ Duration
 * │ ─────────────────────────────────────── │ ← Divider
 * │ [1] [Days ▾] [▶ Advance] [📅 Jump]      │ ← Time Controls
 * │ ─────────────────────────────────────── │ ← Divider
 * │ ▾ Advanced                               │ ← Advanced Toggle
 * │ Tempo: x1.0 [====○====] (0.1x - 10x)    │ ← Advanced Content
 * │ Party Speed: [1.0] mph                   │   (collapsible)
 * ```
 *
 * Nesting: Left Panel > Card > Body > Content (no intermediate wrappers)
 *
 * Note: Detailed speed calculation (terrain/flora modifiers) is shown
 * in the "Aktuelles Hex" card in the right sidebar.
 */
export function createTravelControls(options: TravelControlsOptions): TravelControlsHandle {
    const { host, app, gateway, callbacks } = options;

    // Note: Content now lives directly in card body (no section wrappers)
    // This reduces nesting: Card > Body > Content (was Card > Body > Section > Content)

    // ═══════════════════════════════════════════════════════════
    // PRIMARY CONTROLS (Timestamp → Playback → Time Controls)
    // ═══════════════════════════════════════════════════════════

    // 1. Timestamp Display (top) - directly in host
    const timestampDisplay = createTimestampDisplay({
        host,
    });

    host.createDiv({ cls: "sm-travel-controls__divider" });

    // 2. Playback controls row (unified button style) - directly in host
    const playbackRow = host.createDiv({ cls: "sm-travel-controls__playback-row" });

    // Helper function to create unified buttons (all 32px height)
    function createButton(
        parent: HTMLElement,
        iconName: string,
        label: string,
        onClick: () => void,
        primary = false
    ): HTMLButtonElement {
        const cls = `sm-travel-controls__button${primary ? " sm-travel-controls__button--primary" : ""}`;
        const btn = parent.createEl("button", { cls, attr: { "aria-label": label } });
        setIcon(btn, iconName);
        btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (!btn.disabled) onClick();
        });
        return btn;
    }

    // Playback buttons (unified style, primary accent on Play)
    const playBtn = createButton(playbackRow, "play", "Play", () => void callbacks.onPlay?.(), true);
    playBtn.setAttribute("title", "Reise-Simulation starten");
    const stopBtn = createButton(playbackRow, "square", "Stop", () => void callbacks.onStop?.());
    stopBtn.setAttribute("title", "Reise-Simulation pausieren");
    const resetBtn = createButton(playbackRow, "rotate-ccw", "Reset", () => void callbacks.onReset?.());
    resetBtn.setAttribute("title", "Route und Token-Position zurücksetzen");
    const encounterBtn = createButton(playbackRow, "swords", "Random Encounter", () => void callbacks.onRandomEncounter?.());
    encounterBtn.setAttribute("title", "Zufällige Begegnung an aktueller Position generieren");

    // Inline travel duration (right-aligned in playback row)
    const travelDurationValue = playbackRow.createSpan({ cls: "sm-travel-controls__travel-duration-inline", text: "—" });

    host.createDiv({ cls: "sm-travel-controls__divider" });

    // 3. Time Controls (Advance, Jump) below playback - directly in host
    const timeControls = createTimeControls({
        host,
        onAdvance: async (amount, unit) => {
            try {
                timestampDisplay.setLoading(true);
                await gateway.advanceTimeBy(amount, unit, {
                    hookContext: { scope: "global", travelId: null, reason: "advance" },
                });
                await refresh();

                // Notify external listeners
                if (callbacks.onTimeAdvance) {
                    try {
                        await callbacks.onTimeAdvance(amount, unit);
                    } catch (err) {
                        logger.warn("[travel-controls] onTimeAdvance callback failed", err);
                    }
                }
            } catch (error) {
                logger.error("[travel-controls] Failed to advance time", error);
                const message = error instanceof Error ? error.message : String(error);
                timestampDisplay.setError(`Error: ${message}`);
            } finally {
                timestampDisplay.setLoading(false);
            }
        },
        onJumpToDate: () => {
            // Jump to date functionality
            if (!snapshot?.activeCalendar || !snapshot?.currentTimestamp) {
                logger.warn("[travel-controls] Cannot open date picker: No active calendar");
                return;
            }

            openDatePickerModal({
                app,
                calendar: snapshot.activeCalendar,
                currentTimestamp: snapshot.currentTimestamp,
                onConfirm: async (newTimestamp) => {
                    try {
                        timestampDisplay.setLoading(true);
                        await gateway.setCurrentTimestamp(newTimestamp);
                        await refresh();

                        // Notify external listeners
                        if (callbacks.onJumpToDate) {
                            try {
                                await callbacks.onJumpToDate();
                            } catch (err) {
                                logger.warn("[travel-controls] onJumpToDate callback failed", err);
                            }
                        }
                    } catch (error) {
                        logger.error("[travel-controls] Failed to jump to date", error);
                        const message = error instanceof Error ? error.message : String(error);
                        timestampDisplay.setError(`Error: ${message}`);
                    } finally {
                        timestampDisplay.setLoading(false);
                    }
                },
            });
        },
    });

    // ═══════════════════════════════════════════════════════════
    // ADVANCED SETTINGS (Collapsible: Tempo, Speed)
    // ═══════════════════════════════════════════════════════════
    // Divider before advanced section
    host.createDiv({ cls: "sm-travel-controls__divider" });

    // Collapsible toggle header - directly in host
    const advancedToggle = host.createEl("button", {
        cls: "sm-travel-controls__advanced-toggle",
        attr: { "aria-label": "Toggle Advanced Settings" },
    });
    const chevronIcon = advancedToggle.createSpan({ cls: "sm-travel-controls__advanced-chevron" });
    setIcon(chevronIcon, "chevron-right");
    advancedToggle.createSpan({ cls: "sm-travel-controls__advanced-label", text: "Advanced" });

    // Collapsible content container (initially collapsed) - directly in host
    const advancedContent = host.createDiv({
        cls: "sm-travel-controls__advanced-content sm-travel-controls__advanced-content--collapsed",
    });

    // Tempo slider row
    const tempoRow = advancedContent.createDiv({ cls: "sm-travel-controls__tempo-row" });
    const tempoLabel = tempoRow.createSpan({ cls: "sm-travel-controls__tempo-label", text: "Tempo: x1.0" });
    const tempoInput = tempoRow.createEl("input", {
        cls: "sm-travel-controls__tempo-slider",
        type: "range",
        attr: { min: "0.1", max: "10", step: "0.1" },
    }) as HTMLInputElement;
    tempoInput.value = "1";
    tempoInput.oninput = () => {
        const v = Math.max(0.1, Math.min(10, parseFloat(tempoInput.value) || 1));
        tempoLabel.setText(`Tempo: x${v.toFixed(1)}`);
        callbacks.onTempoChange?.(v);
    };

    // Party Speed input row
    const speedRow = advancedContent.createDiv({ cls: "sm-travel-controls__speed-row" });
    speedRow.createSpan({ cls: "sm-travel-controls__speed-label", text: "Party Speed:" });
    const speedInput = speedRow.createEl("input", {
        type: "number",
        cls: "sm-travel-controls__speed-input",
        attr: { step: "0.1", min: "0.1", value: "1" },
    }) as HTMLInputElement;
    speedRow.createSpan({ cls: "sm-travel-controls__speed-unit", text: "mph" });

    speedInput.onchange = () => {
        const v = parseFloat(speedInput.value);
        const val = Number.isFinite(v) && v > 0 ? v : 1;
        speedInput.value = String(val);
        callbacks.onSpeedChange?.(val);
    };

    // Toggle functionality
    let isAdvancedExpanded = false;
    advancedToggle.addEventListener("click", (ev) => {
        ev.preventDefault();
        isAdvancedExpanded = !isAdvancedExpanded;

        if (isAdvancedExpanded) {
            advancedContent.removeClass("sm-travel-controls__advanced-content--collapsed");
            setIcon(chevronIcon, "chevron-down");
        } else {
            advancedContent.addClass("sm-travel-controls__advanced-content--collapsed");
            setIcon(chevronIcon, "chevron-right");
        }
    });

    // Internal state
    let snapshot: import("../../../almanac/data/calendar-state-gateway").CalendarStateSnapshot | null = null;
    let isDestroyed = false;

    /**
     * Refreshes the calendar data.
     */
    async function refresh(): Promise<void> {
        if (isDestroyed) {
            logger.warn("[travel-controls] Cannot refresh - component destroyed");
            return;
        }

        logger.info("[travel-controls] Starting refresh");
        try {
            snapshot = await gateway.loadSnapshot();
            logger.info(`[travel-controls] Loaded snapshot - timestamp: ${JSON.stringify(snapshot.currentTimestamp)}`);
            timestampDisplay.setTimestamp(snapshot.currentTimestamp);
            timeControls.setDisabled(!snapshot.activeCalendar);
            logger.info("[travel-controls] Refresh complete");
        } catch (error) {
            logger.error("[travel-controls] Failed to refresh", error);
            timestampDisplay.setError("Failed to load calendar data");
        }
    }

    // Initial load
    void refresh();

    // Public API
    return {
        root: host,
        setTimestamp(timestamp) {
            timestampDisplay.setTimestamp(timestamp);
        },
        setPlaybackState(state) {
            const hasRoute = state.route.length > 0;
            const hasTokenPosition = state.tokenCoord !== null;
            playBtn.disabled = state.playing || !hasRoute;
            stopBtn.disabled = !state.playing;
            resetBtn.disabled = !hasRoute && !state.playing;
            encounterBtn.disabled = !hasTokenPosition;
        },
        setCurrentTime(timestamp) {
            // Time display now handled by timestampDisplay component (no separate clock)
            timestampDisplay.setTimestamp(timestamp);
        },
        setTempo(tempo) {
            const v = Math.max(0.1, Math.min(10, tempo));
            tempoInput.value = String(v);
            tempoLabel.setText(`Tempo: x${v.toFixed(1)}`);
        },
        setSpeed(speed) {
            const next = String(speed);
            if (speedInput.value !== next) speedInput.value = next;
        },
        setSpeedCalculation(data) {
            // Update compact travel duration display
            if (data.hoursPerHex !== undefined) {
                const hours = data.hoursPerHex.toFixed(1);
                travelDurationValue.setText(`${hours} h/Hex`);
            } else {
                travelDurationValue.setText("—");
            }
        },
        refresh,
        destroy() {
            isDestroyed = true;
            timestampDisplay.destroy();
            timeControls.destroy();
            host.empty();
        },
    };
}
