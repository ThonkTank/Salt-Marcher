// src/apps/library/core/creature-files.ts
// Verwaltet das Vault-Verzeichnis "SaltMarcher/Creatures" ohne Cache und exportiert das Statblock-Schema.
// Wird aus Feature-Ordnern re-exportiert, bis die Core-Dienste konsolidiert sind.
import { App, TFile } from "obsidian";
import { createVaultFilePipeline, sanitizeVaultFileName } from "./file-pipeline";

export const CREATURES_DIR = "SaltMarcher/Creatures";

/**
 * Normalised creature data used for persistence and Markdown export.
 * The structure intentionally mirrors the reference stat blocks in
 * `References/rulebooks/Statblocks/Creatures/Monsters`, covering:
 * - identity (name, size, type, alignment)
 * - initiative, defenses, hit points and movement (`speeds` bündelt Standard-Arten und zusätzliche Spezialbewegungen)
 * - abilities, saving throws, skills and passive perceptions
 * - languages, gear and any resistances/immunities
 * - trait/action style entries including bonus & reaction sections
 * - spellcasting lists grouped by level or usage frequency
 */
export type CreatureSpeedValue = {
    distance?: string;
    hover?: boolean;
    note?: string;
};

export type CreatureSpeedExtra = CreatureSpeedValue & {
    label: string;
};

export type CreatureSpeeds = {
    walk?: CreatureSpeedValue;
    swim?: CreatureSpeedValue;
    fly?: CreatureSpeedValue;
    burrow?: CreatureSpeedValue;
    climb?: CreatureSpeedValue;
    extras?: CreatureSpeedExtra[];
};

export type StatblockData = {
    name: string;
    size?: string;
    type?: string;
    typeTags?: string[];
    alignmentLawChaos?: string;
    alignmentGoodEvil?: string;
    alignmentOverride?: string;
    ac?: string;
    initiative?: string;
    hp?: string;
    hitDice?: string;
    speeds?: CreatureSpeeds;
    str?: string; dex?: string; con?: string; int?: string; wis?: string; cha?: string;
    pb?: string;
    saveProf?: { str?: boolean; dex?: boolean; con?: boolean; int?: boolean; wis?: boolean; cha?: boolean };
    skillsProf?: string[];
    skillsExpertise?: string[];
    sensesList?: string[];
    languagesList?: string[];
    passivesList?: string[];
    damageVulnerabilitiesList?: string[];
    damageResistancesList?: string[];
    damageImmunitiesList?: string[];
    conditionImmunitiesList?: string[];
    gearList?: string[];
    cr?: string;
    xp?: string;
    traits?: string; actions?: string; legendary?: string;
    entries?: Array<{ category: 'trait'|'action'|'bonus'|'reaction'|'legendary'; name: string; kind?: string; to_hit?: string; to_hit_from?: { ability: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex'; proficient?: boolean }; range?: string; target?: string; save_ability?: string; save_dc?: number; save_effect?: string; damage?: string; damage_from?: { dice: string; ability?: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex'; bonus?: string }; recharge?: string; text?: string; }>;
    actionsList?: Array<{ name: string; kind?: string; to_hit?: string; range?: string; target?: string; save_ability?: string; save_dc?: number; save_effect?: string; damage?: string; recharge?: string; text?: string; }>;
    spellsKnown?: Array<{ name: string; level?: number; uses?: string; notes?: string }>;
};

const CREATURE_PIPELINE = createVaultFilePipeline<StatblockData>({
    dir: CREATURES_DIR,
    defaultBaseName: "Creature",
    getBaseName: data => data.name,
    toContent: statblockToMarkdown,
    sanitizeName: name => sanitizeVaultFileName(name, "Creature"),
});

export const ensureCreatureDir = CREATURE_PIPELINE.ensure;

export function sanitizeFileName(name: string): string {
    return sanitizeVaultFileName(name, "Creature");
}

export const listCreatureFiles = CREATURE_PIPELINE.list;

