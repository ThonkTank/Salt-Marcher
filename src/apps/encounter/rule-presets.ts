// src/apps/encounter/rule-presets.ts
// Verwaltet Encounter-Regel-Presets als Markdown-Dateien im Vault.
import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import type { EncounterRuleModifierType, EncounterXpRule } from "./session-store";

export const ENCOUNTER_RULE_PRESET_DIR = "SaltMarcher/EncounterPresets";
const DEFAULT_PRESET_NAME = "Encounter Rule Preset";

export interface EncounterRulePresetDocument {
    readonly name: string;
    readonly encounterXp?: number;
    readonly rules: ReadonlyArray<EncounterXpRule>;
}

export interface EncounterRulePresetSummary {
    readonly file: TFile;
    readonly name: string;
    readonly encounterXp?: number;
}

const MODIFIER_TYPES: ReadonlySet<EncounterRuleModifierType> = new Set([
    "flat",
    "flatPerAverageLevel",
    "flatPerTotalLevel",
    "percentTotal",
    "percentNextLevel",
]);

const PRESET_SCOPE_GOLD = "gold";
const PRESET_SCOPE_XP = "xp";

export async function ensureEncounterRulePresetDir(app: App): Promise<TFolder> {
    const normalized = normalizePath(ENCOUNTER_RULE_PRESET_DIR);
    let file = app.vault.getAbstractFileByPath(normalized);
    if (file instanceof TFolder) return file;
    await app.vault.createFolder(normalized).catch(() => {});
    file = app.vault.getAbstractFileByPath(normalized);
    if (file instanceof TFolder) return file;
    throw new Error(`Could not ensure encounter preset directory: ${normalized}`);
}

export async function listEncounterRulePresets(app: App): Promise<EncounterRulePresetSummary[]> {
    const dir = await ensureEncounterRulePresetDir(app);
    const files: TFile[] = [];
    const walk = (folder: TFolder) => {
        for (const child of folder.children) {
            if (child instanceof TFolder) walk(child);
            else if (child instanceof TFile && child.extension === "md") files.push(child);
        }
    };
    walk(dir);
    const summaries = files.map((file) => {
        const cache = app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter ?? {};
        const name = typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : file.basename;
        const encounterXp = typeof fm.encounterXp === "number" ? fm.encounterXp : undefined;
        return { file, name, encounterXp } satisfies EncounterRulePresetSummary;
    });
    summaries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return summaries;
}

export async function loadEncounterRulePreset(app: App, file: TFile): Promise<EncounterRulePresetDocument> {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    const name = typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : file.basename;
    const encounterXp = typeof fm.encounterXp === "number" ? fm.encounterXp : undefined;
    const rules = parsePresetRules(fm.rules);
    return { name, encounterXp, rules } satisfies EncounterRulePresetDocument;
}

export async function saveEncounterRulePreset(
    app: App,
    doc: EncounterRulePresetDocument,
    options: { path?: string } = {},
): Promise<TFile> {
    const sanitizedName = sanitizePresetName(doc.name);
    const content = serializePreset(doc, sanitizedName);
    const dir = await ensureEncounterRulePresetDir(app);

    if (options.path) {
        const existing = app.vault.getAbstractFileByPath(options.path);
        if (existing instanceof TFile) {
            await app.vault.modify(existing, content);
            return existing;
        }
    }

    const baseName = sanitizeFileName(sanitizedName, DEFAULT_PRESET_NAME);
    let fileName = `${baseName}.md`;
    let targetPath = normalizePath(`${dir.path}/${fileName}`);
    let counter = 2;
    while (app.vault.getAbstractFileByPath(targetPath)) {
        fileName = `${baseName} (${counter}).md`;
        targetPath = normalizePath(`${dir.path}/${fileName}`);
        counter += 1;
    }
    const file = await app.vault.create(targetPath, content);
    return file as TFile;
}

export async function deleteEncounterRulePreset(app: App, file: TFile): Promise<void> {
    await app.vault.delete(file);
}

