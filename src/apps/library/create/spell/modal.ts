// src/apps/library/create/spell/modal.ts
import { App, Modal, Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import { mountTokenEditor } from "../shared/token-editor";
import type { SpellData } from "../../core/spell-files";
import {
    SPELL_ATTACK_OPTIONS,
    SPELL_GRADES,
    SPELL_SAVE_ABILITIES,
    SPELL_SCHOOLS,
} from "./presets";

export class CreateSpellModal extends Modal {
    private data: SpellData;
    private onSubmit: (d: SpellData) => void;

    constructor(app: App, presetName: string | undefined, onSubmit: (d: SpellData) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.data = { name: presetName?.trim() || "Neuer Zauber" };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");

        contentEl.createEl("h3", { text: "Neuen Zauber erstellen" });

        // Basics
        new Setting(contentEl).setName("Name").addText(t => {
            t.setPlaceholder("Fireball").setValue(this.data.name).onChange(v => this.data.name = v.trim());
            // @ts-ignore
            (t as any).inputEl.style.width = '28ch';
        });
        new Setting(contentEl).setName("Grad").setDesc("0 = Zaubertrick").addDropdown(dd => {
            for (const grade of SPELL_GRADES) dd.addOption(String(grade), String(grade));
            dd.onChange(v => this.data.level = parseInt(v, 10));
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        new Setting(contentEl).setName("Schule").addDropdown(dd => {
            for (const school of SPELL_SCHOOLS) dd.addOption(school, school);
            dd.onChange(v => this.data.school = v);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        new Setting(contentEl).setName("Wirkzeit").addText(t => { t.setPlaceholder("1 Aktion").onChange(v => this.data.casting_time = v.trim()); /* @ts-ignore */ (t as any).inputEl.style.width = '12ch'; });
        new Setting(contentEl).setName("Reichweite").addText(t => { t.setPlaceholder("60 Fuß").onChange(v => this.data.range = v.trim()); /* @ts-ignore */ (t as any).inputEl.style.width = '12ch'; });

        // Components
        const comps = new Setting(contentEl).setName("Komponenten");
        let cV = false, cS = false, cM = false;
        const updateComps = () => {
            const arr: string[] = []; if (cV) arr.push("V"); if (cS) arr.push("S"); if (cM) arr.push("M");
            this.data.components = arr;
        };
        comps.controlEl.style.display = 'grid';
        comps.controlEl.style.gridTemplateColumns = 'repeat(6, max-content)';
        const mkCb = (label: string, on: (v: boolean) => void) => {
            const wrap = comps.controlEl.createDiv({ cls: "sm-cc-grid__save" });
            const cb = wrap.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
            wrap.createEl("label", { text: label });
            cb.addEventListener("change", () => { on(cb.checked); updateComps(); });
        };
        mkCb("V", v => cV = v);
        mkCb("S", v => cS = v);
        mkCb("M", v => { cM = v; updateComps(); });
        new Setting(contentEl).setName("Materialien").addText(t => { t.setPlaceholder("winzige Kugel aus Guano und Schwefel").onChange(v => this.data.materials = v.trim()); /* @ts-ignore */ (t as any).inputEl.style.width = '34ch'; });

        new Setting(contentEl).setName("Dauer").addText(t => { t.setPlaceholder("Augenblicklich / Konzentration, bis zu 1 Minute").onChange(v => this.data.duration = v.trim()); /* @ts-ignore */ (t as any).inputEl.style.width = '34ch'; });
        const flags = new Setting(contentEl).setName("Flags");
        const cbConc = flags.controlEl.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement; flags.controlEl.createEl("label", { text: "Konzentration" });
        const cbRit = flags.controlEl.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement; flags.controlEl.createEl("label", { text: "Ritual" });
        cbConc.addEventListener("change", () => this.data.concentration = cbConc.checked);
        cbRit.addEventListener("change", () => this.data.ritual = cbRit.checked);

        // Targeting / Damage
        new Setting(contentEl).setName("Angriff").addDropdown(dd => {
            for (const option of SPELL_ATTACK_OPTIONS) dd.addOption(option, option || "(kein)");
            dd.onChange(v => this.data.attack = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        const save = new Setting(contentEl).setName("Rettungswurf");
        save.addDropdown(dd => {
            for (const ability of SPELL_SAVE_ABILITIES) dd.addOption(ability, ability || "(kein)");
            dd.onChange(v => this.data.save_ability = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        // Effekt (kompakt, klare Beschriftung)
        save.controlEl.createEl('label', { text: 'Effekt' });
        save.addText(t => { t.setPlaceholder("Half on save / Negates …").onChange(v => this.data.save_effect = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '18ch'; });
        const dmg = new Setting(contentEl).setName("Schaden");
        dmg.controlEl.createEl('label', { text: 'Würfel' });
        dmg.addText(t => { t.setPlaceholder("8d6").onChange(v => this.data.damage = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '10ch'; });
        dmg.controlEl.createEl('label', { text: 'Typ' });
        dmg.addText(t => { t.setPlaceholder("fire / radiant …").onChange(v => this.data.damage_type = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '12ch'; });

        // Classes (as chips)
        if (!this.data.classes) this.data.classes = [];
        mountTokenEditor(contentEl, "Klassen", {
            getItems: () => this.data.classes!,
            add: (value) => this.data.classes!.push(value),
            remove: (index) => this.data.classes!.splice(index, 1),
        });

        // Text
        this.addTextArea(contentEl, "Beschreibung", "Beschreibung (Markdown)", v => this.data.description = v);
        this.addTextArea(contentEl, "Höhere Grade", "Bei höheren Graden (Markdown)", v => this.data.higher_levels = v);

        new Setting(contentEl)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        this.scope.register([], "Enter", () => this.submit());
    }

    onClose() { this.contentEl.empty(); }

    private addTextArea(parent: HTMLElement, label: string, placeholder: string, onChange: (v: string) => void) {
        const wrap = parent.createDiv({ cls: "setting-item" });
        wrap.createDiv({ cls: "setting-item-info", text: label });
        const ctl = wrap.createDiv({ cls: "setting-item-control" });
        const ta = ctl.createEl("textarea", { attr: { placeholder } });
        ta.addEventListener("input", () => onChange(ta.value));
    }

    private submit() {
        if (!this.data.name || !this.data.name.trim()) return;
        this.close();
        this.onSubmit(this.data);
    }
}
