// src/workmodes/library/entities/creatures/serializer.ts
// Markdown serialization for creature data
// Used as bodyTemplate in create-spec.ts

import type {
    StatblockData,
    AbilityScoreKey,
    CreatureSpeedExtra,
    SpellcastingData,
    SpellcastingSpell,
    SenseToken,
    LanguageToken,
    SimpleValueToken,
} from "./types";
import { yamlList, formatSigned, parseNumericValue, escapeJson } from "../storage/utils";

/**
 * Calculates ability modifier from ability score
 */
export function abilityModifierFromScore(score?: number | string): number | null {
    const n = typeof score === 'number' ? score : parseNumericValue(score);
    if (n == null || Number.isNaN(n)) return null;
    return Math.floor((n - 10) / 2);
}

/**
 * Gets the ability modifier for a specific ability from creature data
 */
export function getAbilityModifier(data: StatblockData, ability: AbilityScoreKey): number | null {
    const abilityScore = data.abilities?.find(a => a.ability === ability);
    return abilityScore ? abilityModifierFromScore(abilityScore.score) : null;
}

/**
 * Gets the proficiency bonus from creature data
 */
export function getProficiencyBonus(data: Pick<StatblockData, "pb">): number | null {
    return parseNumericValue(data.pb);
}

/**
 * Calculates spell save DC
 */
export function calculateSaveDc({
    abilityMod,
    proficiencyBonus,
    override
}: {
    abilityMod: number | null | undefined;
    proficiencyBonus: number | null | undefined;
    override?: number | null;
}): number | null {
    if (override != null) return override;
    if (abilityMod == null || proficiencyBonus == null) return null;
    return 8 + abilityMod + proficiencyBonus;
}

/**
 * Calculates spell attack bonus
 */
export function calculateAttackBonus({
    abilityMod,
    proficiencyBonus,
    override
}: {
    abilityMod: number | null | undefined;
    proficiencyBonus: number | null | undefined;
    override?: number | null;
}): number | null {
    if (override != null) return override;
    if (abilityMod == null || proficiencyBonus == null) return null;
    return abilityMod + proficiencyBonus;
}

/**
 * Maps skill names to their associated abilities
 */
const SKILL_TO_ABILITY: Record<string, AbilityScoreKey> = {
    Athletics: 'str',
    Acrobatics: 'dex',
    'Sleight of Hand': 'dex',
    Stealth: 'dex',
    Arcana: 'int',
    History: 'int',
    Investigation: 'int',
    Nature: 'int',
    Religion: 'int',
    'Animal Handling': 'wis',
    Insight: 'wis',
    Medicine: 'wis',
    Perception: 'wis',
    Survival: 'wis',
    Deception: 'cha',
    Intimidation: 'cha',
    Performance: 'cha',
    Persuasion: 'cha',
};

/**
 * Composes alignment string from law/chaos and good/evil values
 */
function composeAlignment(d: StatblockData): string | undefined {
    const override = d.alignmentOverride?.trim();
    if (override) return override;
    const a = d.alignmentLawChaos?.trim();
    const b = d.alignmentGoodEvil?.trim();
    if (!a && !b) return undefined;
    if ((a?.toLowerCase() === "neutral") && (b?.toLowerCase() === "neutral")) return "Neutral";
    return [a, b].filter(Boolean).join(" ");
}

/**
 * Composes type line from base type and tags
 */
function composeTypeLine(d: StatblockData): string | undefined {
    const base = d.type?.trim();
    const tags = (d.typeTags ?? []).map(tag => tag.trim()).filter(Boolean);
    if (base && tags.length) return `${base} (${tags.join(", ")})`;
    if (base) return base;
    if (tags.length) return tags.join(", ");
    return undefined;
}

/**
 * Formats a speed extra entry
 */
function formatSpeedExtra(entry: CreatureSpeedExtra): string {
    const parts = [entry.label];
    if (entry.distance) parts.push(entry.distance);
    if (entry.note) parts.push(entry.note);
    if (entry.hover) parts.push("(hover)");
    return parts.map(p => p?.trim()).filter((p): p is string => Boolean(p && p.length)).join(" ");
}

/**
 * Serializes a sense token to a string
 * Examples:
 *   {type: "darkvision", range: "120"} → "darkvision 120 ft."
 *   {value: "blindsense within 10 ft."} → "blindsense within 10 ft."
 */
function serializeSense(sense: SenseToken): string {
    if (sense.value) return sense.value;
    if (sense.type && sense.range) return `${sense.type} ${sense.range} ft.`;
    if (sense.type) return sense.type;
    return '';
}

