import type { LayoutElementDefinition } from "../types";

export interface ElementTreeNode {
    id: string;
    label: string;
    definition?: LayoutElementDefinition;
    children?: ElementTreeNode[];
}

interface RenderContext {
    onSelect(definition: LayoutElementDefinition): void;
    depth: number;
    expandAll: boolean;
}

export interface RenderElementTreeOptions {
    host: HTMLElement;
    nodes: ElementTreeNode[];
    expandAll?: boolean;
    onSelect(definition: LayoutElementDefinition): void;
}

export function renderElementTree(options: RenderElementTreeOptions) {
    const { host, nodes, onSelect, expandAll = false } = options;
    host.empty();
    const root = host.createDiv({ cls: "sm-elements-tree" });
    const context: RenderContext = { onSelect, depth: 0, expandAll };
    for (const node of nodes) {
        renderNode(root, node, context);
    }
}

function renderNode(container: HTMLElement, node: ElementTreeNode, context: RenderContext) {
    if (node.children && node.children.length > 0) {
        const groupEl = container.createDiv({ cls: "sm-elements-tree__group" });
        const headerEl = groupEl.createDiv({ cls: "sm-elements-tree__header" });
        const toggleEl = headerEl.createSpan({ cls: "sm-elements-tree__toggle" });
        headerEl.createSpan({ cls: "sm-elements-tree__label", text: node.label });
        const childrenEl = groupEl.createDiv({ cls: "sm-elements-tree__children" });

        let expanded = context.expandAll || context.depth === 0;
        const updateExpanded = () => {
            groupEl.toggleClass("is-expanded", expanded);
            toggleEl.setText(expanded ? "−" : "+");
            childrenEl.style.display = expanded ? "flex" : "none";
        };
        updateExpanded();

        headerEl.addEventListener("click", event => {
            event.preventDefault();
            expanded = !expanded;
            updateExpanded();
        });

        const childContext: RenderContext = {
            onSelect: context.onSelect,
            depth: context.depth + 1,
            expandAll: context.expandAll,
        };
        for (const child of node.children) {
            renderNode(childrenEl, child, childContext);
        }
        return;
    }

    if (!node.definition) return;
    const itemEl = container.createDiv({ cls: "sm-elements-tree__item" });
    const button = itemEl.createEl("button", {
        cls: "sm-elements-tree__item-button",
        text: node.label,
    });
    button.type = "button";
    button.addEventListener("click", event => {
        event.preventDefault();
        context.onSelect(node.definition!);
    });
}
