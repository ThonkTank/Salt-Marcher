// src/apps/library/create/creature/section-spellcasting.ts
import type { SpellFrequencyMap, SpellRef, StatblockData } from "../../core/creature-files";

type SpellSearchSource = () => readonly string[] | null | undefined;

type SpellListHandle = { refreshSpellMatches(): void };

type SpellListKey = "spellsAtWill";
type SpellMapKey = "spellsPerDay" | "spellsPerRest" | "spellsBySlot" | "spellsOther";

type SpellListBinding = {
    getItems(): SpellRef[];
    add(item: SpellRef): void;
    remove(index: number): void;
};

type MountSpellListOptions = {
    usesPlaceholder?: string;
    notesPlaceholder?: string;
    showUses?: boolean;
    showNotes?: boolean;
    addButtonLabel?: string;
    emptyHint?: string;
    onRemoveList?: () => void;
};

type SpellMapSectionOptions = {
    title: string;
    getMap: () => SpellFrequencyMap;
    placeholder: string;
    addButtonLabel?: string;
    suggestions?: string[];
    labelFormatter?: (key: string) => string;
    sort?: (a: [string, SpellRef[]], b: [string, SpellRef[]]) => number;
    showUses?: boolean;
    showNotes?: boolean;
    usesPlaceholder?: string;
    notesPlaceholder?: string;
    emptyHint?: string;
    allowGroupRemoval?: boolean;
};

function ensureSpellList(data: StatblockData, key: SpellListKey): SpellRef[] {
    const current = data[key];
    if (Array.isArray(current)) return current;
    const arr: SpellRef[] = [];
    (data as any)[key] = arr;
    return arr;
}

function ensureSpellMap(data: StatblockData, key: SpellMapKey): SpellFrequencyMap {
    const current = data[key];
    if (current && typeof current === "object") return current as SpellFrequencyMap;
    const map: SpellFrequencyMap = {};
    (data as any)[key] = map;
    return map;
}

function upgradeLegacySpells(data: StatblockData) {
    const hasStructuredSpells = Boolean(
        (data.spellsAtWill && data.spellsAtWill.length) ||
        (data.spellsPerDay && Object.keys(data.spellsPerDay).length) ||
        (data.spellsPerRest && Object.keys(data.spellsPerRest).length) ||
        (data.spellsBySlot && Object.keys(data.spellsBySlot).length) ||
        (data.spellsOther && Object.keys(data.spellsOther).length)
    );
    if (hasStructuredSpells || !Array.isArray(data.spellsKnown) || data.spellsKnown.length === 0) return;

    const atWill = ensureSpellList(data, "spellsAtWill");
    const perDay = ensureSpellMap(data, "spellsPerDay");
    const perRest = ensureSpellMap(data, "spellsPerRest");
    const bySlot = ensureSpellMap(data, "spellsBySlot");
    const other = ensureSpellMap(data, "spellsOther");

    for (const legacy of data.spellsKnown) {
        const name = legacy?.name?.trim();
        if (!name) continue;
        const rawUses = legacy.uses?.trim();
        const usesLower = rawUses?.toLowerCase() ?? "";
        const notes = legacy.notes?.trim();
        const ref: SpellRef = { name };
        if (notes) ref.notes = notes;

        if (usesLower.includes("at will")) {
            atWill.push(ref);
            continue;
        }
        if (usesLower.includes("/day") || usesLower.includes("per day")) {
            const key = rawUses || "1/Tag";
            (perDay[key] ||= []).push(ref);
            continue;
        }
        if (usesLower.includes("rest")) {
            const key = rawUses || "1/Rast";
            (perRest[key] ||= []).push(ref);
            continue;
        }
        if (legacy.level != null) {
            const key = String(legacy.level);
            if (rawUses) ref.uses = rawUses;
            (bySlot[key] ||= []).push(ref);
            continue;
        }
        if (rawUses) ref.uses = rawUses;
        (other["Legacy"] ||= []).push(ref);
    }

    delete (data as any).spellsKnown;
}

