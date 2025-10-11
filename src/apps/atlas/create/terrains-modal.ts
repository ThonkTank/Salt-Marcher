// src/apps/atlas/create/terrains-modal.ts
// Modal for creating new terrain definitions within the Atlas view.
import { App, Setting } from "obsidian";
import {
    BaseCreateModal,
    createNumberStepper,
    type CreateModalPipeline,
} from "../../../ui/workmode/create";

export interface TerrainDraft {
    name: string;
    color: string;
    speed: number;
}

export interface CreateTerrainModalOptions<TSerialized = TerrainDraft, TResult = unknown> {
    existingNames: string[];
    pipeline?: CreateModalPipeline<TerrainDraft, TSerialized, TResult>;
    onSubmit?: (data: TerrainDraft) => Promise<void> | void;
}

export class CreateTerrainModal<
    TSerialized = TerrainDraft,
    TResult = unknown
> extends BaseCreateModal<TerrainDraft, TSerialized, TResult> {
    private readonly existingNames: Set<string>;

    constructor(
        app: App,
        preset: string | TerrainDraft | undefined,
        options: CreateTerrainModalOptions<TSerialized, TResult>
    ) {
        super(app, preset, {
            title: "Create Terrain",
            defaultName: "New Terrain",
            submitButtonText: "Create Terrain",
            validate: (draft) => this.collectValidationIssues(draft),
            pipeline: options.pipeline,
            onSubmit: options.onSubmit,
        });
        this.existingNames = new Set(
            options.existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
        );
    }

    protected createDefault(name: string): TerrainDraft {
        return {
            name,
            color: "#999999",
            speed: 1,
        };
    }

    protected buildFields(contentEl: HTMLElement): void {
        new Setting(contentEl)
            .setName("Name")
            .addText((input) => {
                input
                    .setPlaceholder("Forest")
                    .setValue(this.data.name)
                    .onChange((value) => {
                        this.data.name = value.trim();
                    });
            });

        new Setting(contentEl)
            .setName("Display Color")
            .setDesc("Used for map overlays and quick identification.")
            .addColorPicker((picker) => {
                picker.setValue(this.ensureHexColor(this.data.color));
                picker.onChange((value) => {
                    this.data.color = this.ensureHexColor(value);
                });
            });

        const speedSetting = new Setting(contentEl)
            .setName("Travel Speed Modifier")
            .setDesc("Relative travel multiplier (1 = normal speed).");
        speedSetting.controlEl.empty();
        const speedHandle = createNumberStepper(speedSetting.controlEl, {
            min: 0,
            step: 0.1,
            value: this.data.speed,
            placeholder: "1",
            className: "sm-cc-input",
            buttonClassName: "btn-compact",
            onInput: (value) => {
                this.data.speed = this.normalizeSpeed(value);
            },
        });
        speedHandle.input.addClass("sm-cc-input--number");
    }

    private collectValidationIssues(draft: TerrainDraft): string[] {
        const issues: string[] = [];
        const name = (draft.name || "").trim();
        if (!name) {
            issues.push("Name is required.");
        } else if (this.existingNames.has(name.toLowerCase())) {
            issues.push("A terrain with this name already exists.");
        }

        if (!/^#([0-9a-f]{6})$/i.test(this.ensureHexColor(draft.color))) {
            issues.push("Color must be a hex value (e.g. #2e7d32).");
        }

        const speed = this.normalizeSpeed(draft.speed);
        if (!Number.isFinite(speed) || speed < 0) {
            issues.push("Speed modifier must be zero or a positive number.");
        }

        return issues;
    }

    private ensureHexColor(value: string): string {
        const trimmed = (value || "").trim();
        if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
            return trimmed;
        }
        if (/^#([0-9a-f]{3})$/i.test(trimmed)) {
            const hex = trimmed.slice(1);
            const expanded = hex.split("").map((ch) => ch + ch).join("");
            return `#${expanded}`;
        }
        return "#999999";
    }

    private normalizeSpeed(value: number | undefined): number {
        if (!Number.isFinite(value)) return 1;
        const numeric = Number(value);
        return numeric < 0 ? 0 : Number.isFinite(numeric) ? numeric : 1;
    }
}
