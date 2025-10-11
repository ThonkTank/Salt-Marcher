// src/apps/library/create/equipment/modal.ts
import { App, Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { EquipmentData, EquipmentType } from "../../core/equipment-files";
import { collectEquipmentValidationIssues } from "./validation";
import { BaseCreateModal, type CreateModalPipeline } from "../../../../ui/workmode/create";

export interface EquipmentModalOptions<TSerialized = unknown, TResult = unknown> {
    pipeline?: CreateModalPipeline<EquipmentData, TSerialized, TResult>;
    onSubmit?: (data: EquipmentData) => Promise<void> | void;
}

export class CreateEquipmentModal<
    TSerialized = unknown,
    TResult = unknown
> extends BaseCreateModal<EquipmentData, TSerialized, TResult> {
    private containerEl: HTMLElement | null = null;

    constructor(app: App, presetNameOrData: string | EquipmentData | undefined, options: EquipmentModalOptions<TSerialized, TResult>) {
        super(app, presetNameOrData, {
            title: "Create New Equipment",
            defaultName: "New Equipment",
            validate: collectEquipmentValidationIssues,
            submitButtonText: "Create Equipment",
            pipeline: options.pipeline,
            onSubmit: options.onSubmit,
        });
    }

    protected createDefault(name: string): EquipmentData {
        return { name, type: "weapon" };
    }

    onOpen() {
        super.onOpen();
        this.containerEl = this.contentEl;
    }

    protected buildFields(contentEl: HTMLElement): void {

        // === BASIC INFO ===
        contentEl.createEl("h4", { text: "Basic Information" });

        new Setting(contentEl).setName("Name").addText(t => {
            t.setPlaceholder("Longsword").setValue(this.data.name).onChange(v => this.data.name = v.trim());
            (t as any).inputEl.style.width = '28ch';
        });

        new Setting(contentEl).setName("Type").addDropdown(dd => {
            const types: EquipmentType[] = ["weapon", "armor", "tool", "gear"];
            for (const type of types) {
                dd.addOption(type, type.charAt(0).toUpperCase() + type.slice(1));
            }
            dd.setValue(this.data.type);
            dd.onChange(v => {
                this.data.type = v as EquipmentType;
                this.rebuildTypeSpecificFields();
            });
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(contentEl).setName("Cost").setDesc("e.g., '15 GP', '2 SP'").addText(t => {
            t.setPlaceholder("15 GP").setValue(this.data.cost || "").onChange(v => this.data.cost = v.trim() || undefined);
            (t as any).inputEl.style.width = '12ch';
        });

        new Setting(contentEl).setName("Weight").setDesc("e.g., '3 lb.', '—'").addText(t => {
            t.setPlaceholder("3 lb.").setValue(this.data.weight || "").onChange(v => this.data.weight = v.trim() || undefined);
            (t as any).inputEl.style.width = '12ch';
        });

        // Placeholder for type-specific fields
        const typeFieldsContainer = contentEl.createDiv({ cls: "sm-cc-type-fields" });

        // Build initial type-specific fields
        this.buildTypeSpecificFields(typeFieldsContainer);

        // === DESCRIPTION ===
        contentEl.createEl("h4", { text: "Description" });

        this.addTextArea(contentEl, "Description", "Equipment description...",
            v => this.data.description = v.trim() || undefined, this.data.description);
    }

    private rebuildTypeSpecificFields() {
        if (!this.containerEl) return;

        const typeFieldsContainer = this.containerEl.querySelector(".sm-cc-type-fields") as HTMLElement;
        if (typeFieldsContainer) {
            typeFieldsContainer.empty();
            this.buildTypeSpecificFields(typeFieldsContainer);
        }
    }

    private buildTypeSpecificFields(container: HTMLElement) {
        container.empty();

        if (this.data.type === "weapon") {
            this.buildWeaponFields(container);
        } else if (this.data.type === "armor") {
            this.buildArmorFields(container);
        } else if (this.data.type === "tool") {
            this.buildToolFields(container);
        } else if (this.data.type === "gear") {
            this.buildGearFields(container);
        }
    }

    private buildWeaponFields(container: HTMLElement) {
        container.createEl("h4", { text: "Weapon Properties" });

        new Setting(container).setName("Category").addDropdown(dd => {
            const categories = ["", "Simple", "Martial"];
            for (const cat of categories) dd.addOption(cat, cat || "(none)");
            dd.setValue(this.data.weapon_category || "");
            dd.onChange(v => this.data.weapon_category = (v || undefined) as any);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(container).setName("Weapon Type").addDropdown(dd => {
            const types = ["", "Melee", "Ranged"];
            for (const type of types) dd.addOption(type, type || "(none)");
            dd.setValue(this.data.weapon_type || "");
            dd.onChange(v => this.data.weapon_type = (v || undefined) as any);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(container).setName("Damage").setDesc("e.g., '1d8 Slashing'").addText(t => {
            t.setPlaceholder("1d8 Slashing").setValue(this.data.damage || "").onChange(v => this.data.damage = v.trim() || undefined);
            (t as any).inputEl.style.width = '18ch';
        });

        new Setting(container).setName("Properties").setDesc("Comma-separated: Finesse, Light, etc.").addText(t => {
            const propsStr = this.data.properties?.join(", ") || "";
            t.setPlaceholder("Finesse, Light").setValue(propsStr).onChange(v => {
                if (v.trim()) {
                    this.data.properties = v.split(",").map(p => p.trim()).filter(Boolean);
                } else {
                    this.data.properties = undefined;
                }
            });
            (t as any).inputEl.style.width = '34ch';
        });

        new Setting(container).setName("Mastery").setDesc("e.g., 'Sap', 'Vex'").addText(t => {
            t.setPlaceholder("Sap").setValue(this.data.mastery || "").onChange(v => this.data.mastery = v.trim() || undefined);
            (t as any).inputEl.style.width = '12ch';
        });
    }

    private buildArmorFields(container: HTMLElement) {
        container.createEl("h4", { text: "Armor Properties" });

        new Setting(container).setName("Category").addDropdown(dd => {
            const categories = ["", "Light", "Medium", "Heavy", "Shield"];
            for (const cat of categories) dd.addOption(cat, cat || "(none)");
            dd.setValue(this.data.armor_category || "");
            dd.onChange(v => this.data.armor_category = (v || undefined) as any);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(container).setName("Armor Class (AC)").setDesc("e.g., '11 + Dex modifier', '18'").addText(t => {
            t.setPlaceholder("11 + Dex modifier").setValue(this.data.ac || "").onChange(v => this.data.ac = v.trim() || undefined);
            (t as any).inputEl.style.width = '22ch';
        });

        new Setting(container).setName("Strength Requirement").setDesc("e.g., 'Str 13'").addText(t => {
            t.setPlaceholder("Str 13").setValue(this.data.strength_requirement || "").onChange(v => this.data.strength_requirement = v.trim() || undefined);
            (t as any).inputEl.style.width = '12ch';
        });

        new Setting(container).setName("Stealth Disadvantage").addToggle(t => {
            t.setValue(!!this.data.stealth_disadvantage);
            t.onChange(v => this.data.stealth_disadvantage = v || undefined);
        });

        new Setting(container).setName("Don Time").setDesc("e.g., '1 Minute'").addText(t => {
            t.setPlaceholder("1 Minute").setValue(this.data.don_time || "").onChange(v => this.data.don_time = v.trim() || undefined);
            (t as any).inputEl.style.width = '18ch';
        });

        new Setting(container).setName("Doff Time").setDesc("e.g., '1 Minute'").addText(t => {
            t.setPlaceholder("1 Minute").setValue(this.data.doff_time || "").onChange(v => this.data.doff_time = v.trim() || undefined);
            (t as any).inputEl.style.width = '18ch';
        });
    }

    private buildToolFields(container: HTMLElement) {
        container.createEl("h4", { text: "Tool Properties" });

        new Setting(container).setName("Category").addDropdown(dd => {
            const categories = ["", "Artisan", "Gaming", "Musical", "Other"];
            for (const cat of categories) dd.addOption(cat, cat || "(none)");
            dd.setValue(this.data.tool_category || "");
            dd.onChange(v => this.data.tool_category = (v || undefined) as any);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(container).setName("Ability").setDesc("e.g., 'Intelligence', 'Dexterity'").addText(t => {
            t.setPlaceholder("Intelligence").setValue(this.data.ability || "").onChange(v => this.data.ability = v.trim() || undefined);
            (t as any).inputEl.style.width = '18ch';
        });

        new Setting(container).setName("Utilize").setDesc("Comma-separated actions").addTextArea(ta => {
            const utilizeStr = this.data.utilize?.join(", ") || "";
            ta.setPlaceholder("Identify a substance (DC 15), Start a fire (DC 15)").setValue(utilizeStr).onChange(v => {
                if (v.trim()) {
                    this.data.utilize = v.split(",").map(u => u.trim()).filter(Boolean);
                } else {
                    this.data.utilize = undefined;
                }
            });
            (ta as any).inputEl.rows = 2;
            (ta as any).inputEl.style.width = '100%';
        });

        new Setting(container).setName("Craft").setDesc("Comma-separated craftable items").addTextArea(ta => {
            const craftStr = this.data.craft?.join(", ") || "";
            ta.setPlaceholder("Acid, Alchemist's Fire, Oil").setValue(craftStr).onChange(v => {
                if (v.trim()) {
                    this.data.craft = v.split(",").map(c => c.trim()).filter(Boolean);
                } else {
                    this.data.craft = undefined;
                }
            });
            (ta as any).inputEl.rows = 2;
            (ta as any).inputEl.style.width = '100%';
        });

        new Setting(container).setName("Variants").setDesc("Comma-separated variants").addTextArea(ta => {
            const variantsStr = this.data.variants?.join(", ") || "";
            ta.setPlaceholder("Dice (1 SP), Playing cards (5 SP)").setValue(variantsStr).onChange(v => {
                if (v.trim()) {
                    this.data.variants = v.split(",").map(va => va.trim()).filter(Boolean);
                } else {
                    this.data.variants = undefined;
                }
            });
            (ta as any).inputEl.rows = 2;
            (ta as any).inputEl.style.width = '100%';
        });
    }

    private buildGearFields(container: HTMLElement) {
        container.createEl("h4", { text: "Adventuring Gear Properties" });

        new Setting(container).setName("Category").setDesc("e.g., 'Container', 'Light Source'").addText(t => {
            t.setPlaceholder("Container").setValue(this.data.gear_category || "").onChange(v => this.data.gear_category = v.trim() || undefined);
            (t as any).inputEl.style.width = '18ch';
        });

        new Setting(container).setName("Capacity").setDesc("For containers").addText(t => {
            t.setPlaceholder("30 cubic feet / 300 lb.").setValue(this.data.capacity || "").onChange(v => this.data.capacity = v.trim() || undefined);
            (t as any).inputEl.style.width = '22ch';
        });

        new Setting(container).setName("Duration").setDesc("For consumables").addText(t => {
            t.setPlaceholder("1 hour").setValue(this.data.duration || "").onChange(v => this.data.duration = v.trim() || undefined);
            (t as any).inputEl.style.width = '12ch';
        });

        new Setting(container).setName("Special Use").setDesc("Special usage rules").addTextArea(ta => {
            ta.setPlaceholder("When you take the Attack action...").setValue(this.data.special_use || "").onChange(v => this.data.special_use = v.trim() || undefined);
            (ta as any).inputEl.rows = 3;
            (ta as any).inputEl.style.width = '100%';
        });
    }
}
