// src/apps/library/create/item/modal.ts
import { App, Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { ItemData } from "../../core/item-files";
import { collectItemValidationIssues } from "./validation";
import { BaseCreateModal } from "../../../../ui/workmode/create";

export class CreateItemModal extends BaseCreateModal<ItemData> {
    constructor(app: App, presetNameOrData: string | ItemData | undefined, onSubmit: (d: ItemData) => void) {
        super(app, presetNameOrData, onSubmit, {
            title: "Create New Item",
            defaultName: "New Item",
            validate: collectItemValidationIssues,
            submitButtonText: "Create Item",
        });
    }

    protected createDefault(name: string): ItemData {
        return { name };
    }

    protected buildFields(contentEl: HTMLElement): void {

        // === BASIC INFO ===
        contentEl.createEl("h4", { text: "Basic Information" });

        new Setting(contentEl).setName("Name").addText(t => {
            t.setPlaceholder("Flaming Longsword").setValue(this.data.name).onChange(v => this.data.name = v.trim());
            // @ts-ignore
            (t as any).inputEl.style.width = '28ch';
        });

        new Setting(contentEl).setName("Category").addDropdown(dd => {
            const categories = ["", "Armor", "Potion", "Ring", "Rod", "Scroll", "Staff", "Wand", "Weapon", "Wondrous Item"];
            for (const c of categories) dd.addOption(c, c || "(none)");
            dd.setValue(this.data.category || "");
            dd.onChange(v => this.data.category = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(contentEl).setName("Type").setDesc("e.g., 'Armor (Plate)', 'Weapon (Longsword)'").addText(t => {
            t.setPlaceholder("Weapon (Longsword)").setValue(this.data.type || "").onChange(v => this.data.type = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '28ch';
        });

        new Setting(contentEl).setName("Rarity").addDropdown(dd => {
            const rarities = ["", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];
            for (const r of rarities) dd.addOption(r, r || "(none)");
            dd.setValue(this.data.rarity || "");
            dd.onChange(v => this.data.rarity = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        // === ATTUNEMENT ===
        const attuneSetting = new Setting(contentEl).setName("Requires Attunement");
        attuneSetting.addToggle(t => {
            t.setValue(!!this.data.attunement);
            t.onChange(v => this.data.attunement = v || undefined);
        });

        new Setting(contentEl).setName("Attunement Requirement").setDesc("e.g., 'by a Cleric'").addText(t => {
            t.setPlaceholder("by a Druid, Sorcerer, Warlock, or Wizard").setValue(this.data.attunement_req || "").onChange(v => this.data.attunement_req = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '34ch';
        });

        // === CHARGES ===
        contentEl.createEl("h4", { text: "Charges System" });

        new Setting(contentEl).setName("Max Charges").addText(t => {
            t.setPlaceholder("10").setValue(this.data.max_charges?.toString() || "").onChange(v => {
                const num = parseInt(v);
                this.data.max_charges = Number.isFinite(num) ? num : undefined;
            });
            // @ts-ignore
            (t as any).inputEl.style.width = '8ch';
            // @ts-ignore
            (t as any).inputEl.type = 'number';
        });

        new Setting(contentEl).setName("Recharge Formula").setDesc("e.g., '1d6 + 4'").addText(t => {
            t.setPlaceholder("1d6 + 4").setValue(this.data.recharge_formula || "").onChange(v => this.data.recharge_formula = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '12ch';
        });

        new Setting(contentEl).setName("Recharge Time").addDropdown(dd => {
            const times = ["", "Dawn", "Dusk", "Long Rest", "Short Rest"];
            for (const time of times) dd.addOption(time, time || "(none)");
            dd.setValue(this.data.recharge_time || "");
            dd.onChange(v => this.data.recharge_time = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Search…'); } catch {}
        });

        new Setting(contentEl).setName("Destruction Risk").setDesc("e.g., 'On 1, turns to water'").addText(t => {
            t.setPlaceholder("On 1, turns to water and is destroyed").setValue(this.data.destruction_risk || "").onChange(v => this.data.destruction_risk = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '34ch';
        });

        // === PROPERTIES ===
        contentEl.createEl("h4", { text: "Properties & Effects" });

        this.addTextArea(contentEl, "Description", "While wearing this armor...",
            v => this.data.description = v.trim() || undefined, this.data.description, 6);

        this.addTextArea(contentEl, "Notes", "Additional information...",
            v => this.data.notes = v.trim() || undefined, this.data.notes, 3);

        // === WEIGHT & VALUE ===
        contentEl.createEl("h4", { text: "Weight & Value" });

        new Setting(contentEl).setName("Weight").addText(t => {
            t.setPlaceholder("5 pounds").setValue(this.data.weight || "").onChange(v => this.data.weight = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '12ch';
        });

        new Setting(contentEl).setName("Value").addText(t => {
            t.setPlaceholder("2,000 GP").setValue(this.data.value || "").onChange(v => this.data.value = v.trim() || undefined);
            // @ts-ignore
            (t as any).inputEl.style.width = '12ch';
        });

        // === CURSE ===
        contentEl.createEl("h4", { text: "Curse" });

        const cursedSetting = new Setting(contentEl).setName("Cursed Item");
        cursedSetting.addToggle(t => {
            t.setValue(!!this.data.cursed);
            t.onChange(v => this.data.cursed = v || undefined);
        });

        this.addTextArea(contentEl, "Curse Description", "This armor is cursed...",
            v => this.data.curse_description = v.trim() || undefined, this.data.curse_description, 3);
    }
}
