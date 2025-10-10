// src/apps/encounter/session-view.ts
// Stellt den Encounter-Container als eigenständige Ansicht bereit.
import type { EncounterViewState } from "./presenter";

/**
 * Renders the encounter session summary that is populated by the cartographer
 * when a travel encounter fires.
 */
export class EncounterSessionView {
    private readonly parentEl: HTMLElement;

    private rootEl: HTMLDivElement | null = null;
    private titleEl!: HTMLHeadingElement;
    private statusEl!: HTMLDivElement;
    private summaryListEl!: HTMLUListElement;
    private emptyStateEl!: HTMLDivElement;

    constructor(parentEl: HTMLElement) {
        this.parentEl = parentEl;
    }

    mount() {
        this.unmount();
        const section = this.parentEl.createDiv({
            cls: "sm-encounter-section sm-encounter-session sm-encounter-header",
        });
        this.rootEl = section;

        this.titleEl = section.createEl("h2", {
            cls: "sm-encounter-heading",
            text: "Encounter",
        });
        this.statusEl = section.createDiv({
            cls: "sm-encounter-status",
            text: "Waiting for travel events…",
        });
        const metaEl = section.createDiv({ cls: "sm-encounter-meta" });
        this.summaryListEl = metaEl.createEl("ul", { cls: "sm-encounter-summary" });
        this.emptyStateEl = section.createDiv({
            cls: "sm-encounter-empty",
            text: "No active encounter. Travel mode will populate this workspace when an encounter triggers.",
        });
    }

    unmount() {
        this.rootEl?.remove();
        this.rootEl = null;
    }

    render(session: EncounterViewState["session"] | null | undefined) {
        if (!this.rootEl) return;

        if (!session) {
            this.titleEl.setText("Encounter");
            this.statusEl.setText("Waiting for travel events…");
            this.summaryListEl.empty();
            this.emptyStateEl.removeClass("sm-encounter-hidden");
            return;
        }

        this.emptyStateEl.addClass("sm-encounter-hidden");

        const { event, status, resolvedAt } = session;
        const region = event.regionName ?? "Unknown region";
        this.titleEl.setText(`Encounter – ${region}`);
        if (status === "resolved") {
            this.statusEl.setText(resolvedAt ? `Resolved ${resolvedAt}` : "Resolved");
        } else {
            this.statusEl.setText("Awaiting resolution");
        }

        this.summaryListEl.empty();
        const summaryEntries: Array<[string, string]> = [];
        if (event.coord) {
            summaryEntries.push(["Hex", `${event.coord.r}, ${event.coord.c}`]);
        }
        if (event.mapName) {
            summaryEntries.push(["Map", event.mapName]);
        }
        if (event.mapPath) {
            summaryEntries.push(["Map path", event.mapPath]);
        }
        summaryEntries.push(["Triggered", event.triggeredAt]);
        if (typeof event.travelClockHours === "number") {
            summaryEntries.push(["Travel clock", `${event.travelClockHours.toFixed(2)} h`]);
        }
        if (typeof event.encounterOdds === "number") {
            summaryEntries.push(["Encounter odds", `1 in ${event.encounterOdds}`]);
        }

        for (const [label, value] of summaryEntries) {
            const li = this.summaryListEl.createEl("li");
            li.createSpan({ cls: "label", text: `${label}: ` });
            li.createSpan({ cls: "value", text: value });
        }
    }
}
