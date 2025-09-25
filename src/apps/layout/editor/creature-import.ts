// src/apps/layout/editor/creature-import.ts
import { Notice } from "obsidian";
import type { StatblockData } from "../../library/core/creature-files";
import {
    mountCreatureBasicsSection,
    mountCreatureSensesAndDefensesSection,
    mountCreatureStatsAndSkillsSection,
    mountEntriesSection,
    mountSpellsKnownSection,
} from "../../library/create/creature";
import { MIN_ELEMENT_SIZE } from "./definitions";
import type { LayoutElement, LayoutElementType } from "./types";

export interface CreatureImportContext {
    sandbox: HTMLElement;
    nextFrame(): Promise<void>;
    setCanvasSize(width: number, height: number): void;
    updateCanvasInputs(width: number, height: number): void;
    setElements(elements: LayoutElement[]): void;
    applyCanvasSize(): void;
    renderElements(): void;
    renderInspector(): void;
    refreshExport(): void;
    updateStatus(): void;
    pushHistory(): void;
}

export async function importCreatureLayout(context: CreatureImportContext, options?: { silent?: boolean }) {
    const sandbox = context.sandbox;
    sandbox.empty();
    sandbox.style.position = "absolute";
    sandbox.style.top = "-10000px";
    sandbox.style.left = "-10000px";
    sandbox.style.visibility = "hidden";
    sandbox.style.pointerEvents = "none";
    sandbox.style.width = "960px";
    sandbox.style.padding = "24px";
    sandbox.style.boxSizing = "border-box";

    try {
        sandbox.createEl("h3", { text: "Neuen Statblock erstellen" });
        const data: StatblockData = { name: "Neue Kreatur" };
        mountCreatureBasicsSection(sandbox, data);
        mountCreatureStatsAndSkillsSection(sandbox, data);
        mountCreatureSensesAndDefensesSection(sandbox, data);
        mountEntriesSection(sandbox, data);
        mountSpellsKnownSection(sandbox, data, () => []);
        const actions = sandbox.createDiv({ cls: "setting-item sm-cc-actions" });
        actions.dataset.layoutLabel = "Aktionen";
        const actionsCtl = actions.createDiv({ cls: "setting-item-control" });
        actionsCtl.createEl("button", { text: "Abbrechen" });
        const createBtn = actionsCtl.createEl("button", { text: "Erstellen" });
        createBtn.addClass("mod-cta");

        await context.nextFrame();
        await context.nextFrame();

        const containerRect = sandbox.getBoundingClientRect();
        const margin = 48;
        const elements: LayoutElement[] = [];
        const used = new Set<HTMLElement>();
        let counter = 0;

        const pushElement = (element: Element | null, label: string) => {
            if (!(element instanceof HTMLElement)) return;
            if (used.has(element)) return;
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const x = rect.left - containerRect.left + margin;
            const y = rect.top - containerRect.top + margin;
            const width = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.width));
            const height = Math.max(MIN_ELEMENT_SIZE, Math.round(rect.height));
            const type = detectElementTypeFromDom(element);
            const defaults = extractElementDefaults(element, type);
            elements.push({
                id: `creature-${String(++counter).padStart(2, "0")}`,
                type,
                x: Math.round(x),
                y: Math.round(y),
                width,
                height,
                label,
                description: defaults.description,
                placeholder: defaults.placeholder,
                defaultValue: defaults.defaultValue,
                options: defaults.options,
                attributes: [],
            });
            used.add(element);
        };

        pushElement(sandbox.querySelector("h3"), "Titel");

        const basicsItems = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-basics__grid .setting-item"));
        for (const el of basicsItems) {
            const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
            pushElement(el, `Basics · ${name}`);
        }

        const statRows = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-stat-row"));
        for (const row of statRows) {
            const label = row.querySelector(".sm-cc-stat-row__label")?.textContent?.trim() || "Stat";
            pushElement(row, `Stat · ${label}`);
        }

        const statsSettings = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-stats > .setting-item"));
        for (const el of statsSettings) {
            const name = el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
            pushElement(el, `Stats · ${name}`);
        }

        const defenseSettings = Array.from(sandbox.querySelectorAll<HTMLElement>(".sm-cc-defenses .setting-item"));
        for (const el of defenseSettings) {
            const custom = el.dataset.layoutLabel;
            const name = custom || el.querySelector(".setting-item-name")?.textContent?.trim() || "Feld";
            pushElement(el, `Defenses · ${name}`);
        }

        pushElement(sandbox.querySelector(".sm-cc-entries.setting-item"), "Einträge");
        pushElement(sandbox.querySelector(".sm-cc-spells.setting-item"), "Zauber");
        pushElement(actions, actions.dataset.layoutLabel || "Aktionen");

        elements.sort((a, b) => a.y - b.y || a.x - b.x);
        if (!elements.length) {
            throw new Error("Keine Layout-Elemente gefunden");
        }

        const width = Math.max(200, Math.round(containerRect.width) + margin * 2);
        const height = Math.max(200, Math.round(containerRect.height) + margin * 2);
        context.setCanvasSize(width, height);
        context.updateCanvasInputs(width, height);

        context.setElements(elements);
        context.applyCanvasSize();
        context.renderElements();
        context.renderInspector();
        context.refreshExport();
        context.updateStatus();
        context.pushHistory();

        if (!options?.silent) new Notice("Creature-Layout importiert");
    } catch (error) {
        console.error("importCreatureLayout", error);
        if (!options?.silent) new Notice("Konnte Creature-Layout nicht importieren");
    } finally {
        sandbox.empty();
    }
}

function detectElementTypeFromDom(node: HTMLElement): LayoutElementType {
    if (node.querySelector("hr")) return "separator";
    const select = node.querySelector("select");
    if (select instanceof HTMLSelectElement) {
        if (select.classList.contains("sm-sd") || select.dataset.sdOpenAll != null) {
            return "search-dropdown";
        }
        return "dropdown";
    }
    const textarea = node.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) return "textarea";
    const input = node.querySelector(
        "input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']",
    );
    if (input instanceof HTMLInputElement) return "text-input";
    return "box";
}

function extractElementDefaults(node: HTMLElement, type: LayoutElementType): {
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    options?: string[];
} {
    const defaults: { description?: string; placeholder?: string; defaultValue?: string; options?: string[] } = {};
    const desc = node.querySelector(".setting-item-description");
    if (desc?.textContent?.trim()) {
        defaults.description = desc.textContent.trim();
    }
    if (type === "text-input") {
        const input = node.querySelector(
            "input[type='text'], input[type='number'], input[type='search'], input[type='email'], input[type='url']",
        ) as HTMLInputElement | null;
        if (input) {
            if (input.placeholder) defaults.placeholder = input.placeholder;
            if (input.value) defaults.defaultValue = input.value;
        }
    } else if (type === "textarea") {
        const textarea = node.querySelector("textarea") as HTMLTextAreaElement | null;
        if (textarea) {
            if (textarea.placeholder) defaults.placeholder = textarea.placeholder;
            if (textarea.value) defaults.defaultValue = textarea.value;
        }
    } else if (type === "dropdown" || type === "search-dropdown") {
        const select = node.querySelector("select") as HTMLSelectElement | null;
        if (select) {
            const options = Array.from(select.querySelectorAll("option"))
                .map(opt => opt.textContent?.trim())
                .filter((opt): opt is string => !!opt && opt.length > 0);
            if (options.length) defaults.options = options;
            const selected = select.value;
            if (selected) defaults.defaultValue = selected;
        }
    }
    return defaults;
}
