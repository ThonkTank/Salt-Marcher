/**
 * Day Cycle Simulator
 *
 * Simulates time progression for testing tidal cycles in Cartographer.
 * Provides UI controls for play/pause, speed adjustment, and time display.
 *
 * @module workmodes/cartographer/components/day-cycle-simulator
 */

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-day-cycle-simulator");

/**
 * Time simulation state
 */
export interface SimulationState {
    /** Current simulated time in hours since midnight (0-24) */
    currentTimeHours: number;
    /** Current day of year (1-365) */
    dayOfYear: number;
    /** Is simulation running */
    isPlaying: boolean;
    /** Playback speed multiplier (1x = realtime, 60x = 1 hour per second) */
    speed: number;
}

/**
 * Day cycle simulator options
 */
export interface DayCycleSimulatorOptions {
    /** Host element for UI */
    readonly host: HTMLElement;
    /** Called when time updates (to refresh tidal layer) */
    readonly onTimeUpdate: (state: SimulationState) => void;
    /** Initial time in hours (default: 12.0 = noon) */
    readonly initialTime?: number;
    /** Initial day of year (default: 180 = mid-summer) */
    readonly initialDay?: number;
}

/**
 * Day cycle simulator handle
 */
export interface DayCycleSimulatorHandle {
    /** Get current simulation state */
    getState(): SimulationState;
    /** Start/resume simulation */
    play(): void;
    /** Pause simulation */
    pause(): void;
    /** Reset to initial time */
    reset(): void;
    /** Set playback speed */
    setSpeed(speed: number): void;
    /** Set current time */
    setTime(hours: number): void;
    /** Set current day */
    setDay(day: number): void;
    /** Cleanup */
    destroy(): void;
}

/**
 * Create day cycle simulator with UI controls
 *
 * @param options - Simulator options
 * @returns Simulator handle
 *
 * @example
 * ```typescript
 * const simulator = createDayCycleSimulator({
 *     host: environmentPanel,
 *     onTimeUpdate: (state) => {
 *         renderHandles.refreshTidalLayer();
 *         // Example: Log current time and day
 *         // logger.info("Day cycle state", { time: state.currentTimeHours, day: state.dayOfYear });
 *     },
 * });
 *
 * simulator.play(); // Start simulation
 * simulator.setSpeed(60); // 1 hour per second
 * ```
 */
