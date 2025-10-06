// src/apps/encounter/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import { EncounterPresenter, type EncounterPersistedState } from "./presenter";
import type { EncounterViewState } from "./presenter";

export const VIEW_ENCOUNTER = "salt-encounter";

export class EncounterView extends ItemView {
    private presenter: EncounterPresenter | null = null;
    private detachPresenter?: () => void;
    private pendingState: EncounterPersistedState | null = null;

    private headerEl!: HTMLHeadingElement;
    private statusEl!: HTMLDivElement;
    private summaryListEl!: HTMLUListElement;
    private notesEl!: HTMLTextAreaElement;
    private resolveBtn!: HTMLButtonElement;
    private emptyEl!: HTMLDivElement;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_ENCOUNTER; }
    getDisplayText() { return "Encounter"; }
    getIcon() { return "swords" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-encounter-view");
        this.renderShell();

        this.presenter = new EncounterPresenter(this.pendingState);
        this.pendingState = null;
        this.detachPresenter = this.presenter.subscribe((state) => this.render(state));
    }

    async onClose() {
        this.detachPresenter?.();
        this.presenter?.dispose();
        this.detachPresenter = undefined;
        this.presenter = null;
        this.pendingState = null;
        this.contentEl.empty();
        this.contentEl.removeClass("sm-encounter-view");
    }

    getViewData(): EncounterPersistedState | null {
        return this.presenter?.getState() ?? this.pendingState;
    }

    setViewData(data: EncounterPersistedState) {
        if (this.presenter) {
            this.presenter.restore(data);
        } else {
            this.pendingState = data;
        }
    }

    private renderShell() {
        this.contentEl.empty();

        const header = this.contentEl.createEl("div", { cls: "sm-encounter-header" });
        this.headerEl = header.createEl("h2", { text: "Encounter" });
        this.statusEl = header.createDiv({ cls: "status", text: "Waiting for travel events…" });

        this.summaryListEl = this.contentEl.createEl("ul", { cls: "sm-encounter-summary" });

        this.emptyEl = this.contentEl.createDiv({
            cls: "sm-encounter-empty",
            text: "No active encounter. Travel mode will populate this workspace when an encounter triggers.",
        });
        this.emptyEl.style.display = "";

        const notesSection = this.contentEl.createDiv({ cls: "sm-encounter-notes" });
        notesSection.createEl("label", { text: "Notes", attr: { for: "encounter-notes" } });
        this.notesEl = notesSection.createEl("textarea", {
            cls: "notes-input",
            attr: {
                id: "encounter-notes",
                placeholder: "Record tactical notes, initiative order, or follow-up tasks…",
                rows: "6",
            },
        }) as HTMLTextAreaElement;
        this.notesEl.disabled = true;
        this.notesEl.addEventListener("input", () => {
            if (!this.presenter) return;
            this.presenter.setNotes(this.notesEl.value);
        });

        this.resolveBtn = this.contentEl.createEl("button", { cls: "sm-encounter-resolve", text: "Mark encounter resolved" });
        this.resolveBtn.disabled = true;
        this.resolveBtn.addEventListener("click", () => {
            this.presenter?.markResolved();
        });
    }

    private render(state: EncounterViewState) {
        const session = state.session;
        if (!session) {
            this.headerEl.setText("Encounter");
            this.statusEl.setText("Waiting for travel events…");
            this.summaryListEl.empty();
            this.emptyEl.style.display = "";
            this.notesEl.value = "";
            this.notesEl.disabled = true;
            this.resolveBtn.disabled = true;
            this.resolveBtn.setText("Mark encounter resolved");
            return;
        }

        this.emptyEl.style.display = "none";

        const { event, notes, status, resolvedAt } = session;
        const region = event.regionName ?? "Unknown region";
        this.headerEl.setText(`Encounter – ${region}`);

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

        if (this.notesEl.value !== notes) {
            this.notesEl.value = notes;
        }
        this.notesEl.disabled = false;

        if (status === "resolved") {
            this.resolveBtn.disabled = true;
            this.resolveBtn.setText("Encounter resolved");
        } else {
            this.resolveBtn.disabled = false;
            this.resolveBtn.setText("Mark encounter resolved");
        }
    }
}
