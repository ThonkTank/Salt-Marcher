// src/apps/library/create/creature/modal.ts
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "../../core/creature-files";
import { listSpellFiles } from "../../core/spell-files";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import { mountCoreStatsSection } from "./section-core-stats";
import { mountEntriesSection } from "./section-entries";
import { mountSpellcastingSection } from "./section-spellcasting";
import { CREATURE_MOVEMENT_TYPES, type CreatureMovementType } from "./presets";
import { abilityMod, parseIntSafe } from "../shared/stat-utils";
import { mountTokenEditor } from "../shared/token-editor";

class CreaturePreviewModal extends Modal {
    constructor(app: App, private readonly data: StatblockData) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-preview-modal");
        contentEl.createEl("h3", { text: "Vorschau – aktuelle Eingaben" });
        const pre = contentEl.createEl("pre", { cls: "sm-cc-preview" });
        pre.textContent = JSON.stringify(this.data, null, 2);
    }
}

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private _bgEl?: HTMLElement; private _bgPrevPointer?: string;

    constructor(app: App, presetName: string | undefined, onSubmit: (d: StatblockData) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.data = {
            name: presetName?.trim() || "Neue Kreatur",
            resistances: [],
            immunities: [],
            vulnerabilities: [],
            equipmentNotes: "",
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");

        // Prevent closing on outside click by disabling background pointer events
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (bg) { this._bgEl = bg; this._bgPrevPointer = bg.style.pointerEvents; bg.style.pointerEvents = 'none'; }

        const wrapper = contentEl.createDiv({ cls: "sm-cc-create-wrapper" });

        const header = wrapper.createDiv({ cls: "sm-cc-create-header" });
        const breadcrumb = header.createDiv({ cls: "sm-cc-create-breadcrumb" });
        breadcrumb.createSpan({ cls: "sm-cc-crumb", text: "Bibliothek" });
        breadcrumb.createSpan({ cls: "sm-cc-crumb", text: "Statblocks" });
        breadcrumb.createSpan({ cls: "sm-cc-crumb", text: "Neue Kreatur" });
        const liveName = breadcrumb.createSpan({ cls: "sm-cc-crumb sm-cc-crumb--name", text: this.data.name || "Neue Kreatur" });

        const stepper = header.createDiv({ cls: "sm-cc-create-stepper" });
        const prevBtn = stepper.createEl("button", { cls: "sm-cc-stepper-btn", text: "← Zurück" });
        const stepLabel = stepper.createSpan({ cls: "sm-cc-stepper-label", text: "Grundwerte" });
        const nextBtn = stepper.createEl("button", { cls: "sm-cc-stepper-btn", text: "Weiter →" });

        const body = wrapper.createDiv({ cls: "sm-cc-create-body" });
        const leftColumn = body.createDiv({ cls: "sm-cc-create-column sm-cc-create-column--left" });
        const middleColumn = body.createDiv({ cls: "sm-cc-create-column sm-cc-create-column--middle" });
        const rightColumn = body.createDiv({ cls: "sm-cc-create-column sm-cc-create-column--right" });

        const steps: Array<{ el: HTMLElement; label: string }> = [
            { el: leftColumn, label: "Grundwerte" },
            { el: middleColumn, label: "Details" },
            { el: rightColumn, label: "Aktionen & Zauber" },
        ];
        let activeStep = 0;
        let scheduleUpdate: () => void = () => {};

        const focusFirstField = (el: HTMLElement) => {
            const focusable = el.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]:not([tabindex='-1'])");
            if (focusable) focusable.focus({ preventScroll: true });
        };

        const updateStep = (nextIndex: number, { scroll }: { scroll: boolean }) => {
            activeStep = nextIndex;
            steps.forEach((step, i) => step.el.toggleClass("is-active", i === activeStep));
            prevBtn.disabled = activeStep === 0;
            nextBtn.disabled = activeStep === steps.length - 1;
            stepLabel.setText(steps[activeStep]?.label ?? "");
            if (scroll) {
                steps[activeStep]?.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                setTimeout(() => focusFirstField(steps[activeStep]?.el), 120);
            }
        };

        prevBtn.onclick = () => { if (activeStep > 0) updateStep(activeStep - 1, { scroll: true }); };
        nextBtn.onclick = () => { if (activeStep < steps.length - 1) updateStep(activeStep + 1, { scroll: true }); };

        body.addEventListener("focusin", (ev) => {
            const column = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".sm-cc-create-column");
            if (!column) return;
            const index = steps.findIndex((step) => step.el === column);
            if (index >= 0 && index !== activeStep) updateStep(index, { scroll: false });
        });

        // Asynchron: verfügbare Zauber laden (best effort)
        let spellsSectionControls: ReturnType<typeof mountSpellcastingSection> | null = null;
        void (async () => {
            try {
                const spells = (await listSpellFiles(this.app)).map(f => f.basename).sort((a,b)=>a.localeCompare(b));
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
                spellsSectionControls?.refreshSpellMatches();
            }
            catch {}
        })();

        // Core Stats (kompakt) in linker Spalte
        mountCoreStatsSection(leftColumn, this.data);

        // Movement speeds (structured input → speedList strings) – mittlere Spalte
        if (!this.data.speedList) this.data.speedList = [];
        const movement = new Setting(middleColumn).setName("Bewegung");
        const movementContainer = movement.controlEl.createDiv({ cls: "sm-cc-move-ctl" });
        const addRow = movementContainer.createDiv({ cls: "sm-cc-searchbar sm-cc-move-row" });
        const typeSel = addRow.createEl("select") as HTMLSelectElement;
        for (const [value, label] of CREATURE_MOVEMENT_TYPES) { const option = typeSel.createEl("option", { text: label }); option.value = value; }
        enhanceSelectToSearch(typeSel, 'Such-dropdown…');
        const hoverWrap = addRow.createDiv();
        const hoverCb = hoverWrap.createEl("input", { attr: { type: "checkbox", id: "cb-hover" } }) as HTMLInputElement;
        hoverWrap.createEl("label", { text: "Hover", attr: { for: "cb-hover" } });
        const updateHover = () => { const cur = typeSel.value as CreatureMovementType; const isFly = cur === 'fly'; hoverWrap.style.display = isFly ? '' : 'none'; if (!isFly) hoverCb.checked = false; };
        updateHover(); typeSel.onchange = updateHover;
        const numWrap = addRow.createDiv({ cls: "sm-inline-number" });
        const valInp = numWrap.createEl("input", { attr: { type: "number", min: "0", step: "5", placeholder: "30" } }) as HTMLInputElement;
        const decBtn = numWrap.createEl("button", { text: "−", cls: "btn-compact" });
        const incBtn = numWrap.createEl("button", { text: "+", cls: "btn-compact" });
        const step = (dir: 1 | -1) => {
            const cur = parseInt(valInp.value, 10) || 0;
            const next = Math.max(0, cur + 5 * dir);
            valInp.value = String(next);
        };
        decBtn.onclick = () => step(-1);
        incBtn.onclick = () => step(1);
        const addRow2 = movementContainer.createDiv({ cls: "sm-cc-searchbar sm-cc-move-addrow" });
        const addSpeedBtn = addRow2.createEl("button", { text: "+ Hinzufügen" });
        const listWrap = movementContainer.createDiv({ cls: "sm-cc-chips" });
        const renderSpeeds = () => {
            listWrap.empty();
            this.data.speedList!.forEach((txt, i) => {
                const chip = listWrap.createDiv({ cls: 'sm-cc-chip' });
                chip.createSpan({ text: txt });
                const x = chip.createEl('button', { text: '×' });
                x.onclick = () => { this.data.speedList!.splice(i,1); renderSpeeds(); };
            });
        };
        renderSpeeds();
        addSpeedBtn.onclick = () => {
            const n = parseInt(valInp.value, 10);
            if (!Number.isFinite(n) || n <= 0) return;
            const kind = typeSel.value;
            const unit = 'ft.';
            const label = kind === 'walk'
                ? `${n} ${unit}`
                : (kind === 'fly' && hoverCb.checked ? `fly ${n} ${unit} (hover)` : `${kind} ${n} ${unit}`);
            this.data.speedList!.push(label);
            valInp.value = ""; hoverCb.checked = false; renderSpeeds();
        };

        type DefenseKey = "resistances" | "immunities" | "vulnerabilities";
        const ensureDefenseList = (key: DefenseKey) => {
            if (!this.data[key]) this.data[key] = [];
            return this.data[key]!;
        };
        const mountDefenseEditor = (label: string, key: DefenseKey, placeholder: string) => {
            ensureDefenseList(key);
            mountTokenEditor(middleColumn, label, {
                getItems: () => ensureDefenseList(key),
                add: (value) => ensureDefenseList(key).push(value),
                remove: (index) => ensureDefenseList(key).splice(index, 1),
            }, { placeholder, addButtonLabel: "+", onAdd: () => scheduleUpdate(), onRemove: () => scheduleUpdate() });
        };

        mountDefenseEditor("Resistances", "resistances", "z. B. fire; nicht-magische Waffen");
        mountDefenseEditor("Immunities", "immunities", "z. B. poison; charmed");
        mountDefenseEditor("Vulnerabilities", "vulnerabilities", "z. B. radiant damage");

        if (typeof this.data.equipmentNotes !== "string") this.data.equipmentNotes = "";
        const equipmentSetting = new Setting(middleColumn).setName("Equipment & Notes");
        equipmentSetting.addTextArea((ta) => {
            ta.setPlaceholder("Ausrüstung, Sonderregeln, Kampfnotizen…");
            ta.setValue(this.data.equipmentNotes || "");
            ta.inputEl.rows = 4;
            ta.inputEl.style.width = "100%";
            ta.inputEl.addEventListener("input", () => { this.data.equipmentNotes = ta.getValue(); });
        });

        // Structured entries (Traits, Aktionen, …) – rechte Spalte
        mountEntriesSection(rightColumn, this.data);

        // Spellcasting tab – rechte Spalte
        spellsSectionControls = mountSpellcastingSection(rightColumn, this.data, () => this.availableSpells, () => scheduleUpdate());

        const footer = wrapper.createDiv({ cls: "sm-cc-create-footer" });
        const chipRow = footer.createDiv({ cls: "sm-cc-footer-chips" });
        const makeChip = (label: string) => {
            const chip = chipRow.createDiv({ cls: "sm-cc-footer-chip" });
            chip.createSpan({ cls: "sm-cc-footer-chip__label", text: label });
            return chip.createSpan({ cls: "sm-cc-footer-chip__value", text: "-" });
        };
        const chipAc = makeChip("AC");
        const chipHp = makeChip("HP");
        const chipPassive = makeChip("Passive Perception");
        const chipCr = makeChip("CR");

        const footerStatus = footer.createDiv({ cls: "sm-cc-footer-status" });
        const footerActions = footer.createDiv({ cls: "sm-cc-footer-actions" });

        const cancelBtn = footerActions.createEl("button", { cls: "sm-cc-footer-btn", text: "Abbrechen" });
        cancelBtn.onclick = () => this.close();
        const saveBtn = footerActions.createEl("button", { cls: "sm-cc-footer-btn is-primary", text: "Speichern" });
        saveBtn.onclick = () => this.submit();
        const previewBtn = footerActions.createEl("button", { cls: "sm-cc-footer-btn", text: "Vorschau öffnen" });
        previewBtn.onclick = () => {
            const preview = new CreaturePreviewModal(this.app, this.data);
            preview.open();
        };

        const computePassive = () => {
            const wis = abilityMod(this.data.wis);
            const base = 10 + wis;
            const pb = parseIntSafe(this.data.pb);
            const profBonus = Number.isFinite(pb) ? pb : 0;
            let bonus = 0;
            const skills = new Set(this.data.skillsProf || []);
            const expertise = new Set(this.data.skillsExpertise || []);
            if (skills.has("Perception")) bonus += profBonus;
            if (expertise.has("Perception")) bonus += profBonus;
            return base + bonus;
        };

        const collectValidationIssues = (): string[] => {
            const issues: string[] = [];
            if (!this.data.name || !this.data.name.trim()) issues.push("Name fehlt");
            const hasEntries = Array.isArray(this.data.entries) && this.data.entries.length > 0;
            const hasActions = Array.isArray(this.data.entries) && this.data.entries.some((e) => e.category === 'action');
            const hasLegacyActions = Array.isArray(this.data.actionsList) && this.data.actionsList.length > 0;
            if (!hasEntries && !hasLegacyActions) issues.push("Mindestens einen Eintrag hinzufügen");
            else if (!hasActions && !hasLegacyActions) issues.push("Mindestens eine Aktion hinterlegen");
            const hasSpellcasting = () => {
                const listHasItems = (arr?: { length?: number } | null): boolean => Array.isArray(arr) && arr.length > 0;
                const mapHasItems = (map?: Record<string, unknown[]> | null): boolean =>
                    !!map && Object.values(map).some((arr) => Array.isArray(arr) && arr.length > 0);
                return (
                    listHasItems(this.data.spellsAtWill) ||
                    mapHasItems(this.data.spellsPerDay) ||
                    mapHasItems(this.data.spellsPerRest) ||
                    mapHasItems(this.data.spellsBySlot) ||
                    mapHasItems(this.data.spellsOther)
                );
            };
            if (hasSpellcasting()) {
                if (!this.data.spellcastingAbility?.trim()) issues.push("Zauber-Fähigkeit fehlt");
                const hasDc = !!this.data.spellSaveDc?.trim();
                const hasAttack = !!this.data.spellAttackBonus?.trim();
                if (!hasDc && !hasAttack) issues.push("Zauber-SG oder Angriffsbonus fehlt");
            }
            return issues;
        };

        const updateFooter = () => {
            chipAc.setText(this.data.ac?.trim() || "–");
            chipHp.setText(this.data.hp?.trim() || "–");
            const passive = computePassive();
            chipPassive.setText(Number.isFinite(passive) ? String(passive) : "–");
            chipCr.setText(this.data.cr?.trim() || "–");

            footerStatus.empty();
            const issues = collectValidationIssues();
            if (issues.length === 0) {
                footerStatus.createSpan({ cls: "sm-cc-footer-status__ok", text: "Bereit zum Speichern" });
            } else {
                const list = footerStatus.createDiv({ cls: "sm-cc-footer-status__warnings" });
                issues.forEach((msg) => { list.createSpan({ cls: "sm-cc-footer-warning", text: msg }); });
            }
            saveBtn.toggleClass("is-disabled", issues.length > 0);
            saveBtn.disabled = issues.length > 0;
        };

        const refreshName = () => {
            liveName.setText(this.data.name?.trim() || "Neue Kreatur");
        };

        scheduleUpdate = () => {
            requestAnimationFrame(() => {
                refreshName();
                updateFooter();
            });
        };

        wrapper.addEventListener("input", scheduleUpdate, true);
        wrapper.addEventListener("change", scheduleUpdate, true);
        wrapper.addEventListener("click", (ev) => {
            const target = ev.target as HTMLElement | null;
            if (target?.closest("button")) scheduleUpdate();
        }, true);

        refreshName();
        updateFooter();
        updateStep(0, { scroll: false });
    }

    onClose() { this.contentEl.empty(); if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; } }

    onunload() {
        if (this._bgEl) { this._bgEl.style.pointerEvents = this._bgPrevPointer ?? ''; this._bgEl = undefined; }
    }

    private submit() {
        if (!this.data.name || !this.data.name.trim()) return;
        this.close();
        this.onSubmit(this.data);
    }
}