function mountSpellList(
    parent: HTMLElement,
    label: string,
    binding: SpellListBinding,
    getAvailableSpells: SpellSearchSource,
    onChange: (() => void) | undefined,
    options: MountSpellListOptions = {}
): SpellListHandle {
    const wrap = parent.createDiv({ cls: "setting-item sm-cc-spells" });
    const info = wrap.createDiv({ cls: "setting-item-info" });
    info.empty();
    const labelSpan = info.createSpan({ text: label });
    labelSpan.style.flex = "1";
    if (options.onRemoveList) {
        const removeBtn = info.createEl("button", { text: "×" });
        removeBtn.setAttr("aria-label", `${label} entfernen`);
        removeBtn.onclick = () => { options.onRemoveList?.(); onChange?.(); };
        removeBtn.style.marginLeft = "0.5rem";
    }

    const ctl = wrap.createDiv({ cls: "setting-item-control" });
    const row1 = ctl.createDiv({ cls: "sm-cc-searchbar" });
    row1.createEl("label", { text: "Zauber" });
    const spellBox = row1.createDiv({ cls: "sm-preset-box", attr: { style: "flex:1 1 auto; min-width: 200px;" } });
    const spellInput = spellBox.createEl("input", {
        cls: "sm-preset-input",
        attr: { type: "text", placeholder: "Zauber suchen…", "aria-label": `${label} – Zauber` },
    }) as HTMLInputElement;
    const spellMenu = spellBox.createDiv({ cls: "sm-preset-menu" });

    const showUses = options.showUses !== false;
    const showNotes = options.showNotes !== false;

    const row2 = ctl.createDiv({ cls: "sm-cc-searchbar" });
    let usesInput: HTMLInputElement | null = null;
    let notesInput: HTMLInputElement | null = null;
    if (showUses) {
        row2.createEl("label", { text: "Uses" });
        usesInput = row2.createEl("input", {
            attr: {
                type: "text",
                placeholder: options.usesPlaceholder ?? "z. B. 3/Tag",
                "aria-label": `${label} – Uses`,
            },
        }) as HTMLInputElement;
        usesInput.style.width = "12ch";
    }
    if (showNotes) {
        row2.createEl("label", { text: "Notizen" });
        notesInput = row2.createEl("input", {
            attr: {
                type: "text",
                placeholder: options.notesPlaceholder ?? "Notizen",
                "aria-label": `${label} – Notizen`,
            },
        }) as HTMLInputElement;
        notesInput.style.flex = "1 1 auto";
        notesInput.style.minWidth = "160px";
    }
    const addBtn = row2.createEl("button", { text: options.addButtonLabel ?? "+ Hinzufügen" });

    let chosenSpell = "";
    const renderSpellMenu = () => {
        const q = (spellInput.value || "").toLowerCase();
        const source = getAvailableSpells();
        const matches = (source ? Array.from(source) : [])
            .filter((name) => !q || name.toLowerCase().includes(q))
            .slice(0, 24);
        spellMenu.empty();
        if (!matches.length) {
            spellBox.removeClass("is-open");
            return;
        }
        for (const name of matches) {
            const it = spellMenu.createDiv({ cls: "sm-preset-item", text: name });
            it.onclick = () => {
                chosenSpell = name;
                spellInput.value = name;
                spellBox.removeClass("is-open");
            };
        }
        spellBox.addClass("is-open");
    };

    const closeMenuLater = () => { setTimeout(() => spellBox.removeClass("is-open"), 120); };
    spellInput.addEventListener("focus", renderSpellMenu);
    spellInput.addEventListener("input", renderSpellMenu);
    spellInput.addEventListener("blur", closeMenuLater);
    const handleKeydown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
            spellInput.value = "";
            chosenSpell = "";
            spellBox.removeClass("is-open");
        }
        if (ev.key === "Enter") {
            ev.preventDefault();
            addSpell();
        }
    };
    spellInput.addEventListener("keydown", handleKeydown);
    if (usesInput) usesInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addSpell(); } });
    if (notesInput) notesInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addSpell(); } });

    const list = ctl.createDiv({ cls: "sm-cc-list" });

    const renderList = () => {
        list.empty();
        const items = binding.getItems();
        if (!items.length && options.emptyHint) {
            const empty = list.createDiv({ text: options.emptyHint });
            empty.style.opacity = "0.7";
            return;
        }
        items.forEach((spell, index) => {
            const item = list.createDiv({ cls: "sm-cc-item" });
            item.style.flexDirection = "column";
            item.style.alignItems = "stretch";
            item.style.gap = "0.35rem";

            const header = item.createDiv();
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.justifyContent = "space-between";
            header.createDiv({ cls: "sm-cc-item__name", text: spell.name });
            const removeBtn = header.createEl("button", { text: "×" });
            removeBtn.setAttr("aria-label", `${spell.name} entfernen`);
            removeBtn.onclick = () => {
                binding.remove(index);
                renderList();
                onChange?.();
            };

            if (showUses || showNotes) {
                const meta = item.createDiv();
                meta.style.display = "flex";
                meta.style.flexWrap = "wrap";
                meta.style.gap = "0.5rem";
                if (showUses) {
                    const field = meta.createEl("input", {
                        attr: {
                            type: "text",
                            placeholder: options.usesPlaceholder ?? "Uses",
                            "aria-label": `${spell.name} – Uses`,
                        },
                    }) as HTMLInputElement;
                    field.value = spell.uses ?? "";
                    field.style.width = "12ch";
                    field.addEventListener("input", () => {
                        const value = field.value.trim();
                        spell.uses = value || undefined;
                        onChange?.();
                    });
                }
                if (showNotes) {
                    const field = meta.createEl("input", {
                        attr: {
                            type: "text",
                            placeholder: options.notesPlaceholder ?? "Notizen",
                            "aria-label": `${spell.name} – Notizen`,
                        },
                    }) as HTMLInputElement;
                    field.value = spell.notes ?? "";
                    field.style.flex = "1 1 180px";
                    field.addEventListener("input", () => {
                        const value = field.value.trim();
                        spell.notes = value || undefined;
                        onChange?.();
                    });
                }
            }
        });
    };

    const addSpell = () => {
        let name = chosenSpell?.trim();
        if (!name) name = (spellInput.value || "").trim();
        if (!name) return;
        const spell: SpellRef = { name };
        const uses = usesInput?.value.trim();
        const notes = notesInput?.value.trim();
        if (uses) spell.uses = uses;
        if (notes) spell.notes = notes;
        binding.add(spell);
        spellInput.value = "";
        chosenSpell = "";
        if (usesInput) usesInput.value = "";
        if (notesInput) notesInput.value = "";
        spellBox.removeClass("is-open");
        renderList();
        onChange?.();
        spellInput.focus();
    };

    addBtn.onclick = addSpell;

    renderList();

    return {
        refreshSpellMatches() {
            if (document.activeElement === spellInput || spellBox.hasClass("is-open")) {
                renderSpellMenu();
            }
        },
    };
}