/**
 * Serializes a language token to a string
 * Examples:
 *   {value: "Common"} → "Common"
 *   {type: "telepathy", range: "120"} → "telepathy 120 ft."
 */
function serializeLanguage(lang: LanguageToken): string {
    if (lang.value) return lang.value;
    if (lang.type === 'telepathy' && lang.range) return `telepathy ${lang.range} ft.`;
    if (lang.type) return lang.type;
    return '';
}

/**
 * Serializes a simple value token to a string
 * Examples:
 *   {value: "Passive Perception 20"} → "Passive Perception 20"
 *   {value: "Acid"} → "Acid"
 */
function serializeSimpleToken(token: SimpleValueToken): string {
    return token.value;
}

/**
 * Resolves spellcasting data with computed values
 */
function resolveSpellcastingData(d: StatblockData): SpellcastingData | undefined {
    if (!d.spellcasting) return undefined;
    return withComputedSpellcasting(d, d.spellcasting);
}

/**
 * Adds computed values to spellcasting data
 */
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

/**
 * Renders spellcasting section in markdown
 */
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
    if (attackBonus != null) summaryParts.push(`${formatSigned(attackBonus)} to hit with spell attacks`);
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

/**
 * Renders a spell group in markdown
 */
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

/**
 * Formats a spell level as a heading (e.g., "Cantrips", "1st Level")
 */
function formatSpellLevelHeading(level: number): string {
    if (level <= 0) return "Cantrips";
    const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
    return `${level}${suffix} Level`;
}

/**
 * Serializes a StatblockData object to Markdown format.
 * This function is used as the bodyTemplate in the create-spec.
 */
