// Re-export to keep feature-local import path while core still holds implementation
// src/apps/library/core/creature-files.ts
import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

export const CREATURES_DIR = "SaltMarcher/Creatures";

export type StatblockData = {
    name: string;
    size?: string;
    type?: string;
    alignmentLawChaos?: string;
    alignmentGoodEvil?: string;
    ac?: string;
    initiative?: string;
    hp?: string;
    hitDice?: string;
    speedWalk?: string;
    speedSwim?: string;
    speedFly?: string;
    speedBurrow?: string;
    speedList?: string[];
    str?: string; dex?: string; con?: string; int?: string; wis?: string; cha?: string;
    pb?: string;
    saveProf?: { str?: boolean; dex?: boolean; con?: boolean; int?: boolean; wis?: boolean; cha?: boolean };
    skillsProf?: string[];
    skillsExpertise?: string[];
    sensesList?: string[];
    languagesList?: string[];
    cr?: string;
    xp?: string;
    traits?: string; actions?: string; legendary?: string;
    entries?: Array<{ category: 'trait'|'action'|'bonus'|'reaction'|'legendary'; name: string; kind?: string; to_hit?: string; to_hit_from?: { ability: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex'; proficient?: boolean }; range?: string; target?: string; save_ability?: string; save_dc?: number; save_effect?: string; damage?: string; damage_from?: { dice: string; ability?: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex'; bonus?: string }; recharge?: string; text?: string; }>;
    actionsList?: Array<{ name: string; kind?: string; to_hit?: string; range?: string; target?: string; save_ability?: string; save_dc?: number; save_effect?: string; damage?: string; recharge?: string; text?: string; }>;
    spellsKnown?: Array<{ name: string; level?: number; uses?: string; notes?: string }>;
};

export async function ensureCreatureDir(app: App): Promise<TFolder> {
    const p = normalizePath(CREATURES_DIR);
    let f = app.vault.getAbstractFileByPath(p);
    if (f instanceof TFolder) return f;
    await app.vault.createFolder(p).catch(() => {});
    f = app.vault.getAbstractFileByPath(p);
    if (f instanceof TFolder) return f;
    throw new Error("Could not create creatures directory");
}

export function sanitizeFileName(name: string): string {
    const trimmed = (name || "Creature").trim();
    return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/^\.+$/, "Creature").slice(0, 120);
}

export async function listCreatureFiles(app: App): Promise<TFile[]> {
    const dir = await ensureCreatureDir(app);
    const out: TFile[] = [];
    const walk = (folder: TFolder) => { for (const child of folder.children) { if (child instanceof TFolder) walk(child); else if (child instanceof TFile && child.extension === "md") out.push(child); } };
    walk(dir);
    return out;
}

export function watchCreatureDir(app: App, onChange: () => void): () => void {
    const base = normalizePath(CREATURES_DIR) + "/";
    const isInDir = (f: TAbstractFile) => (f instanceof TFile || f instanceof TFolder) && (f.path + "/").startsWith(base);
    const handler = (f: TAbstractFile) => { if (isInDir(f)) onChange?.(); };
    app.vault.on("create", handler); app.vault.on("delete", handler); app.vault.on("rename", handler); app.vault.on("modify", handler);
    return () => { app.vault.off("create", handler); app.vault.off("delete", handler); app.vault.off("rename", handler); app.vault.off("modify", handler); };
}

