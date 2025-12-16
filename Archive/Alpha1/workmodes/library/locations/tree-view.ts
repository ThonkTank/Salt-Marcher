// src/workmodes/library/locations/tree-view.ts
// Tree view component for hierarchical location display

import type { LocationTreeNode } from "./tree-builder";
import type { LocationType } from './calendar-types';

// Icon mapping for location types
const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
    "Stadt": "🏙️",
    "Dorf": "🏘️",
    "Weiler": "🏡",
    "Gebäude": "🏢",
    "Dungeon": "⚔️",
    "Camp": "⛺",
    "Landmark": "🗿",
    "Ruine": "🏚️",
    "Festung": "🏰",
};

export interface TreeViewOptions {
    /** Callback when a location is clicked */
    onLocationClick?: (locationName: string) => void;
    /** Initial set of expanded node names */
    initialExpanded?: Set<string>;
    /** CSS class for the container */
    containerClass?: string;
}

/**
 * Renders a hierarchical tree view of locations.
 * Supports expand/collapse and click-to-open.
 */
export class LocationTreeView {
    private containerEl: HTMLElement;
    private expandedNodes: Set<string>;
    private options: TreeViewOptions;
    private currentNodes: LocationTreeNode[] = [];

    constructor(containerEl: HTMLElement, options: TreeViewOptions = {}) {
        this.containerEl = containerEl;
        this.expandedNodes = options.initialExpanded || new Set();
        this.options = options;
    }

    /**
     * Renders the tree view with the given nodes.
     */
    render(nodes: LocationTreeNode[]): void {
        this.currentNodes = nodes;
        this.containerEl.empty();

        if (nodes.length === 0) {
            this.containerEl.createDiv({ cls: "sm-tree-empty", text: "Keine Orte vorhanden" });
            return;
        }

        const treeContainer = this.containerEl.createDiv({ cls: this.options.containerClass || "sm-tree-view" });

        for (const node of nodes) {
            this.renderNode(treeContainer, node);
        }
    }

    /**
     * Recursively renders a tree node and its children.
     */
    private renderNode(parentEl: HTMLElement, node: LocationTreeNode): void {
        const nodeEl = parentEl.createDiv({ cls: "sm-tree-node" });
        nodeEl.style.paddingLeft = `${node.depth * 20}px`;

        const contentEl = nodeEl.createDiv({ cls: "sm-tree-node-content" });

        // Expand/collapse button (only if node has children)
        if (node.children.length > 0) {
            const toggleBtn = contentEl.createSpan({ cls: "sm-tree-toggle" });
            const isExpanded = this.expandedNodes.has(node.location.name);
            toggleBtn.setText(isExpanded ? "▼" : "▶");
            toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleNode(node.location.name);
            });
        } else {
            // Spacer for alignment
            contentEl.createSpan({ cls: "sm-tree-toggle sm-tree-toggle-empty", text: " " });
        }

        // Location type icon
        const icon = LOCATION_TYPE_ICONS[node.location.type] || "📍";
        contentEl.createSpan({ cls: "sm-tree-icon", text: icon });

        // Location name (clickable)
        const nameEl = contentEl.createSpan({ cls: "sm-tree-name", text: node.location.name });
        nameEl.addEventListener("click", () => {
            if (this.options.onLocationClick) {
                this.options.onLocationClick(node.location.name);
            }
        });

        // Owner badge (if present)
        if (node.location.owner_type && node.location.owner_type !== "none" && node.location.owner_name) {
            const ownerBadge = contentEl.createSpan({ cls: "sm-tree-badge" });
            ownerBadge.setText(`${node.location.owner_name}`);
        }

        // Render children if expanded
        if (this.expandedNodes.has(node.location.name)) {
            for (const child of node.children) {
                this.renderNode(parentEl, child);
            }
        }
    }

    /**
     * Toggles a node's expanded state and re-renders.
     */
    private toggleNode(name: string): void {
        if (this.expandedNodes.has(name)) {
            this.expandedNodes.delete(name);
        } else {
            this.expandedNodes.add(name);
        }

        // Re-render with current nodes
        this.render(this.currentNodes);
    }

    /**
     * Expands all nodes in the tree.
     */
    expandAll(nodes: LocationTreeNode[]): void {
        const collectNames = (ns: LocationTreeNode[]) => {
            for (const node of ns) {
                this.expandedNodes.add(node.location.name);
                collectNames(node.children);
            }
        };
        collectNames(nodes);
    }

    /**
     * Collapses all nodes in the tree.
     */
    collapseAll(): void {
        this.expandedNodes.clear();
    }

    /**
     * Gets the current expanded state.
     */
    getExpandedNodes(): Set<string> {
        return new Set(this.expandedNodes);
    }
}

/**
 * Simple helper to render a tree view into a container element.
 * Returns the TreeView instance for further control.
 */
export function renderLocationTree(
    containerEl: HTMLElement,
    nodes: LocationTreeNode[],
    options: TreeViewOptions = {}
): LocationTreeView {
    const treeView = new LocationTreeView(containerEl, options);
    treeView.render(nodes);
    return treeView;
}
