// src/apps/library/create-modal.ts
import { App, Modal, Setting } from "obsidian";
import type { StatblockData } from "./core/creature-files";
import { listSpellFiles } from "./core/spell-files";
import { enhanceSelectToSearch } from "../../ui/search-dropdown";

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
        void (async () => {
            try { this.availableSpells = (await listSpellFiles(this.app)).map(f => f.basename).sort((a,b)=>a.localeCompare(b)); }
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

        // Mods werden innerhalb der Core-Stats‑Sektion berechnet

        // PB needed for saves and skills
        // PB now part of core stats row above

        // Skills panel (proficiency + expertise)
        // Stats table
        const ensureSets = () => {
            if (!this.data.skillsProf) this.data.skillsProf = [];
            if (!this.data.skillsExpertise) this.data.skillsExpertise = [];
            if (!this.data.saveProf) this.data.saveProf = {};
        };
        const statsSection = contentEl.createDiv({ cls: "sm-cc-skills" });
        statsSection.createEl("h4", { text: "Stats" });
        const statsTbl = statsSection.createDiv({ cls: "sm-cc-table sm-cc-stats-table" });
        const statsHeader = statsTbl.createDiv({ cls: "sm-cc-row sm-cc-header" });
        ;["Name","Wert","Mod","Save","Save Mod"].forEach(h => statsHeader.createDiv({ cls: "sm-cc-cell", text: h }));
        const statDefs = [
            { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
            { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
        ] as const;
        for (const s of statDefs) {
            const row = statsTbl.createDiv({ cls: "sm-cc-row" });
            row.createDiv({ cls: "sm-cc-cell", text: s.label });
            const scoreCell = row.createDiv({ cls: "sm-cc-cell sm-inline-number" });
            const score = scoreCell.createEl("input", { attr: { type: "number", placeholder: "10", min: "0", step: "1" } }) as HTMLInputElement;
            const scoreDec = scoreCell.createEl("button", { text: "−", cls: "btn-compact" });
            const scoreInc = scoreCell.createEl("button", { text: "+", cls: "btn-compact" });
            score.value = (this.data as any)[s.key] || "";
            score.addEventListener("input", () => { (this.data as any)[s.key] = score.value.trim(); updateModifiers(); });
            const step1 = (dir: 1 | -1) => {
                const cur = parseInt(score.value, 10) || 0;
                const next = Math.max(0, cur + 1 * dir);
                score.value = String(next);
                (this.data as any)[s.key] = score.value.trim();
                updateModifiers();
            };
            scoreDec.onclick = () => step1(-1);
            scoreInc.onclick = () => step1(1);
            const modOut = row.createDiv({ cls: "sm-cc-cell", text: "+0" });
            const saveCb = row.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
            const saveOut = row.createDiv({ cls: "sm-cc-cell", text: "+0" });
            ensureSets(); saveCb.checked = !!(this.data.saveProf as any)[s.key];
            saveCb.addEventListener("change", () => { (this.data.saveProf as any)[s.key] = saveCb.checked; updateModifiers(); });
            abilityElems.set(s.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
        }

        // Skills table
        const skillsSection = contentEl.createDiv({ cls: "sm-cc-skills" });
        skillsSection.createEl("h4", { text: "Fertigkeiten" });
        const skillsTbl = skillsSection.createDiv({ cls: "sm-cc-table sm-cc-skills-table" });
        const skillsHeader = skillsTbl.createDiv({ cls: "sm-cc-row sm-cc-header" });
        ;["Name","Prof","Expertise","Mod"].forEach(h => skillsHeader.createDiv({ cls: "sm-cc-cell", text: h }));
        const skillsList = [
            ['Athletics','str'],
            ['Acrobatics','dex'],['Sleight of Hand','dex'],['Stealth','dex'],
            ['Arcana','int'],['History','int'],['Investigation','int'],['Nature','int'],['Religion','int'],
            ['Animal Handling','wis'],['Insight','wis'],['Medicine','wis'],['Perception','wis'],['Survival','wis'],
            ['Deception','cha'],['Intimidation','cha'],['Performance','cha'],['Persuasion','cha'],
        ] as Array<[string,string]>;
        for (const [name, abil] of skillsList) {
            const row = skillsTbl.createDiv({ cls: "sm-cc-row" });
            row.createDiv({ cls: "sm-cc-cell", text: name });
            const cbP = row.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
            const cbE = row.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
            const out = row.createDiv({ cls: "sm-cc-cell", text: "+0" });
            ensureSets();
            cbP.checked = !!this.data.skillsProf?.includes(name);
            cbE.checked = !!this.data.skillsExpertise?.includes(name);
            cbP.addEventListener("change", () => {
                ensureSets();
                const arr = this.data.skillsProf!;
                if (cbP.checked && !arr.includes(name)) arr.push(name); else if (!cbP.checked) this.data.skillsProf = arr.filter(s => s !== name);
                updateModifiers();
            });
            cbE.addEventListener("change", () => {
                ensureSets();
                const arr = this.data.skillsExpertise!;
                if (cbE.checked && !arr.includes(name)) arr.push(name); else if (!cbE.checked) this.data.skillsExpertise = arr.filter(s => s !== name);
                updateModifiers();
            });
            skillElems.push({ ability: abil, prof: cbP, exp: cbE, out });
        }
        // Initial compute
        updateModifiers();
        // Initial compute
        updateModifiers();

        // Sinne/Sprachen sind innerhalb der Core‑Stats‑Sektion enthalten

        // CR/XP now part of core stats row above

        // Structured entries (DNDbereit): Trait/Aktion/Bonus/Reaktion/Legendär
        if (!this.data.entries) this.data.entries = [];
        const entriesWrap = contentEl.createDiv({ cls: "setting-item sm-cc-entries" });
        entriesWrap.createDiv({ cls: "setting-item-info", text: "Einträge (Traits, Aktionen, …)" });
        const entriesCtl = entriesWrap.createDiv({ cls: "setting-item-control" });
        const addBar = entriesCtl.createDiv({ cls: "sm-cc-searchbar" });
        const catSel = addBar.createEl("select") as HTMLSelectElement;
        enhanceSelectToSearch(catSel, 'Such-dropdown…');
        
        const catMap = [["trait","Eigenschaft"],["action","Aktion"],["bonus","Bonusaktion"],["reaction","Reaktion"],["legendary","Legendäre Aktion"]] as const;
        for (const [v,l] of catMap) { const o = catSel.createEl("option", { text: l }); o.value = v; }
        const addEntryBtn = addBar.createEl("button", { text: "+ Eintrag" });
        /*
            { key: 'sickle', label: 'Sickle', entry: { category: 'action', name: 'Sickle', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d4', ability: 'str', bonus: 'slashing' } }},
            { key: 'spear', label: 'Spear (versatile 1d8, thrown 20/60)', entry: { category: 'action', name: 'Spear', kind: 'Melee or Ranged Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft. or range 20/60 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'str', bonus: 'piercing' } }},
            // Weapons – Simple ranged
            { key: 'light_crossbow', label: 'Light Crossbow (loading, range 80/320)', entry: { category: 'action', name: 'Light Crossbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 80/320 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'dex', bonus: 'piercing' } }},
            { key: 'dart', label: 'Dart (finesse, thrown 20/60)', entry: { category: 'action', name: 'Dart', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'best_of_str_dex', proficient: true }, range: 'range 20/60 ft.', target: 'one target', damage_from: { dice: '1d4', ability: 'best_of_str_dex', bonus: 'piercing' } }},
            { key: 'shortbow', label: 'Shortbow (range 80/320)', entry: { category: 'action', name: 'Shortbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 80/320 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'dex', bonus: 'piercing' } }},
            { key: 'sling', label: 'Sling (range 30/120)', entry: { category: 'action', name: 'Sling', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 30/120 ft.', target: 'one target', damage_from: { dice: '1d4', ability: 'dex' } }},
            // Weapons – Martial melee
            { key: 'battleaxe', label: 'Battleaxe (versatile 1d10)', entry: { category: 'action', name: 'Battleaxe', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'slashing' } }},
            { key: 'flail', label: 'Flail', entry: { category: 'action', name: 'Flail', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'bludgeoning' } }},
            { key: 'glaive', label: 'Glaive (reach)', entry: { category: 'action', name: 'Glaive', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d10', ability: 'str', bonus: 'slashing' } }},
            { key: 'greataxe', label: 'Greataxe (heavy, two-handed)', entry: { category: 'action', name: 'Greataxe', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d12', ability: 'str', bonus: 'slashing' } }},
            { key: 'greatsword', label: 'Greatsword (heavy, two-handed)', entry: { category: 'action', name: 'Greatsword', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '2d6', ability: 'str', bonus: 'slashing' } }},
            { key: 'halberd', label: 'Halberd (reach)', entry: { category: 'action', name: 'Halberd', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d10', ability: 'str', bonus: 'slashing' } }},
            { key: 'lance', label: 'Lance (reach, special)', entry: { category: 'action', name: 'Lance', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d12', ability: 'str', bonus: 'piercing' } }},
            { key: 'longsword', label: 'Longsword (versatile 1d10)', entry: { category: 'action', name: 'Longsword', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'slashing' } }},
            { key: 'maul', label: 'Maul (heavy, two-handed)', entry: { category: 'action', name: 'Maul', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '2d6', ability: 'str', bonus: 'bludgeoning' } }},
            { key: 'morningstar', label: 'Morningstar', entry: { category: 'action', name: 'Morningstar', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'piercing' } }},
            { key: 'pike', label: 'Pike (reach, two-handed)', entry: { category: 'action', name: 'Pike', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d10', ability: 'str', bonus: 'piercing' } }},
            { key: 'rapier', label: 'Rapier (finesse)', entry: { category: 'action', name: 'Rapier', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'best_of_str_dex', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'best_of_str_dex', bonus: 'piercing' } }},
            { key: 'scimitar', label: 'Scimitar (finesse)', entry: { category: 'action', name: 'Scimitar', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'best_of_str_dex', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'best_of_str_dex', bonus: 'slashing' } }},
            { key: 'shortsword', label: 'Shortsword (finesse)', entry: { category: 'action', name: 'Shortsword', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'best_of_str_dex', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'best_of_str_dex', bonus: 'piercing' } }},
            { key: 'trident', label: 'Trident (versatile 1d8, thrown 20/60)', entry: { category: 'action', name: 'Trident', kind: 'Melee or Ranged Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft. or range 20/60 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'str', bonus: 'piercing' } }},
            { key: 'war_pick', label: 'War Pick', entry: { category: 'action', name: 'War Pick', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'piercing' } }},
            { key: 'warhammer', label: 'Warhammer (versatile 1d10)', entry: { category: 'action', name: 'Warhammer', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'bludgeoning' } }},
            { key: 'whip', label: 'Whip (finesse, reach)', entry: { category: 'action', name: 'Whip', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'best_of_str_dex', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d4', ability: 'best_of_str_dex', bonus: 'slashing' } }},
            // Weapons – Martial ranged
            { key: 'blowgun', label: 'Blowgun (range 25/100)', entry: { category: 'action', name: 'Blowgun', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 25/100 ft.', target: 'one target', damage_from: { dice: '1', ability: undefined, bonus: 'piercing' } }},
            { key: 'hand_crossbow', label: 'Hand Crossbow (light, loading, 30/120)', entry: { category: 'action', name: 'Hand Crossbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 30/120 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'dex', bonus: 'piercing' } }},
            { key: 'heavy_crossbow', label: 'Heavy Crossbow (heavy, loading, 100/400)', entry: { category: 'action', name: 'Heavy Crossbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 100/400 ft.', target: 'one target', damage_from: { dice: '1d10', ability: 'dex', bonus: 'piercing' } }},
            { key: 'longbow', label: 'Longbow (heavy, 150/600)', entry: { category: 'action', name: 'Longbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 150/600 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'dex', bonus: 'piercing' } }},
            { key: 'net', label: 'Net (special, 5/15)', entry: { category: 'action', name: 'Net', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 5/15 ft.', target: 'one target', text: 'A Large or smaller creature hit by a net is restrained until it is freed.' }},
            { key: 'pack_tactics', label: 'Pack Tactics (Trait)', entry: { category: 'trait', name: 'Pack Tactics', text: "The creature has advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally isn't incapacitated." }},
            { key: 'keen_senses', label: 'Keen Senses (Trait)', entry: { category: 'trait', name: 'Keen Senses', text: 'The creature has advantage on Wisdom (Perception) checks that rely on sight, hearing, or smell.' }},
            { key: 'amphibious', label: 'Amphibious (Trait)', entry: { category: 'trait', name: 'Amphibious', text: 'The creature can breathe air and water.' }},
            { key: 'spider_climb', label: 'Spider Climb (Trait)', entry: { category: 'trait', name: 'Spider Climb', text: 'The creature can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.' }},
            { key: 'sunlight_sensitivity', label: 'Sunlight Sensitivity (Trait)', entry: { category: 'trait', name: 'Sunlight Sensitivity', text: 'While in sunlight, the creature has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.' }},
            { key: 'magic_resistance', label: 'Magic Resistance (Trait)', entry: { category: 'trait', name: 'Magic Resistance', text: 'The creature has advantage on saving throws against spells and other magical effects.' }},
            { key: 'magic_weapons', label: 'Magic Weapons (Trait)', entry: { category: 'trait', name: 'Magic Weapons', text: "The creature's weapon attacks are magical." }},
            { key: 'flyby', label: 'Flyby (Trait)', entry: { category: 'trait', name: 'Flyby', text: "The creature doesn't provoke opportunity attacks when it flies out of an enemy's reach." }},
            { key: 'hold_breath', label: 'Hold Breath (Trait)', entry: { category: 'trait', name: 'Hold Breath', text: 'The creature can hold its breath for 15 minutes.' }},
            { key: 'regeneration', label: 'Regeneration (Trait)', entry: { category: 'trait', name: 'Regeneration', text: 'The creature regains 10 hit points at the start of its turn if it has at least 1 hit point.' }},
            { key: 'legendary_resistance', label: 'Legendary Resistance (3/Day) (Legendär)', entry: { category: 'legendary', name: 'Legendary Resistance (3/Day)', text: 'If the creature fails a saving throw, it can choose to succeed instead.' }},
        */
        
        // (Global preset row removed; presets are integrated per entry)
        const entriesHost = entriesCtl.createDiv();
        let focusEntryIdx: number | null = null;
        addEntryBtn.onclick = () => { this.data.entries!.unshift({ category: catSel.value as any, name: "" }); focusEntryIdx = 0; renderEntries(); };
        const renderEntries = () => {
            entriesHost.empty();
            this.data.entries!.forEach((e, i) => {
                const box = entriesHost.createDiv({ cls: "sm-cc-skill-group" });
                const head = box.createDiv({ cls: "sm-cc-skill sm-cc-entry-head" });
                const c = head.createEl("select") as HTMLSelectElement; for (const [v,l] of catMap) { const o = c.createEl("option", { text: l }); o.value = v; if (v===e.category) o.selected = true; } c.onchange = () => e.category = c.value as any; enhanceSelectToSearch(c, 'Such-dropdown…');
                head.createEl('label', { text: 'Name' });
                const name = head.createEl("input", { cls: "sm-cc-entry-name", attr: { type: "text", placeholder: "Name (z. B. Multiattack)" } }) as HTMLInputElement; name.value = e.name || ""; name.oninput = () => e.name = name.value.trim();
                if (focusEntryIdx === i) { setTimeout(() => name.focus(), 0); focusEntryIdx = null; }
                const del = head.createEl("button", { text: "🗑" }); del.onclick = () => { this.data.entries!.splice(i,1); renderEntries(); };
                const grid = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
                grid.createEl('label', { text: 'Art' });
                const kind = grid.createEl("input", { attr: { type: "text", placeholder: "Melee/Ranged …", 'aria-label': 'Art' } }) as HTMLInputElement; kind.value = e.kind || ""; kind.oninput = () => e.kind = kind.value.trim() || undefined; (kind.style as any).width = '24ch';
                grid.createEl('label', { text: 'Reichweite' });
                const rng = grid.createEl("input", { attr: { type: "text", placeholder: "reach 5 ft. / range 30 ft.", 'aria-label': 'Reichweite' } }) as HTMLInputElement; rng.value = e.range || ""; rng.oninput = () => e.range = rng.value.trim() || undefined; (rng.style as any).width = '30ch';
                grid.createEl('label', { text: 'Ziel' });
                const tgt = grid.createEl("input", { attr: { type: "text", placeholder: "one target", 'aria-label': 'Ziel' } }) as HTMLInputElement; tgt.value = e.target || ""; tgt.oninput = () => e.target = tgt.value.trim() || undefined; (tgt.style as any).width = '16ch';
                // Auto compute section (to hit / damage from stats) — grouped with labels
                const autoRow = box.createDiv({ cls: "sm-cc-auto" });
                const hitGroup = autoRow.createDiv({ cls: 'sm-auto-group' });
                hitGroup.createSpan({ text: 'To hit:' });
                const toHitAbil = hitGroup.createEl('select') as HTMLSelectElement; ['','best_of_str_dex','str','dex','con','int','wis','cha'].forEach(v=>{ const o=toHitAbil.createEl('option',{ text: v||'(von)' }); o.value=v; });
                enhanceSelectToSearch(toHitAbil, 'Such-dropdown…');
                const toHitProf = hitGroup.createEl('input', { attr: { type: 'checkbox', id: `hit-prof-${i}` } }) as HTMLInputElement; hitGroup.createEl('label', { text: 'Prof', attr: { for: `hit-prof-${i}` } });
                const hit = hitGroup.createEl('input', { cls: 'sm-auto-tohit', attr: { type: 'text', placeholder: '+7', 'aria-label': 'To hit' } }) as HTMLInputElement; hit.value = e.to_hit || ''; hit.addEventListener('input', () => e.to_hit = hit.value.trim() || undefined); (hit.style as any).width = '6ch';
                const dmgGroup = autoRow.createDiv({ cls: 'sm-auto-group' });
                dmgGroup.createSpan({ text: 'Damage:' });
                const dmgDice = dmgGroup.createEl('input', { attr: { type: 'text', placeholder: '1d8', 'aria-label': 'Würfel' } }) as HTMLInputElement; (dmgDice.style as any).width = '10ch';
                const dmgAbil = dmgGroup.createEl('select') as HTMLSelectElement; ['','best_of_str_dex','str','dex','con','int','wis','cha'].forEach(v=>{ const o=dmgAbil.createEl('option',{ text: v||'(von)' }); o.value=v; });
                enhanceSelectToSearch(dmgAbil, 'Such-dropdown…');
                const dmgBonus = dmgGroup.createEl('input', { attr: { type: 'text', placeholder: 'piercing / slashing …', 'aria-label': 'Art' } }) as HTMLInputElement; (dmgBonus.style as any).width = '12ch';
                const dmg = dmgGroup.createEl('input', { cls: 'sm-auto-dmg', attr: { type: 'text', placeholder: '1d8 +3 piercing', 'aria-label': 'Schaden' } }) as HTMLInputElement; dmg.value = e.damage || ''; dmg.addEventListener('input', () => e.damage = dmg.value.trim() || undefined); (dmg.style as any).width = '20ch';
                const applyAuto = () => {
                    // store formulas
                    e.to_hit_from = toHitAbil.value ? { ability: toHitAbil.value as any, proficient: toHitProf.checked } : undefined;
                    e.damage_from = dmgDice.value ? { dice: dmgDice.value.trim(), ability: dmgAbil.value ? (dmgAbil.value as any) : undefined, bonus: dmgBonus.value.trim() || undefined } : undefined;
                    // compute previews
                    const parseIntSafe = (v?: string) => { const m = String(v ?? '').match(/-?\d+/); return m ? parseInt(m[0], 10) : NaN; };
                    const abilityMod = (score?: string) => { const n = parseIntSafe(score); if (Number.isNaN(n)) return 0; return Math.floor((n - 10) / 2); };
                    const fmt = (n: number) => (n>=0?'+':'')+n;
                    const pb = parseIntSafe(this.data.pb) || 0;
                    if (e.to_hit_from) {
                        const abil = e.to_hit_from.ability;
                        const abilMod = abil === 'best_of_str_dex' ? Math.max(abilityMod(this.data.str), abilityMod(this.data.dex)) : abilityMod((this.data as any)[abil]);
                        const total = abilMod + (e.to_hit_from.proficient ? pb : 0);
                        e.to_hit = fmt(total);
                        hit.value = e.to_hit;
                    }
                    if (e.damage_from) {
                        const abil = e.damage_from.ability;
                        const abilMod = abil ? (abil === 'best_of_str_dex' ? Math.max(abilityMod(this.data.str), abilityMod(this.data.dex)) : abilityMod((this.data as any)[abil])) : 0;
                        const base = e.damage_from.dice;
                        const tail = (abilMod ? ` ${fmt(abilMod)}` : '') + (e.damage_from.bonus ? ` ${e.damage_from.bonus}` : '');
                        e.damage = `${base}${tail}`.trim();
                        dmg.value = e.damage;
                    }
                };
                // prefill from preset formulas
                if (e.to_hit_from) { toHitAbil.value = e.to_hit_from.ability as any; toHitProf.checked = !!e.to_hit_from.proficient; }
                if (e.damage_from) { dmgDice.value = e.damage_from.dice; dmgAbil.value = (e.damage_from.ability as any) || ''; dmgBonus.value = e.damage_from.bonus || ''; }
                toHitAbil.onchange = applyAuto; toHitProf.onchange = applyAuto; dmgDice.oninput = applyAuto; dmgAbil.onchange = applyAuto; dmgBonus.oninput = applyAuto;
                const misc = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
                misc.createEl('label', { text: 'Save' });
                const saveAb = misc.createEl("select") as HTMLSelectElement; ["","STR","DEX","CON","INT","WIS","CHA"].forEach(x=>{ const o=saveAb.createEl("option", { text: x||"(kein)" }); o.value=x; if (x===(e.save_ability||"")) o.selected=true; }); saveAb.onchange = () => e.save_ability = saveAb.value || undefined;
                misc.createEl('label', { text: 'DC' });
                const saveDc = misc.createEl("input", { attr: { type: "number", placeholder: "DC", 'aria-label': 'DC' } }) as HTMLInputElement; saveDc.value = e.save_dc ? String(e.save_dc) : ""; saveDc.oninput = () => e.save_dc = saveDc.value ? parseInt(saveDc.value,10) : undefined as any; (saveDc.style as any).width = '4ch';
                misc.createEl('label', { text: 'Save-Effekt' });
                const saveFx = misc.createEl("input", { attr: { type: "text", placeholder: "half on save …", 'aria-label': 'Save-Effekt' } }) as HTMLInputElement; saveFx.value = e.save_effect || ""; saveFx.oninput = () => e.save_effect = saveFx.value.trim() || undefined; (saveFx.style as any).width = '18ch';
                misc.createEl('label', { text: 'Recharge' });
                const rech = misc.createEl("input", { attr: { type: "text", placeholder: "Recharge 5–6 / 1/day" } }) as HTMLInputElement; rech.value = e.recharge || ""; rech.oninput = () => e.recharge = rech.value.trim() || undefined;
                box.createEl('label', { text: 'Details' });
                const ta = box.createEl("textarea", { cls: "sm-cc-entry-text", attr: { placeholder: "Details (Markdown)" } }); ta.value = e.text || ""; ta.addEventListener("input", () => e.text = (ta as HTMLTextAreaElement).value);
            });
        };
        renderEntries();

        // Known spells section
        if (this.data.spellsKnown == null) this.data.spellsKnown = [];
        const spellsWrap = contentEl.createDiv({ cls: "setting-item sm-cc-spells" });
        spellsWrap.createDiv({ cls: "setting-item-info", text: "Bekannte Zauber" });
        const spellsCtl = spellsWrap.createDiv({ cls: "setting-item-control" });
        // Zweizeilig: 1) Auswahl + Grad  2) Nutzung + Notizen + Hinzufügen
        const row1 = spellsCtl.createDiv({ cls: "sm-cc-searchbar" });
        row1.createEl('label', { text: 'Zauber' });
        // Typeahead für Zauber
        let chosenSpell = "";
        const spellBox = row1.createDiv({ cls: 'sm-preset-box', attr: { style: 'flex:1 1 auto; min-width: 180px;' } });
        const spellInput = spellBox.createEl('input', { cls: 'sm-preset-input', attr: { type: 'text', placeholder: 'Zauber suchen…' } }) as HTMLInputElement;
        const spellMenu = spellBox.createDiv({ cls: 'sm-preset-menu' });
        const renderSpellMenu = () => {
            const q = (spellInput.value || '').toLowerCase();
            spellMenu.empty();
            const matches = (this.availableSpells || []).filter(n => !q || n.toLowerCase().includes(q)).slice(0, 24);
            if (matches.length === 0) { spellBox.removeClass('is-open'); return; }
            for (const name of matches) {
                const it = spellMenu.createDiv({ cls: 'sm-preset-item', text: name });
                it.onclick = () => { chosenSpell = name; spellInput.value = name; spellBox.removeClass('is-open'); };
            }
            spellBox.addClass('is-open');
        };
        spellInput.addEventListener('focus', renderSpellMenu);
        spellInput.addEventListener('input', renderSpellMenu);
        spellInput.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { spellInput.value=''; chosenSpell=''; spellBox.removeClass('is-open'); } });
        spellInput.addEventListener('blur', () => { setTimeout(() => spellBox.removeClass('is-open'), 120); });
        row1.createEl('label', { text: 'Grad' });
        const lvl = row1.createEl("input", { attr: { type: "number", min: "0", max: "9", placeholder: "Grad", 'aria-label': 'Grad' } }) as HTMLInputElement; (lvl.style as any).width = '4ch';
        const row2 = spellsCtl.createDiv({ cls: "sm-cc-searchbar" });
        row2.createEl('label', { text: 'Nutzung' });
        const uses = row2.createEl("input", { attr: { type: "text", placeholder: "at will / 3/day / slots", 'aria-label': 'Nutzung' } }) as HTMLInputElement; (uses.style as any).width = '14ch';
        row2.createEl('label', { text: 'Notizen' });
        const notes = row2.createEl("input", { attr: { type: "text", placeholder: "Notizen", 'aria-label': 'Notizen' } }) as HTMLInputElement; (notes.style as any).width = '16ch';
        const addSpell = row2.createEl("button", { text: "+ Hinzufügen" });
        addSpell.onclick = () => {
            let name = chosenSpell?.trim();
            if (!name) name = (spellInput.value || '').trim();
            if (!name) return;
            this.data.spellsKnown!.push({ name, level: lvl.value ? parseInt(lvl.value,10) : undefined, uses: uses.value.trim() || undefined, notes: notes.value.trim() || undefined });
            spellInput.value = ''; chosenSpell = '';
            lvl.value = uses.value = notes.value = ""; renderSpellList();
        };
        const list = spellsCtl.createDiv({ cls: "sm-cc-list" });
        const renderSpellList = () => {
            list.empty();
            this.data.spellsKnown!.forEach((s, i) => {
                const item = list.createDiv({ cls: "sm-cc-item" });
                item.createDiv({ cls: "sm-cc-item__name", text: `${s.name}${s.level!=null?` (Lvl ${s.level})`:''}${s.uses?` – ${s.uses}`:''}` });
                const rm = item.createEl("button", { text: "×" });
                rm.onclick = () => { this.data.spellsKnown!.splice(i,1); renderSpellList(); };
            });
        };
        renderSpellList();

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

    private addTextArea(parent: HTMLElement, label: string, placeholder: string, onChange: (v: string) => void) {
        const wrap = parent.createDiv({ cls: "setting-item" });
        wrap.createDiv({ cls: "setting-item-info", text: label });
        const ctl = wrap.createDiv({ cls: "setting-item-control" });
        const ta = ctl.createEl("textarea", { attr: { placeholder } });
        ta.addEventListener("input", () => onChange(ta.value));
    }

    private makeTokenEditor(parent: HTMLElement, title: string, onAdd: (v: string) => void, itemsProvider: () => string[], onRemove: (idx: number) => void) {
        new Setting(parent).setName(title).addText(t => {
            t.setPlaceholder("Begriff eingeben…");
            // @ts-ignore
            const input = (t as any).inputEl as HTMLInputElement;
            t.inputEl.style.minWidth = '260px';
            t.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') { const v = input.value.trim(); if (v) { onAdd(v); input.value = ''; renderChips(); } }
            });
        }).addButton(b => b.setButtonText("+").onClick(() => { const inp = (b.buttonEl.parentElement?.querySelector('input') as HTMLInputElement); const v = inp?.value?.trim(); if (v) { onAdd(v); inp.value=''; renderChips(); } }));
        const chips = parent.createDiv({ cls: 'sm-cc-chips' });
        const renderChips = () => {
            chips.empty();
            const items = itemsProvider();
            items.forEach((txt, i) => {
                const chip = chips.createDiv({ cls: 'sm-cc-chip' });
                chip.createSpan({ text: txt });
                const x = chip.createEl('button', { text: '×' });
                x.onclick = () => { onRemove(i); renderChips(); };
            });
        };
        renderChips();
    }

    private submit() {
        if (!this.data.name || !this.data.name.trim()) return;
        this.close();
        this.onSubmit(this.data);
    }
}