function yamlList(items?: string[]): string | undefined { if (!items || items.length === 0) return undefined; const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", "); return `[${safe}]`; }
function parseNum(v?: string): number | null { if (!v) return null; const m = String(v).match(/-?\d+/); if (!m) return null; return Number(m[0]); }
function abilityMod(score?: string): number | null { const n = parseNum(score); if (n == null || Number.isNaN(n)) return null; return Math.floor((n - 10) / 2); }
function fmtSigned(n: number): string { return (n >= 0 ? "+" : "") + n; }
const SKILL_TO_ABILITY: Record<string, keyof Pick<StatblockData, 'str'|'dex'|'int'|'wis'|'cha'|'con'>> = { Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha', };
function composeAlignment(d: StatblockData): string | undefined { const a = d.alignmentLawChaos?.trim(); const b = d.alignmentGoodEvil?.trim(); if (!a && !b) return undefined; if ((a?.toLowerCase() === 'neutral') && (b?.toLowerCase() === 'neutral')) return 'Neutral'; return [a, b].filter(Boolean).join(' '); }

function statblockToMarkdown(d: StatblockData): string {
    const hdr = [d.size || "", d.type || "", composeAlignment(d) || ""].filter(Boolean).join(", ");
    const name = d.name || "Unnamed Creature";
    const lines: string[] = [];
    lines.push("---"); lines.push("smType: creature"); lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (d.size) lines.push(`size: "${d.size}"`); if (d.type) lines.push(`type: "${d.type}"`); const align = composeAlignment(d); if (align) lines.push(`alignment: "${align}"`);
    if (d.ac) lines.push(`ac: "${d.ac}"`); if (d.initiative) lines.push(`initiative: "${d.initiative}"`); if (d.hp) lines.push(`hp: "${d.hp}"`); if (d.hitDice) lines.push(`hit_dice: "${d.hitDice}"`);
    if (d.speedWalk) lines.push(`speed_walk: "${d.speedWalk}"`); if (d.speedSwim) lines.push(`speed_swim: "${d.speedSwim}"`); if (d.speedFly) lines.push(`speed_fly: "${d.speedFly}"`); if (d.speedBurrow) lines.push(`speed_burrow: "${d.speedBurrow}"`);
    const speedsYaml = yamlList(d.speedList); if (speedsYaml) lines.push(`speeds: ${speedsYaml}`);
    if (d.str) lines.push(`str: "${d.str}"`); if (d.dex) lines.push(`dex: "${d.dex}"`); if (d.con) lines.push(`con: "${d.con}"`); if (d.int) lines.push(`int: "${d.int}"`); if (d.wis) lines.push(`wis: "${d.wis}"`); if (d.cha) lines.push(`cha: "${d.cha}"`); if (d.pb) lines.push(`pb: "${d.pb}"`);
    if (d.saveProf) { const profs = Object.entries(d.saveProf).filter(([, v]) => !!v).map(([k]) => k.toUpperCase()); if (profs.length) lines.push(`saves_prof: ${yamlList(profs)}`); }
    if (d.skillsProf && d.skillsProf.length) lines.push(`skills_prof: ${yamlList(d.skillsProf)}`); if (d.skillsExpertise && d.skillsExpertise.length) lines.push(`skills_expertise: ${yamlList(d.skillsExpertise)}`);
    const sensesYaml = yamlList(d.sensesList); if (sensesYaml) lines.push(`senses: ${sensesYaml}`); const langsYaml = yamlList(d.languagesList); if (langsYaml) lines.push(`languages: ${langsYaml}`);
    if (d.cr) lines.push(`cr: "${d.cr}"`); if (d.xp) lines.push(`xp: "${d.xp}"`);
    const entries = (d.entries && d.entries.length) ? d.entries : (d.actionsList && d.actionsList.length ? d.actionsList.map(a => ({ category: 'action' as const, ...a })) : undefined);
    if (entries && entries.length) { const json = JSON.stringify(entries).replace(/"/g, '\\"'); lines.push(`entries_structured_json: "${json}"`); }
    if (d.spellsKnown && d.spellsKnown.length) { const json = JSON.stringify(d.spellsKnown).replace(/"/g, '\\"'); lines.push(`spells_known_json: "${json}"`); }
    lines.push("---\n");
    lines.push(`# ${name}`); if (hdr) lines.push(hdr); lines.push("");
    if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
    if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);
    let speedsLine: string[] = []; if (d.speedList && d.speedList.length) speedsLine = d.speedList.slice(); else { if (d.speedWalk) speedsLine.push(`${d.speedWalk}`); if (d.speedSwim) speedsLine.push(`swim ${d.speedSwim}`); if (d.speedFly) speedsLine.push(`fly ${d.speedFly}`); if (d.speedBurrow) speedsLine.push(`burrow ${d.speedBurrow}`); } if (speedsLine.length) lines.push(`Speed ${speedsLine.join(", ")}`);
    lines.push("");
    const abilities = [["STR", d.str],["DEX", d.dex],["CON", d.con],["INT", d.int],["WIS", d.wis],["CHA", d.cha]] as const; if (abilities.some(([_,v])=>!!v)) { lines.push("| Ability | Score |"); lines.push("| ------: | :---- |"); for (const [k,v] of abilities) if (v) lines.push(`| ${k} | ${v} |`); lines.push(""); }
    const pbNum = parseNum(d.pb) ?? 0; if (d.saveProf) { const parts: string[] = []; const map: Array<[keyof typeof d.saveProf, string, string|undefined]> = [['str','Str',d.str],['dex','Dex',d.dex],['con','Con',d.con],['int','Int',d.int],['wis','Wis',d.wis],['cha','Cha',d.cha]]; for (const [key,label,score] of map) { if (d.saveProf[key]) { const mod = abilityMod(score) ?? 0; parts.push(`${label} ${fmtSigned(mod + pbNum)}`); } } if (parts.length) lines.push(`Saves ${parts.join(", ")}`); }
    const getSet = (arr?: string[]) => new Set((arr || []).map(s => s.trim()).filter(Boolean)); const profSet = getSet(d.skillsProf); const expSet = getSet(d.skillsExpertise);
    if (profSet.size || expSet.size) { const parts: string[] = []; const allSkills = Array.from(new Set([...Object.keys(SKILL_TO_ABILITY)])); for (const sk of allSkills) { const hasProf = profSet.has(sk) || expSet.has(sk); if (!hasProf) continue; const abilKey = SKILL_TO_ABILITY[sk]; const mod = abilityMod((d as any)[abilKey]) ?? 0; const bonus = expSet.has(sk) ? pbNum * 2 : pbNum; parts.push(`${sk} ${fmtSigned(mod + bonus)}`); } if (parts.length) lines.push(`Skills ${parts.join(", ")}`); }
    if (d.sensesList && d.sensesList.length) lines.push(`Senses ${d.sensesList.join(", ")}`); if (d.languagesList && d.languagesList.length) lines.push(`Languages ${d.languagesList.join(", ")}`); if (d.cr || d.pb || d.xp) { const bits: string[] = []; if (d.cr) bits.push(`CR ${d.cr}`); if (pbNum) bits.push(`PB ${fmtSigned(pbNum)}`); if (d.xp) bits.push(`XP ${d.xp}`); if (bits.length) lines.push(bits.join("; ")); } lines.push("");
    if (entries && entries.length) {
        const groups: Record<string, typeof entries> = { trait: [], action: [], bonus: [], reaction: [], legendary: [] } as any;
        for (const e of entries) { (groups[e.category] ||= []).push(e); }
        const renderGroup = (title: string, arr: typeof entries) => { if (!arr || arr.length === 0) return; lines.push(`## ${title}\n`); for (const a of arr) { const headParts = [a.name, a.recharge].filter(Boolean).join(" "); lines.push(`- **${headParts}**`); const sub: string[] = []; if (a.kind) sub.push(a.kind); if (a.to_hit) sub.push(`to hit ${a.to_hit}`); else if (a.to_hit_from) { const abil = a.to_hit_from.ability; const abilMod = abil === 'best_of_str_dex' ? Math.max(abilityMod(d.str) ?? 0, abilityMod(d.dex) ?? 0) : (abilityMod((d as any)[abil]) ?? 0); const pb = parseNum(d.pb) ?? 0; const total = abilMod + (a.to_hit_from.proficient ? pb : 0); sub.push(`to hit ${fmtSigned(total)}`); } if (a.range) sub.push(a.range); if (a.target) sub.push(a.target); if (a.damage) sub.push(a.damage); else if (a.damage_from) { const abilKey = a.damage_from.ability; const abilMod = abilKey ? (abilKey === 'best_of_str_dex' ? Math.max(abilityMod(d.str) ?? 0, abilityMod(d.dex) ?? 0) : (abilityMod((d as any)[abilKey]) ?? 0)) : 0; const bonus = a.damage_from.bonus ? ` ${a.damage_from.bonus}` : ''; const modTxt = abilMod ? ` ${fmtSigned(abilMod)}` : ''; sub.push(`${a.damage_from.dice}${modTxt}${bonus}`.trim()); } if (a.save_ability) sub.push(`Save ${a.save_ability}${a.save_dc ? ` DC ${a.save_dc}` : ''}${a.save_effect ? ` (${a.save_effect})` : ''}`); if (sub.length) lines.push(`  - ${sub.join(", ")}`); if (a.text && a.text.trim()) lines.push(`  ${a.text.trim()}`); } lines.push(""); };
        renderGroup("Traits", groups.trait); renderGroup("Actions", groups.action); renderGroup("Bonus Actions", groups.bonus); renderGroup("Reactions", groups.reaction); renderGroup("Legendary Actions", groups.legendary);
    } else {
        if (d.traits) { lines.push("## Traits\n"); lines.push(d.traits.trim()); lines.push(""); }
        if (d.actions) { lines.push("## Actions\n"); lines.push(d.actions.trim()); lines.push(""); }
        if (d.legendary) { lines.push("## Legendary Actions\n"); lines.push(d.legendary.trim()); lines.push(""); }
    }
    if (d.spellsKnown && d.spellsKnown.length) { lines.push("## Spellcasting\n"); const byLevel: Record<string, Array<{ name: string; uses?: string; notes?: string }>> = {}; for (const s of d.spellsKnown) { const key = s.level == null ? "unknown" : String(s.level); (byLevel[key] ||= []).push({ name: s.name, uses: s.uses, notes: s.notes }); } const order = Object.keys(byLevel).map(k => (k === 'unknown' ? Infinity : parseInt(k,10))).sort((a,b)=>a-b).map(n => n === Infinity ? 'unknown' : String(n)); for (const k of order) { const lvl = k === 'unknown' ? 'Spells' : (k === '0' ? 'Cantrips' : `Level ${k}`); lines.push(`- ${lvl}:`); for (const s of byLevel[k]) { const extra = [s.uses, s.notes].filter(Boolean).join('; '); lines.push(`  - ${s.name}${extra ? ` (${extra})` : ''}`); } } lines.push(""); }
    return lines.join("\n");
}

export async function createCreatureFile(app: App, d: StatblockData): Promise<TFile> {
    const folder = await ensureCreatureDir(app);
    const baseName = sanitizeFileName(d.name || "Creature");
    let fileName = `${baseName}.md`; let path = normalizePath(`${folder.path}/${fileName}`); let i = 2;
    while (app.vault.getAbstractFileByPath(path)) { fileName = `${baseName} (${i}).md`; path = normalizePath(`${folder.path}/${fileName}`); i++; }
    const content = statblockToMarkdown(d);
    const file = await app.vault.create(path, content);
    return file;
}