export function statblockToMarkdown(d: StatblockData): string {
    const identity = [d.size?.trim(), composeTypeLine(d)].filter(Boolean).join(" ");
    const alignment = composeAlignment(d);
    const header = [identity, alignment].filter(Boolean).join(", ");
    const name = d.name || "Unnamed Creature";
    const lines: string[] = [];

    // === Frontmatter handled by data-manager/storage ===
    // We only generate the body

    // Header
    lines.push(`# ${name}`);
    if (header) lines.push(`*${header}*`);
    lines.push("");

    // Basic stats
    if (d.ac || d.initiative) lines.push(`AC ${d.ac ?? "-"}    Initiative ${d.initiative ?? "-"}`);
    if (d.hp || d.hitDice) lines.push(`HP ${d.hp ?? "-"}${d.hitDice ? ` (${d.hitDice})` : ""}`);

    // Speed
    const speeds = d.speeds;
    if (speeds) {
        const speedParts: string[] = [];

        // Handle new array format
        if (Array.isArray(speeds)) {
            for (const entry of speeds) {
                const prefix = entry.type === 'walk' ? '' : `${entry.type} `;
                const hoverSuffix = entry.hover ? ' (hover)' : '';
                const noteSuffix = entry.note ? ` (${entry.note})` : '';
                speedParts.push(`${prefix}${entry.value}${hoverSuffix}${noteSuffix}`);
            }
        }
        // Handle legacy object format (backward compatibility)
        else {
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
        }

        if (speedParts.length) lines.push(`Speed ${speedParts.join(", ")}`);
    }
    lines.push("");

    // Abilities table
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

    // Saves
    const pbValue = parseNumericValue(d.pb);
    if (d.saves && d.saves.length) {
        const abilityLabels: Record<AbilityScoreKey, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
        const parts = d.saves.map(save => `${abilityLabels[save.ability]} ${formatSigned(save.bonus)}`);
        lines.push(`Saves ${parts.join(", ")}`);
    }

    // Skills
    if (d.skills && d.skills.length) {
        const parts = d.skills.map(skill => `${skill.name} ${formatSigned(skill.bonus)}`);
        lines.push(`Skills ${parts.join(", ")}`);
    }

    // Senses
    const sensesParts: string[] = [];
    if (d.sensesList && d.sensesList.length) {
        sensesParts.push(d.sensesList.map(serializeSense).filter(Boolean).join(", "));
    }
    const passiveChunk = d.passivesList && d.passivesList.length
        ? d.passivesList.map(serializeSimpleToken).filter(Boolean).join("; ")
        : "";
    if (sensesParts.length || passiveChunk) {
        const tail = passiveChunk ? (sensesParts.length ? `; ${passiveChunk}` : passiveChunk) : "";
        lines.push(`Senses ${[sensesParts.join(", "), tail].filter(Boolean).join("")}`);
    }

    // Resistances/Immunities
    if (d.damageVulnerabilitiesList && d.damageVulnerabilitiesList.length) {
        lines.push(`Vulnerabilities ${d.damageVulnerabilitiesList.map(serializeSimpleToken).filter(Boolean).join(", ")}`);
    }
    if (d.damageResistancesList && d.damageResistancesList.length) {
        lines.push(`Resistances ${d.damageResistancesList.map(serializeSimpleToken).filter(Boolean).join(", ")}`);
    }
    if (d.damageImmunitiesList && d.damageImmunitiesList.length) {
        lines.push(`Immunities ${d.damageImmunitiesList.map(serializeSimpleToken).filter(Boolean).join(", ")}`);
    }
    if (d.conditionImmunitiesList && d.conditionImmunitiesList.length) {
        lines.push(`Condition Immunities ${d.conditionImmunitiesList.map(serializeSimpleToken).filter(Boolean).join(", ")}`);
    }

    // Languages & Gear
    if (d.languagesList && d.languagesList.length) {
        lines.push(`Languages ${d.languagesList.map(serializeLanguage).filter(Boolean).join(", ")}`);
    }
    if (d.gearList && d.gearList.length) {
        lines.push(`Gear ${d.gearList.map(serializeSimpleToken).filter(Boolean).join(", ")}`);
    }

    // CR/PB/XP
    if (d.cr || d.pb || d.xp) {
        const bits: string[] = [];
        if (d.cr) bits.push(`CR ${d.cr}`);
        if (pbValue != null && !Number.isNaN(pbValue) && pbValue !== 0) bits.push(`PB ${formatSigned(pbValue)}`);
        if (d.xp) bits.push(`XP ${d.xp}`);
        if (bits.length) lines.push(bits.join("; "));
    }
    lines.push("");

    // Entries (traits, actions, etc.)
    const entries = (d.entries && d.entries.length) ? d.entries : (d.actionsList && d.actionsList.length ? d.actionsList.map(a => ({ category: 'action' as const, ...a })) : undefined);
    if (entries && entries.length) {
        const groups: Record<string, typeof entries> = { trait: [], action: [], bonus: [], reaction: [], legendary: [] } as any;
        for (const e of entries) {
            (groups[e.category] ||= []).push(e);
        }

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
                        ? Math.max(abilityModifierFromScore((d as any).str) ?? 0, abilityModifierFromScore((d as any).dex) ?? 0)
                        : (abilityModifierFromScore((d as any)[abil]) ?? 0);
                    const pb = parseNumericValue(d.pb) ?? 0;
                    const total = abilMod + (a.to_hit_from.proficient ? pb : 0);
                    sub.push(`to hit ${formatSigned(total)}`);
                }
                if (a.range) sub.push(a.range);
                if (a.target) sub.push(a.target);
                if (a.damage) sub.push(a.damage);
                else if (a.damage_from) {
                    const abilKey = a.damage_from.ability;
                    const abilMod = abilKey
                        ? (abilKey === 'best_of_str_dex'
                            ? Math.max(abilityModifierFromScore((d as any).str) ?? 0, abilityModifierFromScore((d as any).dex) ?? 0)
                            : (abilityModifierFromScore((d as any)[abilKey]) ?? 0))
                        : 0;
                    const bonus = a.damage_from.bonus ? ` ${a.damage_from.bonus}` : '';
                    const modTxt = abilMod ? ` ${formatSigned(abilMod)}` : '';
                    sub.push(`${a.damage_from.dice}${modTxt}${bonus}`.trim());
                }
                if (a.save_ability) sub.push(`Save ${a.save_ability}${a.save_dc ? ` DC ${a.save_dc}` : ''}${a.save_effect ? ` (${a.save_effect})` : ''}`);
                if (sub.length) lines.push(`  - ${sub.join(", ")}`);
                if (a.text && a.text.trim()) lines.push(`  ${a.text.trim()}`);
            }
            lines.push("");
        };

        renderGroup("Traits", groups.trait);
        renderGroup("Actions", groups.action);
        renderGroup("Bonus Actions", groups.bonus);
        renderGroup("Reactions", groups.reaction);
        renderGroup("Legendary Actions", groups.legendary);
    } else {
        // Legacy text format
        if (d.traits) {
            lines.push("## Traits\n");
            lines.push(d.traits.trim());
            lines.push("");
        }
        if (d.actions) {
            lines.push("## Actions\n");
            lines.push(d.actions.trim());
            lines.push("");
        }
        if (d.legendary) {
            lines.push("## Legendary Actions\n");
            lines.push(d.legendary.trim());
            lines.push("");
        }
    }

    // Spellcasting
    const spellcasting = resolveSpellcastingData(d);
    if (spellcasting && spellcasting.groups.length) {
        renderSpellcasting(lines, d, spellcasting);
    }

    return lines.join("\n");
}
