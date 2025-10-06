// Re-export to keep feature-local import path while core still holds implementation
// src/apps/library/core/spell-files.ts
import { App, TFile } from "obsidian";
import { createVaultFilePipeline, sanitizeVaultFileName } from "./file-pipeline";

export const SPELLS_DIR = "SaltMarcher/Spells";

export type SpellData = {
    name: string; level?: number; school?: string; casting_time?: string; range?: string; components?: string[]; materials?: string; duration?: string; concentration?: boolean; ritual?: boolean; classes?: string[]; save_ability?: string; save_effect?: string; attack?: string; damage?: string; damage_type?: string; description?: string; higher_levels?: string;
};

const SPELL_PIPELINE = createVaultFilePipeline<SpellData>({
    dir: SPELLS_DIR,
    defaultBaseName: "Spell",
    getBaseName: data => data.name,
    toContent: spellToMarkdown,
    sanitizeName: name => sanitizeVaultFileName(name, "Spell"),
});

export const ensureSpellDir = SPELL_PIPELINE.ensure;

export const listSpellFiles = SPELL_PIPELINE.list;

export const watchSpellDir = SPELL_PIPELINE.watch;

function yamlList(items?: string[]): string | undefined { if (!items || items.length === 0) return undefined; const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", "); return `[${safe}]`; }

export function spellToMarkdown(d: SpellData): string {
    const lines: string[] = []; const name = d.name || "Unnamed Spell";
    lines.push("---"); lines.push("smType: spell"); lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (Number.isFinite(d.level as any)) lines.push(`level: ${d.level}`); if (d.school) lines.push(`school: "${d.school}"`); if (d.casting_time) lines.push(`casting_time: "${d.casting_time}"`); if (d.range) lines.push(`range: "${d.range}"`);
    const comps = yamlList(d.components); if (comps) lines.push(`components: ${comps}`); if (d.materials) lines.push(`materials: "${d.materials.replace(/"/g, '\\"')}"`); if (d.duration) lines.push(`duration: "${d.duration}"`); if (d.concentration != null) lines.push(`concentration: ${!!d.concentration}`); if (d.ritual != null) lines.push(`ritual: ${!!d.ritual}`);
    const classes = yamlList(d.classes); if (classes) lines.push(`classes: ${classes}`); if (d.save_ability) lines.push(`save_ability: "${d.save_ability}"`); if (d.save_effect) lines.push(`save_effect: "${d.save_effect.replace(/"/g, '\\"')}"`); if (d.attack) lines.push(`attack: "${d.attack}"`); if (d.damage) lines.push(`damage: "${d.damage}"`); if (d.damage_type) lines.push(`damage_type: "${d.damage_type}"`); lines.push("---\n");
    lines.push(`# ${name}`); const levelStr = (d.level == null) ? "" : (d.level === 0 ? "Cantrip" : `Level ${d.level}`); const parts = [levelStr, d.school].filter(Boolean); if (parts.length) lines.push(parts.join(" ")); lines.push("");
    const stat = (label: string, val?: string | boolean) => { if (val) lines.push(`- ${label}: ${val}`); };
    stat("Casting Time", d.casting_time); stat("Range", d.range); const compLine = (d.components || []).join(", ") + (d.materials ? ` (${d.materials})` : ""); if (d.components && d.components.length) stat("Components", compLine); stat("Duration", d.duration); if (d.concentration) lines.push("- Concentration: yes"); if (d.ritual) lines.push("- Ritual: yes"); if (d.classes && d.classes.length) stat("Classes", (d.classes || []).join(", "));
    if (d.attack) stat("Attack", d.attack); if (d.save_ability) stat("Save", `${d.save_ability}${d.save_effect ? ` (${d.save_effect})` : ""}`); if (d.damage) stat("Damage", `${d.damage}${d.damage_type ? ` ${d.damage_type}` : ""}`); lines.push(""); if (d.description) { lines.push(d.description.trim()); lines.push(""); } if (d.higher_levels) { lines.push("## At Higher Levels\n"); lines.push(d.higher_levels.trim()); lines.push(""); }
    return lines.join("\n");
}

export async function createSpellFile(app: App, d: SpellData): Promise<TFile> {
    return SPELL_PIPELINE.create(app, d);
}