function mountSpellMapSection(
    parent: HTMLElement,
    opts: SpellMapSectionOptions,
    getAvailableSpells: SpellSearchSource,
    onChange: (() => void) | undefined
): SpellListHandle {
    const group = parent.createDiv({ cls: "sm-cc-spellcasting-group" });
    const heading = group.createDiv();
    heading.createEl("h4", { text: opts.title });

    const addRow = group.createDiv({ cls: "sm-cc-searchbar" });
    addRow.createEl("label", { text: "Frequenz" });
    const keyInput = addRow.createEl("input", {
        attr: {
            type: "text",
            placeholder: opts.placeholder,
            "aria-label": `${opts.title} – Frequenz`,
        },
    }) as HTMLInputElement;
    keyInput.style.flex = "1 1 auto";
    keyInput.style.minWidth = "160px";
    const addButton = addRow.createEl("button", { text: opts.addButtonLabel ?? "+ Gruppe" });

    if (opts.suggestions && opts.suggestions.length) {
        const suggestionsRow = group.createDiv();
        suggestionsRow.style.display = "flex";
        suggestionsRow.style.flexWrap = "wrap";
        suggestionsRow.style.gap = "0.5rem";
        for (const suggestion of opts.suggestions) {
            const btn = suggestionsRow.createEl("button", { text: suggestion });
            btn.onclick = () => {
                const map = opts.getMap();
                if (!map[suggestion]) map[suggestion] = [];
                render();
                onChange?.();
            };
        }
    }

    const listsHost = group.createDiv();
    listsHost.style.display = "flex";
    listsHost.style.flexDirection = "column";
    listsHost.style.gap = "0.75rem";

    const listHandles: SpellListHandle[] = [];

    const render = () => {
        const map = opts.getMap();
        listsHost.empty();
        listHandles.length = 0;
        const entries = Object.entries(map);
        const sorted = opts.sort ? entries.sort(opts.sort) : entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));
        if (!sorted.length) {
            const empty = listsHost.createDiv({ text: opts.emptyHint ?? "Noch keine Frequenzen." });
            empty.style.opacity = "0.7";
            return;
        }
        for (const [key, value] of sorted) {
            const listWrap = listsHost.createDiv();
            const handle = mountSpellList(
                listWrap,
                opts.labelFormatter ? opts.labelFormatter(key) : key,
                {
                    getItems: () => map[key] || (map[key] = []),
                    add: (item) => {
                        (map[key] ||= []).push(item);
                    },
                    remove: (index) => {
                        const list = map[key];
                        if (!list) return;
                        list.splice(index, 1);
                        if (!list.length && opts.allowGroupRemoval) delete map[key];
                    },
                },
                getAvailableSpells,
                onChange,
                {
                    usesPlaceholder: opts.usesPlaceholder,
                    notesPlaceholder: opts.notesPlaceholder,
                    showUses: opts.showUses,
                    showNotes: opts.showNotes,
                    emptyHint: opts.emptyHint ? "Noch keine Zauber." : undefined,
                    onRemoveList: opts.allowGroupRemoval
                        ? () => {
                              delete map[key];
                              render();
                          }
                        : undefined,
                }
            );
            listHandles.push(handle);
        }
    };

    const addFrequency = () => {
        const raw = keyInput.value.trim();
        if (!raw) return;
        const map = opts.getMap();
        if (!map[raw]) map[raw] = [];
        keyInput.value = "";
        render();
        onChange?.();
    };

    addButton.onclick = addFrequency;
    keyInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            addFrequency();
        }
    });

    render();

    return {
        refreshSpellMatches() {
            listHandles.forEach((handle) => handle.refreshSpellMatches());
        },
    };
}

