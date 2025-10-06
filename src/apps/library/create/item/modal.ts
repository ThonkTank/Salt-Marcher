// src/apps/library/create/item/modal.ts
import { App, Modal, Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { ItemData } from "../../core/item-files";
import { collectItemValidationIssues } from "./validation";

export class CreateItemModal extends Modal {
    private data: ItemData;
    private onSubmit: (d: ItemData) => void;
    private validationIssues: string[] = [];

    constructor(app: App, presetNameOrData: string | ItemData | undefined, onSubmit: (d: ItemData) => void) {
        super(app);
        this.onSubmit = onSubmit;

        // Accept either a string name or full ItemData
        if (typeof presetNameOrData === 'string') {
            this.data = { name: presetNameOrData?.trim() || "New Item" };
        } else if (presetNameOrData && typeof presetNameOrData === 'object') {
            this.data = presetNameOrData;
        } else {
            this.data = { name: "New Item" };
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");
        this.validationIssues = [];

        contentEl.createEl("h3", { text: "Create New Item" });

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

        new Setting(contentEl).setName("Description").setDesc("Main item description").addTextArea(ta => {
            ta.setPlaceholder("While wearing this armor...").setValue(this.data.description || "").onChange(v => this.data.description = v.trim() || undefined);
            // @ts-ignore
            (ta as any).inputEl.rows = 6;
            // @ts-ignore
            (ta as any).inputEl.style.width = '100%';
        });

        new Setting(contentEl).setName("Notes").setDesc("Additional notes").addTextArea(ta => {
            ta.setPlaceholder("Additional information...").setValue(this.data.notes || "").onChange(v => this.data.notes = v.trim() || undefined);
            // @ts-ignore
            (ta as any).inputEl.rows = 3;
            // @ts-ignore
            (ta as any).inputEl.style.width = '100%';
        });

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

        new Setting(contentEl).setName("Curse Description").addTextArea(ta => {
            ta.setPlaceholder("This armor is cursed...").setValue(this.data.curse_description || "").onChange(v => this.data.curse_description = v.trim() || undefined);
            // @ts-ignore
            (ta as any).inputEl.rows = 3;
            // @ts-ignore
            (ta as any).inputEl.style.width = '100%';
        });

        // === VALIDATION & SUBMIT ===
        const validationEl = contentEl.createDiv({ cls: "sm-cc-validation" });

        const submit = new Setting(contentEl).addButton(btn => {
            btn.setButtonText("Create Item").setCta().onClick(() => {
                this.validationIssues = collectItemValidationIssues(this.data);
                if (this.validationIssues.length > 0) {
                    validationEl.empty();
                    validationEl.createEl("p", { text: "Validation errors:", cls: "sm-cc-validation__title" });
                    const ul = validationEl.createEl("ul");
                    for (const issue of this.validationIssues) {
                        ul.createEl("li", { text: issue });
                    }
                    return;
                }
                this.onSubmit(this.data);
                this.close();
            });
        });

        submit.addButton(btn => {
            btn.setButtonText("Cancel").onClick(() => this.close());
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
