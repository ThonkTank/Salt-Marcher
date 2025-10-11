// src/apps/library/create/spell/modal.ts
import { App, Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { SpellData } from "../../core/spell-files";
import { collectSpellScalingIssues } from "./validation";
import { BaseCreateModal, createIrregularGrid, mountTokenEditor, type CreateModalPipeline } from "../../../../ui/workmode/create";

export interface SpellModalOptions<TSerialized = unknown, TResult = unknown> {
    pipeline?: CreateModalPipeline<SpellData, TSerialized, TResult>;
    onSubmit?: (data: SpellData) => Promise<void> | void;
}

export class CreateSpellModal<
    TSerialized = unknown,
    TResult = unknown
> extends BaseCreateModal<SpellData, TSerialized, TResult> {
    private runScalingValidation: (() => void) | null = null;

    constructor(app: App, preset: string | SpellData | undefined, options: SpellModalOptions<TSerialized, TResult>) {
        super(app, preset, {
            title: "Neuen Zauber erstellen",
            defaultName: "Neuer Zauber",
            submitButtonText: "Erstellen",
            pipeline: options.pipeline,
            onSubmit: options.onSubmit,
        });
    }

    protected createDefault(name: string): SpellData {
        return { name };
    }

    protected cloneData(data: SpellData): SpellData {
        return {
            ...data,
            components: data.components ? [...data.components] : undefined,
            classes: data.classes ? [...data.classes] : undefined,
        };
    }

    onOpen() {
        super.onOpen();
        this.runScalingValidation = null;
    }

    protected buildFields(contentEl: HTMLElement): void {

        // Basics
        new Setting(contentEl).setName("Name").addText(t => {
            t.setPlaceholder("Fireball").setValue(this.data.name).onChange(v => this.data.name = v.trim());
            // @ts-ignore
            (t as any).inputEl.style.width = '28ch';
        });
        new Setting(contentEl).setName("Grad").setDesc("0 = Zaubertrick").addDropdown(dd => {
            for (let i = 0; i <= 9; i++) dd.addOption(String(i), String(i));
            const initial = Number.isFinite(this.data.level) ? String(this.data.level) : "0";
            dd.setValue(initial);
            this.data.level = parseInt(initial, 10);
            dd.onChange(v => {
                const parsed = parseInt(v, 10);
                this.data.level = Number.isFinite(parsed) ? parsed : undefined;
                this.runScalingValidation?.();
            });
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        new Setting(contentEl).setName("Schule").addDropdown(dd => {
            const schools = ["", "Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
            for (const s of schools) dd.addOption(s, s || "(keine)");
            dd.setValue(this.data.school || "");
            dd.onChange(v => this.data.school = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        new Setting(contentEl).setName("Wirkzeit").addText(t => {
            t.setPlaceholder("1 Aktion").setValue(this.data.casting_time || "").onChange(v => this.data.casting_time = v.trim() || undefined);
            /* @ts-ignore */ (t as any).inputEl.style.width = '12ch';
        });
        new Setting(contentEl).setName("Reichweite").addText(t => {
            t.setPlaceholder("60 Fuß").setValue(this.data.range || "").onChange(v => this.data.range = v.trim() || undefined);
            /* @ts-ignore */ (t as any).inputEl.style.width = '12ch';
        });

        // Components
        const comps = new Setting(contentEl).setName("Komponenten");
        let cV = this.data.components?.includes("V") ?? false;
        let cS = this.data.components?.includes("S") ?? false;
        let cM = this.data.components?.includes("M") ?? false;
        const updateComps = () => {
            const arr: string[] = []; if (cV) arr.push("V"); if (cS) arr.push("S"); if (cM) arr.push("M");
            this.data.components = arr;
        };
        const componentGrid = createIrregularGrid(comps.controlEl, {
            columns: ["max-content", "max-content", "max-content", "max-content", "max-content", "max-content"],
            className: "sm-cc-component-grid",
        });
        const mkCb = (label: string, on: (v: boolean) => void, initial: boolean) => {
            const wrap = componentGrid.createCell("sm-cc-grid__save");
            const cb = wrap.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
            wrap.createEl("label", { text: label });
            cb.checked = initial;
            cb.addEventListener("change", () => { on(cb.checked); updateComps(); });
        };
        mkCb("V", v => cV = v, cV);
        mkCb("S", v => cS = v, cS);
        mkCb("M", v => { cM = v; }, cM);
        updateComps();
        new Setting(contentEl).setName("Materialien").addText(t => {
            t.setPlaceholder("winzige Kugel aus Guano und Schwefel").setValue(this.data.materials || "").onChange(v => this.data.materials = v.trim() || undefined);
            /* @ts-ignore */ (t as any).inputEl.style.width = '34ch';
        });

        new Setting(contentEl).setName("Dauer").addText(t => {
            t.setPlaceholder("Augenblicklich / Konzentration, bis zu 1 Minute").setValue(this.data.duration || "").onChange(v => this.data.duration = v.trim() || undefined);
            /* @ts-ignore */ (t as any).inputEl.style.width = '34ch';
        });
        const flags = new Setting(contentEl).setName("Flags");
        const cbConc = flags.controlEl.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement; flags.controlEl.createEl("label", { text: "Konzentration" });
        cbConc.checked = !!this.data.concentration;
        cbConc.addEventListener("change", () => this.data.concentration = cbConc.checked);
        const cbRit = flags.controlEl.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement; flags.controlEl.createEl("label", { text: "Ritual" });
        cbRit.checked = !!this.data.ritual;
        cbRit.addEventListener("change", () => this.data.ritual = cbRit.checked);

        // Targeting / Damage
        new Setting(contentEl).setName("Angriff").addDropdown(dd => {
            const opts = ["","Melee Spell Attack","Ranged Spell Attack","Melee Weapon Attack","Ranged Weapon Attack"];
            for (const s of opts) dd.addOption(s, s || "(kein)");
            dd.setValue(this.data.attack || "");
            dd.onChange(v => this.data.attack = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        const save = new Setting(contentEl).setName("Rettungswurf");
        save.addDropdown(dd => {
            const abil = ["","STR","DEX","CON","INT","WIS","CHA"];
            for (const a of abil) dd.addOption(a, a || "(kein)");
            dd.setValue(this.data.save_ability || "");
            dd.onChange(v => this.data.save_ability = v || undefined);
            try { enhanceSelectToSearch((dd as any).selectEl, 'Such-dropdown…'); } catch {}
        });
        // Effekt (kompakt, klare Beschriftung)
        save.controlEl.createEl('label', { text: 'Effekt' });
        save.addText(t => { t.setPlaceholder("Half on save / Negates …").setValue(this.data.save_effect || "").onChange(v => this.data.save_effect = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '18ch'; });
        const dmg = new Setting(contentEl).setName("Schaden");
        dmg.controlEl.createEl('label', { text: 'Würfel' });
        dmg.addText(t => { t.setPlaceholder("8d6").setValue(this.data.damage || "").onChange(v => this.data.damage = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '10ch'; });
        dmg.controlEl.createEl('label', { text: 'Typ' });
        dmg.addText(t => { t.setPlaceholder("fire / radiant …").setValue(this.data.damage_type || "").onChange(v => this.data.damage_type = v.trim() || undefined); /* @ts-ignore */ (t as any).inputEl.style.width = '12ch'; });

        // Classes (as chips)
        if (!this.data.classes) this.data.classes = [];
        mountTokenEditor(contentEl, "Klassen", {
            getItems: () => this.data.classes!,
            add: (value) => this.data.classes!.push(value),
            remove: (index) => this.data.classes!.splice(index, 1),
        });

        // Text
        this.addTextArea(contentEl, "Beschreibung", "Beschreibung (Markdown)",
            v => this.data.description = v, this.data.description);

        const higherLevelsField = this.addTextArea(contentEl, "Höhere Grade", "Bei höheren Graden (Markdown)",
            v => {
                const trimmed = v.trim();
                this.data.higher_levels = trimmed ? trimmed : undefined;
                this.runScalingValidation?.();
            },
            this.data.higher_levels);
        const scalingValidation = higherLevelsField.controlEl.createDiv({ cls: "sm-setting-validation", attr: { hidden: "" } });
        const applyScalingValidation = (issues: string[]) => {
            const hasIssues = issues.length > 0;
            higherLevelsField.wrapper.toggleClass("is-invalid", hasIssues);
            if (!hasIssues) {
                scalingValidation.setAttribute("hidden", "");
                scalingValidation.classList.remove("is-visible");
                scalingValidation.empty();
                return;
            }
            scalingValidation.removeAttribute("hidden");
            scalingValidation.classList.add("is-visible");
            scalingValidation.empty();
            const list = scalingValidation.createEl("ul");
            for (const issue of issues) list.createEl("li", { text: issue });
        };
        this.runScalingValidation = () => {
            const issues = collectSpellScalingIssues(this.data);
            applyScalingValidation(issues);
            return issues;
        };
        this.runScalingValidation();
    }

    protected async submit(): Promise<void> {
        // Run scaling validation
        const scalingIssues = this.runScalingValidation?.() ?? [];
        if (scalingIssues.length > 0) return;

        // Delegate to base class for standard validation and submit
        await super.submit();
    }
}
