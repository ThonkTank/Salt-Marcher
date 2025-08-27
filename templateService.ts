// ──────────────────────────────────────────────────────────────────────────────
// File: src/templateService.ts
// Purpose: YAML-Frontmatter Renderer + Note-Erstellung (Ordner/Pfade konfigurierbar)
// ──────────────────────────────────────────────────────────────────────────────
import type { App, TFile, TFolder } from "obsidian";
import { normalizePath } from "obsidian";
import { createLogger } from "./logger";
import { TileFrontmatter, SessionFrontmatter, defaultTileFrontmatter, uuidV4 } from "./schemas";
import type { SaltSettings } from "./settings";


const logNotes = createLogger("Notes");


export interface PathConfig {
hexFolder: string; // z.B. "Hexes"
locationsFolder: string;// z.B. "Locations"
npcFolder: string; // z.B. "NPC"
factionsFolder: string; // z.B. "Factions"
sessionsFolder: string; // z.B. "Sessions"
}


export function ensureTrailingSlash(s: string): string { return s.endsWith("/") ? s : s + "/"; }


export function getTilePath(q: number, r: number, region: string, conf: PathConfig): string {
const base = ensureTrailingSlash(conf.hexFolder);
const reg = region.replace(/\//g, "-");
const path = normalizePath(`${base}${reg}/${q}_${r}.md`);
return path;
}


export async function createNoteAt(app: App, path: string, content: string): Promise<TFile> {
const existing = app.vault.getAbstractFileByPath(path);
if (existing instanceof TFile) {
logNotes.warn("existingTile", { path });
return existing;
}
// Ordner sicherstellen
const parts = path.split("/");
parts.pop();
let folderPath = "";
for (const part of parts) {
folderPath = folderPath ? `${folderPath}/${part}` : part;
const abs = app.vault.getAbstractFileByPath(folderPath);
if (!abs) {
try {
await app.vault.createFolder(folderPath);
logNotes.debug("createFolder", { folderPath });
} catch (err) {
// bereits vorhanden / race condition → ignorieren, aber loggen
logNotes.warn("createFolder.failed", { folderPath, err });
}
} else if (!(abs instanceof TFolder)) {
throw new Error(`Pfad-Kollision: ${folderPath} ist keine Mappe`);
}
