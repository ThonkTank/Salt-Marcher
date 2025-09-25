// plugins/layout-editor/src/element-picker-modal.ts
import { App, Modal } from "obsidian";
import type { LayoutElementDefinition, LayoutElementType } from "./types";
import {
    createElementsButton,
    createElementsField,
    createElementsHeading,
    createElementsInput,
    createElementsParagraph,
    createElementsStatus,
    ensureFieldLabelFor,
} from "./elements/ui";
import { ElementTreeNode, renderElementTree } from "./ui/element-tree";

interface ElementPickerModalOptions {
    definitions: LayoutElementDefinition[];
    onPick(type: LayoutElementType): void;
}

export class ElementPickerModal extends Modal {
    private readonly definitions: LayoutElementDefinition[];
    private readonly onPick: (type: LayoutElementType) => void;

    private filterText = "";
    private treeHost: HTMLElement | null = null;
    private filterInput: HTMLInputElement | null = null;
    private emptyStateEl: HTMLElement | null = null;

    constructor(app: App, options: ElementPickerModalOptions) {
        super(app);
        this.definitions = options.definitions;
        this.onPick = options.onPick;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-le-element-picker");

        createElementsHeading(contentEl, 3, "Element auswählen");
        createElementsParagraph(contentEl, "Durchsuche die Elementbibliothek und füge deinem Layout neue Bausteine hinzu.");

        const searchField = createElementsField(contentEl, { label: "Suchen", layout: "stack" });
        searchField.fieldEl.addClass("sm-le-element-picker__search");
        this.filterInput = createElementsInput(searchField.controlEl, {
            type: "search",
            placeholder: "Elementnamen oder Typen filtern …",
        });
        ensureFieldLabelFor(searchField, this.filterInput);
        this.filterInput.addEventListener("input", () => this.handleFilterChange());

        this.treeHost = contentEl.createDiv({ cls: "sm-le-element-picker__tree" });
        this.renderTree();

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        const cancelBtn = createElementsButton(buttonContainer, { label: "Abbrechen" });
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        this.contentEl.empty();
        this.treeHost = null;
        this.filterInput = null;
        this.emptyStateEl = null;
        this.filterText = "";
    }

    private handleFilterChange() {
        if (!this.filterInput) return;
        this.filterText = this.filterInput.value.trim();
        this.renderTree();
    }

    private renderTree() {
        if (!this.treeHost) return;
        const definitions = this.getFilteredDefinitions();
        if (!definitions.length) {
            this.treeHost.empty();
            this.emptyStateEl = createElementsStatus(this.treeHost, {
                text: "Keine Elemente gefunden.",
                tone: "warning",
            });
            this.emptyStateEl.addClass("sm-le-element-picker__empty");
            return;
        }
        if (this.emptyStateEl) {
            this.emptyStateEl.remove();
            this.emptyStateEl = null;
        }
        const nodes = buildElementTree(definitions);
        renderElementTree({
            host: this.treeHost,
            nodes,
            expandAll: this.filterText.length > 0,
            onSelect: definition => this.selectDefinition(definition),
        });
    }

    private getFilteredDefinitions(): LayoutElementDefinition[] {
        const query = this.filterText.toLocaleLowerCase("de");
        const items = this.definitions.slice();
        items.sort((a, b) => a.buttonLabel.localeCompare(b.buttonLabel, "de"));
        if (!query) {
            return items;
        }
        return items.filter(definition => {
            const label = definition.buttonLabel.toLocaleLowerCase("de");
            const type = definition.type.toLocaleLowerCase("de");
            const fallback = (definition.defaultLabel ?? "").toLocaleLowerCase("de");
            return label.includes(query) || type.includes(query) || fallback.includes(query);
        });
    }

    private selectDefinition(definition: LayoutElementDefinition) {
        this.close();
        this.onPick(definition.type);
    }
}

interface GroupPathEntry {
    id: string;
    label: string;
}

function buildElementTree(definitions: LayoutElementDefinition[]): ElementTreeNode[] {
    const root: ElementTreeNode[] = [];
    const index = new Map<string, ElementTreeNode>();

    for (const definition of definitions) {
        const groups = getGroupPath(definition);
        let parentKey = "";
        let target = root;
        for (const group of groups) {
            const key = parentKey ? `${parentKey}/${group.id}` : group.id;
            let node = index.get(key);
            if (!node) {
                node = { id: key, label: group.label, children: [] };
                target.push(node);
                index.set(key, node);
            }
            target = node.children!;
            parentKey = key;
        }
        target.push({ id: definition.type, label: definition.buttonLabel, definition });
    }

    sortTree(root);
    return root;
}

function sortTree(nodes: ElementTreeNode[]) {
    nodes.sort((a, b) => a.label.localeCompare(b.label, "de"));
    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            sortTree(node.children);
        }
    }
}

function getGroupPath(definition: LayoutElementDefinition): GroupPathEntry[] {
    const path: GroupPathEntry[] = [];
    if (isContainerDefinition(definition)) {
        path.push({ id: "container", label: "Container" });
        const orientation = definition.layoutOrientation ?? "vertical";
        if (orientation === "horizontal") {
            path.push({ id: "container-horizontal", label: "Horizontale Container" });
        } else {
            path.push({ id: "container-vertical", label: "Vertikale Container" });
        }
        return path;
    }

    const paletteGroup = definition.paletteGroup;
    if (paletteGroup && paletteGroup !== "element") {
        path.push({ id: `group-${paletteGroup}`, label: getPaletteGroupLabel(paletteGroup) });
    } else {
        path.push({ id: "general", label: "Allgemeine Elemente" });
    }
    return path;
}

function isContainerDefinition(definition: LayoutElementDefinition): boolean {
    return definition.category === "container" || definition.paletteGroup === "container";
}

function getPaletteGroupLabel(groupId: string): string {
    switch (groupId) {
        case "input":
            return "Eingabeelemente";
        case "container":
            return "Container";
        default:
            return capitalize(groupId);
    }
}

function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}
