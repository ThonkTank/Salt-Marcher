// src/apps/library/create/creature/modal.ts
import { App, type TFile } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import {
  mountCreatureClassificationSection,
  mountCreatureVitalSection,
  mountCreatureStatsAndSkillsSection,
  mountCreatureSensesAndDefensesSection,
  mountEntriesSection
} from "./sections";
import { spellcastingDataToEntry } from "./entry-model";
import { BaseCreateModal, type CreateModalPipeline } from "../../../../ui/workmode/create";

export interface CreatureModalOptions {
    pipeline?: CreateModalPipeline<StatblockData, StatblockData, TFile | void>;
    onSubmit?: (data: StatblockData) => Promise<void> | void;
}

export interface CreatureModalArgs extends CreatureModalOptions {
    preset?: StatblockData;
}

export class CreateCreatureModal extends BaseCreateModal<StatblockData, StatblockData, TFile | void> {
    private readonly modalOptions: CreatureModalOptions;

    constructor(app: App, presetName: string | undefined, options: CreatureModalArgs) {
        super(app, options.preset || presetName, {
            title: "Neuen Statblock erstellen",
            subtitle: "Pflege zuerst Grundlagen und Attribute, anschließend Sinne, Verteidigungen und Aktionen.",
            defaultName: "Neue Kreatur",
            submitButtonText: "Erstellen",
            cancelButtonText: "Abbrechen",
            enableNavigation: true,
            sections: [
                {
                    id: "sm-cc-section-classification",
                    title: "Grunddaten",
                    subtitle: "Name, Typ, Gesinnung und Tags",
                    mount: handles => mountCreatureClassificationSection(handles.body, this.data, {
                        app: this.app,
                        onPresetSelected: (newPreset) => {
                            this.close();
                            new CreateCreatureModal(this.app, undefined, { ...this.modalOptions, preset: newPreset }).open();
                        }
                    }),
                },
                {
                    id: "sm-cc-section-vitals",
                    title: "Vitalwerte",
                    subtitle: "AC, HP, Initiative und Bewegung",
                    mount: handles => mountCreatureVitalSection(handles.body, this.data),
                },
                {
                    id: "sm-cc-section-stats",
                    title: "Attribute & Fertigkeiten",
                    subtitle: "Attributswerte, Rettungswürfe und Fertigkeiten",
                    mount: handles => mountCreatureStatsAndSkillsSection(handles.body, this.data, handles.registerValidation),
                },
                {
                    id: "sm-cc-section-defenses",
                    title: "Sinne & Verteidigungen",
                    mount: handles => mountCreatureSensesAndDefensesSection(handles.body, this.data),
                },
                {
                    id: "sm-cc-section-entries",
                    title: "Einträge",
                    subtitle: "Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres",
                    mount: handles => mountEntriesSection(handles.body, this.data, handles.registerValidation),
                },
            ],
            pipeline: options.pipeline,
            onSubmit: options.onSubmit,
        });
        this.modalOptions = { pipeline: options.pipeline, onSubmit: options.onSubmit };
    }

    protected createDefault(name: string): StatblockData {
        return { name: name?.trim() || "Neue Kreatur" };
    }

    protected initializeData(presetOrName: string | StatblockData | undefined): StatblockData {
        // Handle string or undefined -> create default
        if (typeof presetOrName === 'string' || !presetOrName) {
            return this.createDefault((presetOrName as string) || this.config.defaultName);
        }

        // Handle object preset
        const data = { ...presetOrName };

        // Migrate legacy spellcasting data to entry format
        if ((data as any).spellcasting && (!data.entries || data.entries.length === 0)) {
            const spellEntry = spellcastingDataToEntry((data as any).spellcasting);
            if (!data.entries) data.entries = [];
            data.entries.push(spellEntry as any);
            delete (data as any).spellcasting;
        }

        return data;
    }

    protected buildFields(): void {
        // Fields are built via sections in navigation mode
    }
}
