// src/core/map-list.ts
import type { App, TFile } from "obsidian";

// Re-Export: zentrale Modals liegen in ui/modals.ts
export { MapSelectModal } from "../ui/modals";

/** Neueste Datei aus Liste wählen (per mtime). */
export function pickLatest(files: TFile[]): TFile | null {
    if (!files.length) return null;
    return [...files].sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0))[0];
}

/**
 * Liefert alle Markdown-Dateien, die mind. einen ```hex3x3 Codeblock enthalten.
 * Sortiert nach letzter Änderung (neu zuerst).
 */
export async function getAllMapFiles(app: App): Promise<TFile[]> {
    const mdFiles = app.vault.getMarkdownFiles();
    const results: TFile[] = [];
    const rx = /```[\t ]*hex3x3\b[\s\S]*?```/i;

    for (const f of mdFiles) {
        const content = await app.vault.cachedRead(f);
        if (rx.test(content)) results.push(f);
    }

    // Neueste zuerst
    return results.sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0));
}

/**
 * Gibt den **ersten** hex3x3-Blockinhalt (ohne ```-Marker) zurück.
 * Rückgabe ist der Options-Text, den `parseOptions(...)` erwartet.
 */
export async function getFirstHexBlock(app: App, file: TFile): Promise<string | null> {
    const content = await app.vault.cachedRead(file);
    const m = content.match(/```[\t ]*hex3x3\b\s*\n([\s\S]*?)\n```/i);
    return m ? m[1].trim() : null;
}
