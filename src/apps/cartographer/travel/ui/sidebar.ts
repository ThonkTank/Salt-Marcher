// src/apps/cartographer/travel/ui/sidebar.ts
// Sidebar-Layout und Steuerung für Travel-Modus.
import type { TravelPanelSnapshot } from "../../../almanac/mode/cartographer-gateway";
export type Sidebar = {
    root: HTMLElement;
    controlsHost: HTMLElement;
    setTitle?: (title: string) => void;
    setTile(rc: { r: number; c: number } | null): void;
    setSpeed(v: number): void;
    setTravelPanel(panel: TravelPanelSnapshot | null): void;
    onSpeedChange(fn: (v: number) => void): void;
    destroy(): void;
};

export function createSidebar(host: HTMLElement): Sidebar {
    host.empty();
    host.classList.add("sm-cartographer__sidebar--travel");

    const root = host.createDiv({ cls: "sm-cartographer__travel" });

    const controlsHost = root.createDiv({ cls: "sm-cartographer__travel-controls" });

    const tileRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
    tileRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Aktuelles Hex" });
    const tileValue = tileRow.createSpan({
        cls: "sm-cartographer__travel-value",
        text: "—",
    });

    const speedRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
    speedRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Party Speed (mph)" });
    const speedInput = speedRow.createEl("input", {
        type: "number",
        cls: "sm-cartographer__travel-input",
        attr: { step: "0.1", min: "0.1", value: "1" },
    }) as HTMLInputElement;

    const timeRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
    timeRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Almanac" });
    const timeValue = timeRow.createSpan({
        cls: "sm-cartographer__travel-value",
        text: "—",
    });

    const quickRow = root.createDiv({ cls: "sm-cartographer__travel-row" });
    quickRow.createSpan({ cls: "sm-cartographer__travel-label", text: "Letzter Schritt" });
    const quickValue = quickRow.createSpan({
        cls: "sm-cartographer__travel-value",
        text: "—",
    });

    const logSection = root.createDiv({ cls: "sm-cartographer__travel-log" });
    logSection.createSpan({ cls: "sm-cartographer__travel-log-title", text: "Trigger-Log" });
    const logList = logSection.createEl("ul", {
        cls: "sm-cartographer__travel-log-list",
    }) as HTMLUListElement;

    let onChange: (v: number) => void = () => {};
    speedInput.onchange = () => {
        const v = parseFloat(speedInput.value);
        const val = Number.isFinite(v) && v > 0 ? v : 1;
        speedInput.value = String(val);
        onChange(val);
    };

    const setTile = (rc: { r: number; c: number } | null) => {
        tileValue.textContent = rc ? `${rc.r},${rc.c}` : "—";
    };
    const setSpeed = (v: number) => {
        const next = String(v);
        if (speedInput.value !== next) speedInput.value = next;
    };
    const formatQuickStep = (step: TravelPanelSnapshot["lastAdvanceStep"]): string => {
        if (!step) return "—";
        const sign = step.amount >= 0 ? "+" : "";
        const label =
            step.unit === "day"
                ? "Tag"
                : step.unit === "hour"
                  ? "Std"
                  : "Min";
        return `${sign}${step.amount} ${label}`;
    };
    const setTravelPanel = (panel: TravelPanelSnapshot | null) => {
        timeValue.textContent = panel?.timestampLabel ?? "—";
        quickValue.textContent = formatQuickStep(panel?.lastAdvanceStep);
        logList.empty();
        const entries = panel?.logEntries ?? [];
        if (entries.length === 0) {
            logList.createEl("li", {
                cls: "sm-cartographer__travel-log-item sm-cartographer__travel-log-item--empty",
                text: panel?.reason === "jump" ? "Keine übersprungenen Ereignisse" : "Keine neuen Hooks",
            });
            return;
        }
        for (const entry of entries) {
            const item = logList.createEl("li", { cls: "sm-cartographer__travel-log-item" });
            const skipped = entry.skipped ? " • übersprungen" : "";
            item.setText(`${entry.title} • ${entry.occurrenceLabel}${skipped}`);
        }
    };
    const setTitle = (title: string) => {
        if (title && title.trim().length > 0) {
            host.dataset.mapTitle = title;
        } else {
            delete host.dataset.mapTitle;
        }
    };

    return {
        root,
        setTitle,
        controlsHost,
        setTile,
        setSpeed,
        setTravelPanel,
        onSpeedChange: (fn) => (onChange = fn),
        destroy: () => {
            host.empty();
            host.classList.remove("sm-cartographer__sidebar--travel");
            delete host.dataset.mapTitle;
        },
    };
}