export function createDayCycleSimulator(options: DayCycleSimulatorOptions): DayCycleSimulatorHandle {
    const { host, onTimeUpdate, initialTime = 12.0, initialDay = 180 } = options;

    // Simulation state
    let currentTimeHours = initialTime;
    let dayOfYear = initialDay;
    let isPlaying = false;
    let speed = 60; // Default: 60x realtime (1 hour per second)

    let intervalId: number | null = null;
    let lastUpdateTime = 0;

    // UI Container
    const root = host.createDiv({ cls: "sm-day-cycle-simulator" });
    root.createEl("h3", { text: "🌗 Tageszyklus-Simulator", cls: "sm-day-cycle-simulator__title" });

    // Time Display
    const displaySection = root.createDiv({ cls: "sm-day-cycle-simulator__display" });

    const timeDisplay = displaySection.createDiv({ cls: "sm-day-cycle-simulator__time" });
    const timeValue = timeDisplay.createSpan({ cls: "sm-day-cycle-simulator__time-value" });

    const dayDisplay = displaySection.createDiv({ cls: "sm-day-cycle-simulator__day" });
    dayDisplay.createSpan({ text: "Tag: ", cls: "sm-day-cycle-simulator__label" });
    const dayValue = dayDisplay.createSpan({ cls: "sm-day-cycle-simulator__day-value" });

    // Controls
    const controlsSection = root.createDiv({ cls: "sm-day-cycle-simulator__controls" });

    // Play/Pause Button
    const playPauseBtn = controlsSection.createEl("button", {
        cls: "sm-day-cycle-simulator__btn sm-day-cycle-simulator__btn--play",
        text: "▶ Start",
    });

    // Reset Button
    const resetBtn = controlsSection.createEl("button", {
        cls: "sm-day-cycle-simulator__btn",
        text: "↻ Reset",
    });

    // Speed Control
    const speedSection = root.createDiv({ cls: "sm-day-cycle-simulator__speed" });
    speedSection.createSpan({ text: "Geschwindigkeit: ", cls: "sm-day-cycle-simulator__label" });

    const speedSelect = speedSection.createEl("select", { cls: "sm-day-cycle-simulator__speed-select" });
    const speedOptions = [
        { value: 1, label: "1x (Echtzeit)" },
        { value: 10, label: "10x (6 min/h)" },
        { value: 60, label: "60x (1 min/h)" },
        { value: 120, label: "120x (30 sec/h)" },
        { value: 360, label: "360x (10 sec/h)" },
        { value: 720, label: "720x (5 sec/h)" },
    ];

    speedOptions.forEach(opt => {
        const option = speedSelect.createEl("option", {
            value: String(opt.value),
            text: opt.label,
        });
        if (opt.value === speed) {
            option.selected = true;
        }
    });

    // Update display
    const updateDisplay = () => {
        const hours = Math.floor(currentTimeHours);
        const minutes = Math.floor((currentTimeHours % 1) * 60);
        timeValue.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} Uhr`;
        dayValue.textContent = String(dayOfYear);
    };

    // Simulation tick
    const tick = () => {
        const now = Date.now();
        if (lastUpdateTime === 0) {
            lastUpdateTime = now;
            return;
        }

        const deltaMs = now - lastUpdateTime;
        lastUpdateTime = now;

        // Advance time based on speed
        const deltaHours = (deltaMs / 1000) * (speed / 3600); // speed is multiplier of realtime
        currentTimeHours += deltaHours;

        // Wrap hours (24-hour cycle)
        while (currentTimeHours >= 24) {
            currentTimeHours -= 24;
            dayOfYear += 1;
            if (dayOfYear > 365) {
                dayOfYear = 1;
            }
        }

        updateDisplay();

        // Notify listeners
        try {
            onTimeUpdate(getState());
        } catch (err) {
            logger.error("onTimeUpdate callback failed", err);
        }
    };

    // Start simulation
    const play = () => {
        if (isPlaying) return;
        isPlaying = true;
        lastUpdateTime = Date.now();
        playPauseBtn.textContent = "⏸ Pause";
        playPauseBtn.addClass("is-playing");

        // Update every 100ms for smooth animation
        intervalId = window.setInterval(tick, 100);

        logger.info("Started", { speed, currentTimeHours, dayOfYear });
    };

    // Pause simulation
    const pause = () => {
        if (!isPlaying) return;
        isPlaying = false;
        playPauseBtn.textContent = "▶ Start";
        playPauseBtn.removeClass("is-playing");

        if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }

        lastUpdateTime = 0;
        logger.info("Paused");
    };

    // Reset to initial state
    const reset = () => {
        const wasPlaying = isPlaying;
        pause();
        currentTimeHours = initialTime;
        dayOfYear = initialDay;
        updateDisplay();

        // Notify listeners of reset
        try {
            onTimeUpdate(getState());
        } catch (err) {
            logger.error("onTimeUpdate callback failed on reset", err);
        }

        if (wasPlaying) {
            play();
        }

        logger.info("Reset to initial state");
    };

    // Set playback speed
    const setSpeed = (newSpeed: number) => {
        speed = Math.max(1, Math.min(3600, newSpeed)); // Clamp to 1x-3600x
        logger.info("Speed changed", { speed });
    };

    // Set current time
    const setTime = (hours: number) => {
        currentTimeHours = hours % 24;
        updateDisplay();

        // Notify listeners
        try {
            onTimeUpdate(getState());
        } catch (err) {
            logger.error("onTimeUpdate callback failed on setTime", err);
        }
    };

    // Set current day
    const setDay = (day: number) => {
        dayOfYear = Math.max(1, Math.min(365, day));
        updateDisplay();

        // Notify listeners
        try {
            onTimeUpdate(getState());
        } catch (err) {
            logger.error("onTimeUpdate callback failed on setDay", err);
        }
    };

    // Get current state
    const getState = (): SimulationState => ({
        currentTimeHours,
        dayOfYear,
        isPlaying,
        speed,
    });

    // Event handlers
    playPauseBtn.addEventListener("click", () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    });

    resetBtn.addEventListener("click", reset);

    speedSelect.addEventListener("change", () => {
        setSpeed(Number(speedSelect.value));
    });

    // Initialize display
    updateDisplay();

    // Cleanup
    const destroy = () => {
        pause();
        root.empty();
    };

    return {
        getState,
        play,
        pause,
        reset,
        setSpeed,
        setTime,
        setDay,
        destroy,
    };
}