export function mountSpellcastingSection(
    parent: HTMLElement,
    data: StatblockData,
    getAvailableSpells: SpellSearchSource,
    onChange?: () => void,
) {
    upgradeLegacySpells(data);

    const container = parent.createDiv({ cls: "sm-cc-spellcasting" });

    const stats = container.createDiv({ cls: "setting-item sm-cc-spells" });
    stats.createDiv({ cls: "setting-item-info", text: "Spellcasting" });
    const statsCtl = stats.createDiv({ cls: "setting-item-control" });
    const statsRow = statsCtl.createDiv({ cls: "sm-cc-searchbar" });

    statsRow.createEl("label", { text: "Fähigkeit" });
    const abilityInput = statsRow.createEl("input", {
        attr: { type: "text", placeholder: "z. B. INT", "aria-label": "Zauber-Fähigkeit" },
    }) as HTMLInputElement;
    abilityInput.value = data.spellcastingAbility ?? "";
    abilityInput.style.width = "10ch";
    abilityInput.addEventListener("input", () => {
        const value = abilityInput.value.trim();
        data.spellcastingAbility = value || undefined;
        onChange?.();
    });

    statsRow.createEl("label", { text: "Save DC" });
    const saveInput = statsRow.createEl("input", {
        attr: { type: "text", placeholder: "z. B. 15", "aria-label": "Zauber-SG" },
    }) as HTMLInputElement;
    saveInput.value = data.spellSaveDc ?? "";
    saveInput.style.width = "8ch";
    saveInput.addEventListener("input", () => {
        const value = saveInput.value.trim();
        data.spellSaveDc = value || undefined;
        onChange?.();
    });

    statsRow.createEl("label", { text: "Angriffsbonus" });
    const attackInput = statsRow.createEl("input", {
        attr: { type: "text", placeholder: "z. B. +7", "aria-label": "Zauber-Angriffsbonus" },
    }) as HTMLInputElement;
    attackInput.value = data.spellAttackBonus ?? "";
    attackInput.style.width = "8ch";
    attackInput.addEventListener("input", () => {
        const value = attackInput.value.trim();
        data.spellAttackBonus = value || undefined;
        onChange?.();
    });

    const sections = container.createDiv();
    sections.style.display = "flex";
    sections.style.flexDirection = "column";
    sections.style.gap = "1.5rem";

    const handles: SpellListHandle[] = [];
    const registerHandle = (handle: SpellListHandle) => { handles.push(handle); };

    registerHandle(
        mountSpellList(
            sections,
            "At-Will",
            {
                getItems: () => ensureSpellList(data, "spellsAtWill"),
                add: (item) => ensureSpellList(data, "spellsAtWill").push(item),
                remove: (index) => ensureSpellList(data, "spellsAtWill").splice(index, 1),
            },
            getAvailableSpells,
            onChange,
            { emptyHint: "Noch keine Zauber." }
        )
    );

    registerHandle(
        mountSpellMapSection(
            sections,
            {
                title: "Pro Tag",
                getMap: () => ensureSpellMap(data, "spellsPerDay"),
                placeholder: "z. B. 1/Tag",
                suggestions: ["1/Tag", "2/Tag", "3/Tag"],
                allowGroupRemoval: true,
                emptyHint: "Noch keine Frequenzen.",
            },
            getAvailableSpells,
            onChange
        )
    );

    registerHandle(
        mountSpellMapSection(
            sections,
            {
                title: "Pro Rast",
                getMap: () => ensureSpellMap(data, "spellsPerRest"),
                placeholder: "z. B. 1/Lange Rast",
                suggestions: ["1/Kurze Rast", "1/Lange Rast"],
                allowGroupRemoval: true,
                emptyHint: "Noch keine Frequenzen.",
            },
            getAvailableSpells,
            onChange
        )
    );

    registerHandle(
        mountSpellMapSection(
            sections,
            {
                title: "Zauberplätze",
                getMap: () => ensureSpellMap(data, "spellsBySlot"),
                placeholder: "Grad (0-9)",
                suggestions: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
                labelFormatter: (key) => (Number(key) === 0 ? "Grad 0 (Cantrips)" : `Grad ${key}`),
                sort: (a, b) => {
                    const numA = Number(a[0]);
                    const numB = Number(b[0]);
                    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
                    if (Number.isFinite(numA)) return -1;
                    if (Number.isFinite(numB)) return 1;
                    return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
                },
                allowGroupRemoval: true,
                emptyHint: "Noch keine Slots hinterlegt.",
            },
            getAvailableSpells,
            onChange
        )
    );

    registerHandle(
        mountSpellMapSection(
            sections,
            {
                title: "Weitere Gruppen",
                getMap: () => ensureSpellMap(data, "spellsOther"),
                placeholder: "Bezeichnung (z. B. Rituale)",
                allowGroupRemoval: true,
                emptyHint: "Noch keine Gruppen.",
            },
            getAvailableSpells,
            onChange
        )
    );

    return {
        refreshSpellMatches() {
            handles.forEach((handle) => handle.refreshSpellMatches());
        },
    };
}
