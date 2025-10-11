// src/apps/atlas/create/regions-modal.ts
// Modal for creating new regions within the Atlas view.
import { App, Setting } from "obsidian";
import {
    BaseCreateModal,
    createNumberStepper,
    createSelectDropdown,
    type CreateModalPipeline,
} from "../../../ui/workmode/create";

export interface RegionDraft {
    name: string;
    terrain: string;
    encounterOdds?: number;
}

export interface CreateRegionModalOptions<TSerialized = RegionDraft, TResult = unknown> {
    existingNames: string[];
    terrainOptions: string[];
    pipeline?: CreateModalPipeline<RegionDraft, TSerialized, TResult>;
    onSubmit?: (data: RegionDraft) => Promise<void> | void;
}

export class CreateRegionModal<
    TSerialized = RegionDraft,
    TResult = unknown
> extends BaseCreateModal<RegionDraft, TSerialized, TResult> {
    private readonly existingNames: Set<string>;
    private readonly terrainOptions: string[];

    constructor(
        app: App,
        preset: string | RegionDraft | undefined,
        options: CreateRegionModalOptions<TSerialized, TResult>
    ) {
        super(app, preset, {
            title: "Create Region",
            defaultName: "New Region",
            submitButtonText: "Create Region",
            validate: (draft) => this.collectValidationIssues(draft),
            pipeline: options.pipeline,
            onSubmit: options.onSubmit,
        });
        this.existingNames = new Set(
            options.existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
        );
        this.terrainOptions = Array.from(new Set(options.terrainOptions ?? [])).sort((a, b) => {
            if (!a) return -1;
            if (!b) return 1;
            return a.localeCompare(b);
        });
    }

    protected createDefault(name: string): RegionDraft {
        return {
            name,
            terrain: "",
        };
    }

    protected buildFields(contentEl: HTMLElement): void {
        new Setting(contentEl)
            .setName("Name")
            .addText((input) => {
                input
                    .setPlaceholder("Saltmarsh")
                    .setValue(this.data.name)
                    .onChange((value) => {
                        this.data.name = value.trim();
                    });
            });

        const terrainSetting = new Setting(contentEl)
            .setName("Terrain")
            .setDesc("Select the primary terrain for this region.");
        const selectHandle = createSelectDropdown(terrainSetting.controlEl, {
            options: this.buildTerrainOptions(),
            value: this.data.terrain || "",
            enableSearch: true,
            searchPlaceholder: "Search terrains…",
            onChange: (value) => {
                this.data.terrain = value;
            },
        });
        selectHandle.element.addClass("sm-cc-input");

        const encounterSetting = new Setting(contentEl)
            .setName("Encounter Odds")
            .setDesc("Chance denominator for random encounters (1/n). Leave empty for none.");
        encounterSetting.controlEl.empty();
        const oddsHandle = createNumberStepper(encounterSetting.controlEl, {
            min: 1,
            step: 1,
            value: this.data.encounterOdds,
            placeholder: "6",
            className: "sm-cc-input",
            buttonClassName: "btn-compact",
            onInput: (value) => {
                const normalized = this.normalizeEncounterOdds(value);
                this.data.encounterOdds = normalized ?? undefined;
            },
        });
        oddsHandle.input.addClass("sm-cc-input--number");
    }

    private buildTerrainOptions(): Array<{ value: string; label: string }> {
        const base = [{ value: "", label: "(none)" }];
        const additional = this.terrainOptions
            .filter((name) => name.trim() !== "")
            .map((name) => ({ value: name, label: name }));
        return [...base, ...additional];
    }

    private collectValidationIssues(draft: RegionDraft): string[] {
        const issues: string[] = [];
        const name = (draft.name || "").trim();
        if (!name) {
            issues.push("Name is required.");
        } else if (this.existingNames.has(name.toLowerCase())) {
            issues.push("A region with this name already exists.");
        }

        const encounter = this.normalizeEncounterOdds(draft.encounterOdds);
        if (encounter != null && encounter < 1) {
            issues.push("Encounter odds must be 1 or higher if provided.");
        }

        return issues;
    }

    private normalizeEncounterOdds(value: number | undefined): number | null {
        if (!Number.isFinite(value)) return null;
        const parsed = Math.round(Number(value));
        if (parsed <= 0) return null;
        return parsed;
    }
}
