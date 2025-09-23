// src/apps/library/create-modal.ts
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "./core/creature-files";
import { listSpellFiles } from "./core/spell-files";
import { enhanceSelectToSearch } from "../../ui/search-dropdown";
import { mountCoreStatsSection } from "./create/section-core-stats";
import { mountEntriesSection } from "./create/section-entries";
import { mountSpellsKnownSection } from "./create/section-spells-known";

export class CreateCreatureModal extends Modal {
    private data: StatblockData;
    private onSubmit: (d: StatblockData) => void;
    private availableSpells: string[] = [];
    private _bgEl?: HTMLElement; private _bgPrevPointer?: string;

    constructor(app: App, presetName: string | undefined, onSubmit: (d: StatblockData) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.data = { name: presetName?.trim() || "Neue Kreatur" };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-cc-create-modal");

        // Prevent closing on outside click by disabling background pointer events
        const bg = document.querySelector('.modal-bg') as HTMLElement | null;
        if (bg) { this._bgEl = bg; this._bgPrevPointer = bg.style.pointerEvents; bg.style.pointerEvents = 'none'; }

        // (Dropdown-Suche entfernt — stattdessen echte Typeahead an Stellen mit vielen Optionen)

        contentEl.createEl("h3", { text: "Neuen Statblock erstellen" });
        // Asynchron: verfügbare Zauber laden (best effort)
        let spellsSectionControls: ReturnType<typeof mountSpellsKnownSection> | null = null;
        void (async () => {
            try {
                const spells = (await listSpellFiles(this.app)).map(f => f.basename).sort((a,b)=>a.localeCompare(b));
                this.availableSpells.splice(0, this.availableSpells.length, ...spells);
                spellsSectionControls?.refreshSpellMatches();
            }
            catch {}
        })();

        // Core Stats (kompakt) auslagern
        mountCoreStatsSection(contentEl, this.data);
        // Movement speeds (structured input → speedList strings)
        if (!this.data.speedList) this.data.speedList = [];
        const speedWrap = contentEl.createDiv({ cls: "setting-item" });
        speedWrap.createDiv({ cls: "setting-item-info", text: "Bewegung" });
        const speedCtl = speedWrap.createDiv({ cls: "setting-item-control sm-cc-move-ctl" });
        const addRow = speedCtl.createDiv({ cls: "sm-cc-searchbar sm-cc-move-row" });
        const typeSel = addRow.createEl("select") as HTMLSelectElement;
        const types = [
            ["walk","Gehen"],
            ["climb","Klettern"],
            ["fly","Fliegen"],
            ["swim","Schwimmen"],
            ["burrow","Graben"],
        ] as const;
        for (const [v,l] of types) { const o = typeSel.createEl("option", { text: l }); o.value = v; }
        enhanceSelectToSearch(typeSel, 'Such-dropdown…');
        // hover option only for fly
        const hoverWrap = addRow.createDiv();
        const hoverCb = hoverWrap.createEl("input", { attr: { type: "checkbox", id: "cb-hover" } }) as HTMLInputElement;
        hoverWrap.createEl("label", { text: "Hover", attr: { for: "cb-hover" } });
        const updateHover = () => { const isFly = typeSel.value === 'fly'; hoverWrap.style.display = isFly ? '' : 'none'; if (!isFly) hoverCb.checked = false; };
        updateHover(); typeSel.onchange = updateHover;
        // inline number with +/- controls (5ft steps) – placed after hover
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
        const addRow2 = speedCtl.createDiv({ cls: "sm-cc-searchbar sm-cc-move-addrow" });
        const addSpeedBtn = addRow2.createEl("button", { text: "+ Hinzufügen" });
        const listWrap = speedCtl.createDiv({ cls: "sm-cc-chips" });
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

        // Structured entries (Traits, Aktionen, …)
        mountEntriesSection(contentEl, this.data);

        // Known spells section
        spellsSectionControls = mountSpellsKnownSection(contentEl, this.data, () => this.availableSpells);

        // Buttons
        new Setting(contentEl)
            .addButton(b => b.setButtonText("Abbrechen").onClick(() => this.close()))
            .addButton(b => b.setCta().setButtonText("Erstellen").onClick(() => this.submit()));

        // Enter bestätigt NICHT automatisch (nur Button "Erstellen")
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
