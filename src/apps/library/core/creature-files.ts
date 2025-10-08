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

export type AbilityScoreKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SpellcastingAbility = AbilityScoreKey;

export type SpellcastingSpell = {
    name: string;
    notes?: string;
    prepared?: boolean;
};

export type SpellcastingGroupAtWill = {
    type: "at-will";
    title?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupPerDay = {
    type: "per-day";
    uses: string;
    title?: string;
    note?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupLevel = {
    type: "level";
    level: number;
    title?: string;
    slots?: number | string;
    note?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupCustom = {
    type: "custom";
    title: string;
    description?: string;
    spells?: SpellcastingSpell[];
};

export type SpellcastingGroup =
    | SpellcastingGroupAtWill
    | SpellcastingGroupPerDay
    | SpellcastingGroupLevel
    | SpellcastingGroupCustom;

export type SpellcastingComputedValues = {
    abilityMod?: number | null;
    proficiencyBonus?: number | null;
    saveDc?: number | null;
    attackBonus?: number | null;
};

export type SpellcastingData = {
    title?: string;
    summary?: string;
    ability?: SpellcastingAbility;
    saveDcOverride?: number;
    attackBonusOverride?: number;
    notes?: string[];
    groups: SpellcastingGroup[];
    computed?: SpellcastingComputedValues;
};

/**
 * Ability score with value
 */
export type AbilityScore = {
    ability: AbilityScoreKey;
    score: number;
};

/**
 * New format for saving throws with explicit bonuses
 * Replaces boolean-only saveProf to support custom modifiers
 */
export type SaveBonus = {
    ability: AbilityScoreKey;
    bonus: number;
};

/**
 * New format for skills with explicit bonuses
 * Replaces skillsProf/skillsExpertise to support custom modifiers
 */
export type SkillBonus = {
    name: string;
    bonus: number;
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
    abilities?: AbilityScore[];
    pb?: string;
    saves?: SaveBonus[];
    skills?: SkillBonus[];

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
    spellcasting?: SpellcastingData;
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
export function parseNumericValue(v?: string): number | null { if (!v) return null; const m = String(v).match(/-?\d+/); if (!m) return null; return Number(m[0]); }
export function abilityModifierFromScore(score?: number | string): number | null { const n = typeof score === 'number' ? score : parseNumericValue(score); if (n == null || Number.isNaN(n)) return null; return Math.floor((n - 10) / 2); }
export function getAbilityModifier(data: StatblockData, ability: AbilityScoreKey): number | null {
    const abilityScore = data.abilities?.find(a => a.ability === ability);
    return abilityScore ? abilityModifierFromScore(abilityScore.score) : null;
}
export function getProficiencyBonus(data: Pick<StatblockData, "pb">): number | null { return parseNumericValue(data.pb); }
export function calculateSaveDc({ abilityMod, proficiencyBonus, override }: { abilityMod: number | null | undefined; proficiencyBonus: number | null | undefined; override?: number | null; }): number | null {
    if (override != null) return override;
    if (abilityMod == null || proficiencyBonus == null) return null;
    return 8 + abilityMod + proficiencyBonus;
}
export function calculateAttackBonus({ abilityMod, proficiencyBonus, override }: { abilityMod: number | null | undefined; proficiencyBonus: number | null | undefined; override?: number | null; }): number | null {
    if (override != null) return override;
    if (abilityMod == null || proficiencyBonus == null) return null;
    return abilityMod + proficiencyBonus;
}
function fmtSigned(n: number): string { return (n >= 0 ? "+" : "") + n; }
const SKILL_TO_ABILITY: Record<string, AbilityScoreKey> = { Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha', };
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


export function statblockToMarkdown(d: StatblockData): string {
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
    if (speeds) { const json = JSON.stringify(speeds).replace(/"/g, '\\"'); lines.push(`speeds_json: "${json}"`); }
    if (d.abilities && d.abilities.length) { const json = JSON.stringify(d.abilities).replace(/"/g, '\\"'); lines.push(`abilities_json: "${json}"`); }
    if (d.pb) lines.push(`pb: "${d.pb}"`);
    if (d.saves && d.saves.length) { const json = JSON.stringify(d.saves).replace(/"/g, '\\"'); lines.push(`saves_json: "${json}"`); }
    if (d.skills && d.skills.length) { const json = JSON.stringify(d.skills).replace(/"/g, '\\"'); lines.push(`skills_json: "${json}"`); }
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
    const spellcasting = resolveSpellcastingData(d);
    if (spellcasting && spellcasting.groups.length) {
        const json = JSON.stringify(spellcasting).replace(/"/g, '\\"');
        lines.push(`spellcasting_json: "${json}"`);
    }
    lines.push("---\n");
    lines.push(`# ${name}`);
    if (header) lines.push(`*${header}*`);
    lines.push("");
    if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
    if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);
    if (speeds) {
        const speedParts: string[] = [];
        if (speeds.walk?.distance) speedParts.push(speeds.walk.distance);
        if (speeds.climb?.distance) speedParts.push(`climb ${speeds.climb.distance}`);
        if (speeds.swim?.distance) speedParts.push(`swim ${speeds.swim.distance}`);
        if (speeds.fly?.distance) speedParts.push(`fly ${speeds.fly.distance}${speeds.fly.hover ? " (hover)" : ""}`);
        if (speeds.burrow?.distance) speedParts.push(`burrow ${speeds.burrow.distance}`);
        if (speeds.extras) {
            for (const extra of speeds.extras) {
                speedParts.push(formatSpeedExtra(extra));
            }
        }
        if (speedParts.length) lines.push(`Speed ${speedParts.join(", ")}`);
    }
    lines.push("");
    if (d.abilities && d.abilities.length) {
        lines.push("| Ability | Score |");
        lines.push("| ------: | :---- |");
        const abilityLabels: Record<AbilityScoreKey, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
        const orderedAbilities: AbilityScoreKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        for (const key of orderedAbilities) {
            const ability = d.abilities.find(a => a.ability === key);
            if (ability) {
                lines.push(`| ${abilityLabels[key]} | ${ability.score} |`);
            }
        }
        lines.push("");
    }
    const pbValue = parseNumericValue(d.pb);
    if (d.saves && d.saves.length) {
        const abilityLabels: Record<AbilityScoreKey, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
        const parts = d.saves.map(save => `${abilityLabels[save.ability]} ${fmtSigned(save.bonus)}`);
        lines.push(`Saves ${parts.join(", ")}`);
    }
    if (d.skills && d.skills.length) {
        const parts = d.skills.map(skill => `${skill.name} ${fmtSigned(skill.bonus)}`);
        lines.push(`Skills ${parts.join(", ")}`);
    }
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
    if (d.cr || d.pb || d.xp) { const bits: string[] = []; if (d.cr) bits.push(`CR ${d.cr}`); if (pbValue != null && !Number.isNaN(pbValue) && pbValue !== 0) bits.push(`PB ${fmtSigned(pbValue)}`); if (d.xp) bits.push(`XP ${d.xp}`); if (bits.length) lines.push(bits.join("; ")); } lines.push("");
    if (entries && entries.length) {
        const groups: Record<string, typeof entries> = { trait: [], action: [], bonus: [], reaction: [], legendary: [] } as any;
        for (const e of entries) { (groups[e.category] ||= []).push(e); }
        const renderGroup = (title: string, arr: typeof entries) => {
            if (!arr || arr.length === 0) return;
            lines.push(`## ${title}\n`);
            for (const a of arr) {
                const headParts = [a.name, a.recharge].filter(Boolean).join(" ");
                lines.push(`- **${headParts}**`);
                const sub: string[] = [];
                if (a.kind) sub.push(a.kind);
                if (a.to_hit) sub.push(`to hit ${a.to_hit}`);
                else if (a.to_hit_from) {
                    const abil = a.to_hit_from.ability;
                    const abilMod = abil === 'best_of_str_dex'
                        ? Math.max(abilityModifierFromScore(d.str) ?? 0, abilityModifierFromScore(d.dex) ?? 0)
                        : (abilityModifierFromScore((d as any)[abil]) ?? 0);
                    const pb = parseNumericValue(d.pb) ?? 0;
                    const total = abilMod + (a.to_hit_from.proficient ? pb : 0);
                    sub.push(`to hit ${fmtSigned(total)}`);
                }
                if (a.range) sub.push(a.range);
                if (a.target) sub.push(a.target);
                if (a.damage) sub.push(a.damage);
                else if (a.damage_from) {
                    const abilKey = a.damage_from.ability;
                    const abilMod = abilKey
                        ? (abilKey === 'best_of_str_dex'
                            ? Math.max(abilityModifierFromScore(d.str) ?? 0, abilityModifierFromScore(d.dex) ?? 0)
                            : (abilityModifierFromScore((d as any)[abilKey]) ?? 0))
                        : 0;
                    const bonus = a.damage_from.bonus ? ` ${a.damage_from.bonus}` : '';
                    const modTxt = abilMod ? ` ${fmtSigned(abilMod)}` : '';
                    sub.push(`${a.damage_from.dice}${modTxt}${bonus}`.trim());
                }
                if (a.save_ability) sub.push(`Save ${a.save_ability}${a.save_dc ? ` DC ${a.save_dc}` : ''}${a.save_effect ? ` (${a.save_effect})` : ''}`);
                if (sub.length) lines.push(`  - ${sub.join(", ")}`);
                if (a.text && a.text.trim()) lines.push(`  ${a.text.trim()}`);
            }
            lines.push("");
        };
        renderGroup("Traits", groups.trait); renderGroup("Actions", groups.action); renderGroup("Bonus Actions", groups.bonus); renderGroup("Reactions", groups.reaction); renderGroup("Legendary Actions", groups.legendary);
    } else {
        if (d.traits) { lines.push("## Traits\n"); lines.push(d.traits.trim()); lines.push(""); }
        if (d.actions) { lines.push("## Actions\n"); lines.push(d.actions.trim()); lines.push(""); }
        if (d.legendary) { lines.push("## Legendary Actions\n"); lines.push(d.legendary.trim()); lines.push(""); }
    }
    if (spellcasting && spellcasting.groups.length) {
        renderSpellcasting(lines, d, spellcasting);
    }
    return lines.join("\n");
}

function resolveSpellcastingData(d: StatblockData): SpellcastingData | undefined {
    if (!d.spellcasting) return undefined;
    return withComputedSpellcasting(d, d.spellcasting);
}

function withComputedSpellcasting(d: StatblockData, base: SpellcastingData): SpellcastingData {
    const abilityMod = base.ability ? getAbilityModifier(d, base.ability) : null;
    const proficiencyBonus = getProficiencyBonus(d);
    const saveDc = calculateSaveDc({ abilityMod, proficiencyBonus, override: base.saveDcOverride });
    const attackBonus = calculateAttackBonus({ abilityMod, proficiencyBonus, override: base.attackBonusOverride });
    return {
        ...base,
        computed: {
            abilityMod,
            proficiencyBonus,
            saveDc,
            attackBonus,
        },
    };
}

function renderSpellcasting(lines: string[], d: StatblockData, spellcasting: SpellcastingData): void {
    const title = spellcasting.title?.trim() || "Spellcasting";
    lines.push(`## ${title}`);
    lines.push("");
    if (spellcasting.summary) {
        lines.push(spellcasting.summary.trim());
        lines.push("");
    }
    const saveDc = spellcasting.computed?.saveDc;
    const attackBonus = spellcasting.computed?.attackBonus;
    const summaryParts: string[] = [];
    if (saveDc != null) summaryParts.push(`Spell save DC ${saveDc}`);
    if (attackBonus != null) summaryParts.push(`${fmtSigned(attackBonus)} to hit with spell attacks`);
    if (summaryParts.length) {
        lines.push(`*${summaryParts.join(", ")}*`);
        lines.push("");
    }
    if (spellcasting.notes && spellcasting.notes.length) {
        for (const note of spellcasting.notes) {
            if (note && note.trim()) {
                lines.push(note.trim());
            }
        }
        if (spellcasting.notes.some(note => note && note.trim())) {
            lines.push("");
        }
    }
    for (const group of spellcasting.groups) {
        switch (group.type) {
            case "at-will":
                renderSpellGroup(lines, group.title ?? "At Will", group.spells);
                break;
            case "per-day": {
                const heading = group.title ?? group.uses;
                renderSpellGroup(lines, heading, group.spells, group.note);
                break;
            }
            case "level": {
                const base = group.title ?? formatSpellLevelHeading(group.level);
                const slots = group.slots == null ? undefined : (typeof group.slots === "number" ? `${group.slots} slot${group.slots === 1 ? "" : "s"}` : String(group.slots));
                const heading = slots ? `${base} (${slots})` : base;
                renderSpellGroup(lines, heading, group.spells, group.note);
                break;
            }
            case "custom": {
                renderSpellGroup(lines, group.title, group.spells ?? [], group.description);
                break;
            }
        }
    }
    if (lines[lines.length - 1] !== "") lines.push("");
}

function renderSpellGroup(lines: string[], heading: string, spells: SpellcastingSpell[], note?: string): void {
    lines.push(`### ${heading}`);
    lines.push("");
    if (note && note.trim()) {
        lines.push(note.trim());
        lines.push("");
    }
    if (!spells.length) {
        lines.push("- none");
        lines.push("");
        return;
    }
    for (const spell of spells) {
        const details: string[] = [];
        if (spell.prepared != null) details.push(spell.prepared ? "prepared" : "known");
        if (spell.notes) details.push(spell.notes);
        const suffix = details.length ? ` (${details.join(", ")})` : "";
        lines.push(`- ${spell.name}${suffix}`);
    }
    lines.push("");
}

function formatSpellLevelHeading(level: number): string {
    if (level <= 0) return "Cantrips";
    const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
    return `${level}${suffix} Level`;
}
export async function createCreatureFile(app: App, d: StatblockData): Promise<TFile> {
    return CREATURE_PIPELINE.create(app, d);
}