function parsePresetRules(raw: unknown): EncounterXpRule[] {
    if (!Array.isArray(raw)) return [];
    const rules: EncounterXpRule[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const data = entry as Record<string, unknown>;
        const modifierType = parseModifierType(data.modifierType);
        const modifierValue = parseNumber(data.modifierValue, 0);
        const minValue = parseNumber(data.modifierValueMin, modifierValue);
        const maxValue = parseNumber(data.modifierValueMax, modifierValue);
        const scope = data.scope === PRESET_SCOPE_GOLD ? PRESET_SCOPE_GOLD : PRESET_SCOPE_XP;
        let notes: string | undefined;
        if (typeof data.notes === "string") {
            notes = data.notes;
        } else if (data.notes === "") {
            notes = "";
        }
        const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : createRuleId();
        const title = typeof data.title === "string" ? data.title : "";
        const enabled = data.enabled !== false;
        const normalisedMin = Math.min(minValue, maxValue);
        const normalisedMax = Math.max(minValue, maxValue);
        rules.push({
            id,
            title,
            modifierType,
            modifierValue,
            modifierValueMin: normalisedMin,
            modifierValueMax: normalisedMax,
            enabled,
            scope,
            notes,
        });
    }
    return rules;
}

function parseModifierType(value: unknown): EncounterRuleModifierType {
    if (typeof value === "string" && MODIFIER_TYPES.has(value as EncounterRuleModifierType)) {
        return value as EncounterRuleModifierType;
    }
    return "flat";
}

function parseNumber(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
    }
    return fallback;
}

function sanitizePresetName(name: string): string {
    const trimmed = (name ?? "").trim();
    return trimmed || DEFAULT_PRESET_NAME;
}

function sanitizeFileName(name: string, fallback: string): string {
    const trimmed = name.trim();
    const base = trimmed || fallback;
    return base
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/^\.+$/, fallback)
        .slice(0, 120);
}

function serializePreset(doc: EncounterRulePresetDocument, sanitizedName: string): string {
    const lines: string[] = ["---", `name: ${JSON.stringify(sanitizedName)}`];
    if (typeof doc.encounterXp === "number" && Number.isFinite(doc.encounterXp)) {
        lines.push(`encounterXp: ${Number(doc.encounterXp)}`);
    }
    if (!doc.rules.length) {
        lines.push("rules: []", "---", "");
        return lines.join("\n");
    }
    lines.push("rules:");
    for (const rule of doc.rules) {
        lines.push(`  - id: ${JSON.stringify(rule.id)}`);
        lines.push(`    title: ${JSON.stringify(rule.title ?? "")}`);
        lines.push(`    modifierType: ${JSON.stringify(rule.modifierType)}`);
        lines.push(`    modifierValue: ${formatNumeric(rule.modifierValue)}`);
        lines.push(`    modifierValueMin: ${formatNumeric(rule.modifierValueMin)}`);
        lines.push(`    modifierValueMax: ${formatNumeric(rule.modifierValueMax)}`);
        lines.push(`    enabled: ${rule.enabled ? "true" : "false"}`);
        lines.push(`    scope: ${JSON.stringify(rule.scope)}`);
        if (rule.notes !== undefined) {
            lines.push(`    notes: ${JSON.stringify(rule.notes)}`);
        }
    }
    lines.push("---", "");
    return lines.join("\n");
}

function formatNumeric(value: number): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "0";
    return Number(value).toString();
}

function createRuleId(): string {
    const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoApi?.randomUUID) {
        return `rule-${cryptoApi.randomUUID()}`;
    }
    const random = Math.random().toString(36).slice(2, 10);
    return `rule-${Date.now().toString(36)}-${random}`;
}

export function isEncounterPresetFile(file: TAbstractFile | null): file is TFile {
    if (!(file instanceof TFile)) return false;
    if (file.extension !== "md") return false;
    const normalized = normalizePath(ENCOUNTER_RULE_PRESET_DIR);
    const base = `${normalized}/`;
    return file.path === normalized || file.path.startsWith(base);
}
