// src/core/layout.ts
import type { App, WorkspaceLeaf } from "obsidian";

/**
 * Holt den rechten Leaf, falls keiner existiert, erstellt einen neuen.
 */
export function getRightLeaf(app: App): WorkspaceLeaf {
    console.log("[Layout] Requesting right leaf...");
    const leaf =
    app.workspace.getRightLeaf(false) ??
    app.workspace.getRightLeaf(true) ??
    app.workspace.getLeaf(true);
    console.log("[Layout] Right leaf resolved:", leaf);
    return leaf;
}

/**
 * Holt den zentralen Leaf.
 * Nutzt zuerst den zuletzt aktiven Leaf, sonst einen neuen.
 */
export function getCenterLeaf(app: App): WorkspaceLeaf {
    const leaf =
    app.workspace.getMostRecentLeaf() ??
    app.workspace.getLeaf(false) ??
    app.workspace.getLeaf(true);
    console.log("[Layout] Center leaf resolved:", leaf);
    return leaf;
}