export const watchCreatureDir = CREATURE_PIPELINE.watch;

function yamlList(items?: string[]): string | undefined { if (!items || items.length === 0) return undefined; const safe = items.map(s => `"${(s ?? "").replace(/"/g, '\\"')}"`).join(", "); return `[${safe}]`; }
function formatSpeedExtra(entry: CreatureSpeedExtra): string { const parts = [entry.label]; if (entry.distance) parts.push(entry.distance); if (entry.note) parts.push(entry.note); if (entry.hover) parts.push("(hover)"); return parts.map(p => p?.trim()).filter((p): p is string => Boolean(p && p.length)).join(" "); }
function parseNum(v?: string): number | null { if (!v) return null; const m = String(v).match(/-?\d+/); if (!m) return null; return Number(m[0]); }
function abilityMod(score?: string): number | null { const n = parseNum(score); if (n == null || Number.isNaN(n)) return null; return Math.floor((n - 10) / 2); }
function fmtSigned(n: number): string { return (n >= 0 ? "+" : "") + n; }
const SKILL_TO_ABILITY: Record<string, keyof Pick<StatblockData, 'str'|'dex'|'int'|'wis'|'cha'|'con'>> = { Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha', };
function composeAlignment(d: StatblockData): string | undefined {
    const override = d.alignmentOverride?.trim();
    if (override) return override;
    const a = d.alignmentLawChaos?.trim();
    const b = d.alignmentGoodEvil?.trim();
    if (!a && !b) return undefined;
    if ((a?.toLowerCase() === "neutral") && (b?.toLowerCase() === "neutral")) return "Neutral";
    return [a, b].filter(Boolean).join(" ");
}

function composeTypeLine(d: StatblockData): string | undefined {
    const base = d.type?.trim();
    const tags = (d.typeTags ?? []).map(tag => tag.trim()).filter(Boolean);
    if (base && tags.length) return `${base} (${tags.join(", ")})`;
    if (base) return base;
    if (tags.length) return tags.join(", ");
    return undefined;
}

function statblockToMarkdown(d: StatblockData): string {
    const identity = [d.size?.trim(), composeTypeLine(d)].filter(Boolean).join(" ");
    const alignment = composeAlignment(d);
    const header = [identity, alignment].filter(Boolean).join(", ");
    const name = d.name || "Unnamed Creature";
    const lines: string[] = [];
    lines.push("---"); lines.push("smType: creature"); lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (d.size) lines.push(`size: "${d.size}"`);
    if (d.type) lines.push(`type: "${d.type}"`);
    const typeTagsYaml = yamlList((d.typeTags ?? []).map(tag => tag?.trim()).filter((tag): tag is string => Boolean(tag && tag.length)));
    if (typeTagsYaml) lines.push(`type_tags: ${typeTagsYaml}`);
    if (alignment) lines.push(`alignment: "${alignment}"`);
    if (d.alignmentOverride) lines.push(`alignment_override: "${d.alignmentOverride.replace(/"/g, '\\"')}"`);
    if (d.ac) lines.push(`ac: "${d.ac}"`); if (d.initiative) lines.push(`initiative: "${d.initiative}"`); if (d.hp) lines.push(`hp: "${d.hp}"`); if (d.hitDice) lines.push(`hit_dice: "${d.hitDice}"`);
    const speeds = d.speeds;
    const walkSpeed = speeds?.walk?.distance;
    const swimSpeed = speeds?.swim?.distance;
    const flySpeed = speeds?.fly?.distance;
    const flyHover = speeds?.fly?.hover;
    const burrowSpeed = speeds?.burrow?.distance;
    const climbSpeed = speeds?.climb?.distance;
    if (walkSpeed) lines.push(`speed_walk: "${walkSpeed}"`);
    if (swimSpeed) lines.push(`speed_swim: "${swimSpeed}"`);
    if (flySpeed) lines.push(`speed_fly: "${flySpeed}"`);
    if (flyHover) lines.push(`speed_fly_hover: true`);
    if (burrowSpeed) lines.push(`speed_burrow: "${burrowSpeed}"`);
    if (climbSpeed) lines.push(`speed_climb: "${climbSpeed}"`);
    const extraSpeedStrings = speeds?.extras?.map(formatSpeedExtra) ?? [];
    const speedsYaml = yamlList(extraSpeedStrings);
    if (speedsYaml) lines.push(`speeds: ${speedsYaml}`);
    if (speeds) { const json = JSON.stringify(speeds).replace(/"/g, '\\"'); lines.push(`speeds_json: "${json}"`); }
    if (d.str) lines.push(`str: "${d.str}"`); if (d.dex) lines.push(`dex: "${d.dex}"`); if (d.con) lines.push(`con: "${d.con}"`); if (d.int) lines.push(`int: "${d.int}"`); if (d.wis) lines.push(`wis: "${d.wis}"`); if (d.cha) lines.push(`cha: "${d.cha}"`); if (d.pb) lines.push(`pb: "${d.pb}"`);
    if (d.saveProf) { const profs = Object.entries(d.saveProf).filter(([, v]) => !!v).map(([k]) => k.toUpperCase()); if (profs.length) lines.push(`saves_prof: ${yamlList(profs)}`); }
    if (d.skillsProf && d.skillsProf.length) lines.push(`skills_prof: ${yamlList(d.skillsProf)}`); if (d.skillsExpertise && d.skillsExpertise.length) lines.push(`skills_expertise: ${yamlList(d.skillsExpertise)}`);
    const sensesYaml = yamlList(d.sensesList); if (sensesYaml) lines.push(`senses: ${sensesYaml}`);
    const langsYaml = yamlList(d.languagesList); if (langsYaml) lines.push(`languages: ${langsYaml}`);
    const passivesYaml = yamlList(d.passivesList); if (passivesYaml) lines.push(`passives: ${passivesYaml}`);
    const vulnerabilitiesYaml = yamlList(d.damageVulnerabilitiesList); if (vulnerabilitiesYaml) lines.push(`damage_vulnerabilities: ${vulnerabilitiesYaml}`);
    const resistancesYaml = yamlList(d.damageResistancesList); if (resistancesYaml) lines.push(`damage_resistances: ${resistancesYaml}`);
    const immunitiesYaml = yamlList(d.damageImmunitiesList); if (immunitiesYaml) lines.push(`damage_immunities: ${immunitiesYaml}`);
    const conditionYaml = yamlList(d.conditionImmunitiesList); if (conditionYaml) lines.push(`condition_immunities: ${conditionYaml}`);
    const gearYaml = yamlList(d.gearList); if (gearYaml) lines.push(`gear: ${gearYaml}`);
    if (d.cr) lines.push(`cr: "${d.cr}"`); if (d.xp) lines.push(`xp: "${d.xp}"`);
    const entries = (d.entries && d.entries.length) ? d.entries : (d.actionsList && d.actionsList.length ? d.actionsList.map(a => ({ category: 'action' as const, ...a })) : undefined);
    if (entries && entries.length) { const json = JSON.stringify(entries).replace(/"/g, '\\"'); lines.push(`entries_structured_json: "${json}"`); }
    if (d.spellsKnown && d.spellsKnown.length) { const json = JSON.stringify(d.spellsKnown).replace(/"/g, '\\"'); lines.push(`spells_known_json: "${json}"`); }
    lines.push("---\n");
    lines.push(`# ${name}`);
    if (header) lines.push(`*${header}*`);
    lines.push("");
    if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
    if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);
    let speedsLine: string[] = [];
    if (extraSpeedStrings.length) speedsLine = extraSpeedStrings.slice();
    else {
        if (walkSpeed) speedsLine.push(`${walkSpeed}`);
        if (climbSpeed) speedsLine.push(`climb ${climbSpeed}`);
        if (swimSpeed) speedsLine.push(`swim ${swimSpeed}`);
        if (flySpeed) speedsLine.push(`fly ${flySpeed}${flyHover ? " (hover)" : ""}`.trim());
        if (burrowSpeed) speedsLine.push(`burrow ${burrowSpeed}`);
    }
    if (speedsLine.length) lines.push(`Speed ${speedsLine.join(", ")}`);
    lines.push("");
    const abilities = [["STR", d.str],["DEX", d.dex],["CON", d.con],["INT", d.int],["WIS", d.wis],["CHA", d.cha]] as const; if (abilities.some(([_,v])=>!!v)) { lines.push("| Ability | Score |"); lines.push("| ------: | :---- |"); for (const [k,v] of abilities) if (v) lines.push(`| ${k} | ${v} |`); lines.push(""); }
    const pbNum = parseNum(d.pb) ?? 0; if (d.saveProf) { const parts: string[] = []; const map: Array<[keyof typeof d.saveProf, string, string|undefined]> = [['str','Str',d.str],['dex','Dex',d.dex],['con','Con',d.con],['int','Int',d.int],['wis','Wis',d.wis],['cha','Cha',d.cha]]; for (const [key,label,score] of map) { if (d.saveProf[key]) { const mod = abilityMod(score) ?? 0; parts.push(`${label} ${fmtSigned(mod + pbNum)}`); } } if (parts.length) lines.push(`Saves ${parts.join(", ")}`); }
    const getSet = (arr?: string[]) => new Set((arr || []).map(s => s.trim()).filter(Boolean)); const profSet = getSet(d.skillsProf); const expSet = getSet(d.skillsExpertise);
    if (profSet.size || expSet.size) { const parts: string[] = []; const allSkills = Array.from(new Set([...Object.keys(SKILL_TO_ABILITY)])); for (const sk of allSkills) { const hasProf = profSet.has(sk) || expSet.has(sk); if (!hasProf) continue; const abilKey = SKILL_TO_ABILITY[sk]; const mod = abilityMod((d as any)[abilKey]) ?? 0; const bonus = expSet.has(sk) ? pbNum * 2 : pbNum; parts.push(`${sk} ${fmtSigned(mod + bonus)}`); } if (parts.length) lines.push(`Skills ${parts.join(", ")}`); }
    const sensesParts: string[] = [];
    if (d.sensesList && d.sensesList.length) sensesParts.push(d.sensesList.join(", "));
    const passiveChunk = d.passivesList && d.passivesList.length ? d.passivesList.join("; ") : "";
    if (sensesParts.length || passiveChunk) {
        const tail = passiveChunk ? (sensesParts.length ? `; ${passiveChunk}` : passiveChunk) : "";
        lines.push(`Senses ${[sensesParts.join(", "), tail].filter(Boolean).join("")}`);
    }
    if (d.damageVulnerabilitiesList && d.damageVulnerabilitiesList.length) lines.push(`Vulnerabilities ${d.damageVulnerabilitiesList.join(", ")}`);
    if (d.damageResistancesList && d.damageResistancesList.length) lines.push(`Resistances ${d.damageResistancesList.join(", ")}`);
    if (d.damageImmunitiesList && d.damageImmunitiesList.length) lines.push(`Immunities ${d.damageImmunitiesList.join(", ")}`);
    if (d.conditionImmunitiesList && d.conditionImmunitiesList.length) lines.push(`Condition Immunities ${d.conditionImmunitiesList.join(", ")}`);
    if (d.languagesList && d.languagesList.length) lines.push(`Languages ${d.languagesList.join(", ")}`);
    if (d.gearList && d.gearList.length) lines.push(`Gear ${d.gearList.join(", ")}`);
    if (d.cr || d.pb || d.xp) { const bits: string[] = []; if (d.cr) bits.push(`CR ${d.cr}`); if (pbNum) bits.push(`PB ${fmtSigned(pbNum)}`); if (d.xp) bits.push(`XP ${d.xp}`); if (bits.length) lines.push(bits.join("; ")); } lines.push("");
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
    return CREATURE_PIPELINE.create(app, d);
}

