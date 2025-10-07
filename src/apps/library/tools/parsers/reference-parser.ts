// src/apps/library/core/reference-parser.ts
// Parst Reference Statblock Markdown zu StatblockData

import type { StatblockData, CreatureSpeeds, AbilityScoreKey, SpellcastingData, SpellcastingGroup } from "./creature-files";

/**
 * Parst einen Reference Statblock (reines Markdown ohne Frontmatter) zu StatblockData.
 *
 * Reference Format:
 * - # Name
 * - *Size Type, Alignment*
 * - Bullet list mit AC, HP, Speed, Initiative
 * - Ability Tabelle (4 Spalten: STAT, SCORE, MOD, SAVE)
 * - Bullet list mit Skills, Senses, Languages, CR
 * - Sektionen: ### Traits, ### Actions, ### Bonus Actions, ### Reactions, ### Legendary Actions
 */
export function parseReferenceStatblock(markdown: string): StatblockData {
    const lines = markdown.split('\n').map(line => line.trim());

    const data: StatblockData = { name: "" };

    // 1. Name aus H1
    data.name = extractH1(lines);

    // 2. Subtitle (Size, Type, Alignment)
    const subtitle = extractSubtitle(lines);
    if (subtitle) {
        const parsed = parseSubtitle(subtitle);
        data.size = parsed.size;
        data.type = parsed.type;
        data.typeTags = parsed.typeTags;
        data.alignmentLawChaos = parsed.alignmentLawChaos;
        data.alignmentGoodEvil = parsed.alignmentGoodEvil;
        data.alignmentOverride = parsed.alignmentOverride;
    }

    // 3. Bullet-Liste für Basis-Stats
    const bullets = extractBulletStats(lines);
    data.ac = bullets.get("armor class");

    // Initiative parsen: "+3 (13)" -> "+3"
    const initiativeText = bullets.get("initiative");
    if (initiativeText) {
        const match = initiativeText.match(/^([+\-]?\d+)/);
        data.initiative = match ? match[1] : initiativeText;
    }

    const hpText = bullets.get("hit points");
    if (hpText) {
        const { hp, hitDice } = parseHitPoints(hpText);
        data.hp = hp;
        data.hitDice = hitDice;
    }

    const speedText = bullets.get("speed");
    if (speedText) {
        data.speeds = parseSpeed(speedText);
    }

    const skillsText = bullets.get("skills");
    if (skillsText) {
        data.skillsProf = parseSkills(skillsText);
    }

    const sensesText = bullets.get("senses");
    if (sensesText) {
        const { senses, passives } = parseSenses(sensesText);
        data.sensesList = senses;
        data.passivesList = passives;
    }

    const languagesText = bullets.get("languages");
    if (languagesText) {
        data.languagesList = parseList(languagesText);
    }

    const gearText = bullets.get("gear");
    if (gearText) {
        data.gearList = parseList(gearText);
    }

    const immunitiesText = bullets.get("immunities");
    if (immunitiesText) {
        data.damageImmunitiesList = parseList(immunitiesText);
    }

    const resistancesText = bullets.get("resistances");
    if (resistancesText) {
        data.damageResistancesList = parseList(resistancesText);
    }

    const vulnerabilitiesText = bullets.get("vulnerabilities");
    if (vulnerabilitiesText) {
        data.damageVulnerabilitiesList = parseList(vulnerabilitiesText);
    }

    const crText = bullets.get("cr");
    if (crText) {
        const { cr, xp, pb } = parseCRLine(crText);
        data.cr = cr;
        data.xp = xp;
        data.pb = pb || calculatePBFromCR(cr); // Fallback: berechne aus CR
    }

    // 4. Ability Tabelle
    const abilityTable = extractAbilityTable(lines);
    if (abilityTable) {
        data.str = abilityTable.str.score;
        data.dex = abilityTable.dex.score;
        data.con = abilityTable.con.score;
        data.int = abilityTable.int.score;
        data.wis = abilityTable.wis.score;
        data.cha = abilityTable.cha.score;

        // Save Proficiencies aus Tabelle ableiten
        data.saveProf = determineSaveProficiencies(abilityTable, data.pb);
    }

    // 5. Sektionen (Traits, Actions, etc.)
    const sections = extractSections(lines);
    data.entries = parseSections(sections, data);

    // 6. Spellcasting extrahieren
    data.spellcasting = extractSpellcasting(data.entries || []);

    return data;
}

function extractH1(lines: string[]): string {
    for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/);
        if (match) return match[1].trim();
    }
    return "Unknown Creature";
}

function extractSubtitle(lines: string[]): string | null {
    for (const line of lines) {
        const match = line.match(/^\*(.+)\*$/);
        if (match) return match[1].trim();
    }
    return null;
}

function parseSubtitle(subtitle: string): {
    size?: string;
    type?: string;
    typeTags?: string[];
    alignmentLawChaos?: string;
    alignmentGoodEvil?: string;
    alignmentOverride?: string;
} {
    // Format: "Size Type, Alignment" oder "Size Type (Tags), Alignment"
    const parts = subtitle.split(',').map(p => p.trim());
    if (parts.length === 0) return {};

    const firstPart = parts[0]; // "Medium Beast" oder "Large Aberration"
    const secondPart = parts[1]; // "Unaligned" oder "Lawful Evil"

    const result: ReturnType<typeof parseSubtitle> = {};

    // Parse Size und Type
    const typeMatch = firstPart.match(/^(\w+)\s+(.+)$/);
    if (typeMatch) {
        result.size = typeMatch[1];
        const typeWithTags = typeMatch[2];

        // Check für Tags: "Type (Tag1, Tag2)"
        const tagMatch = typeWithTags.match(/^(.+?)\s*\((.+)\)$/);
        if (tagMatch) {
            result.type = tagMatch[1].trim();
            result.typeTags = tagMatch[2].split(',').map(t => t.trim());
        } else {
            result.type = typeWithTags;
        }
    }

    // Parse Alignment
    if (secondPart) {
        const alignment = parseAlignment(secondPart);
        result.alignmentLawChaos = alignment.lawChaos;
        result.alignmentGoodEvil = alignment.goodEvil;
        result.alignmentOverride = alignment.override;
    }

    return result;
}

function parseAlignment(text: string): {
    lawChaos?: string;
    goodEvil?: string;
    override?: string;
} {
    const normalized = text.toLowerCase().trim();

    // Spezialfälle
    if (normalized === "unaligned" || normalized === "any alignment") {
        return { override: text };
    }

    // "Neutral" alleine
    if (normalized === "neutral") {
        return { lawChaos: "Neutral", goodEvil: "Neutral" };
    }

    // Parse "Lawful Evil", "Chaotic Good", etc.
    const words = text.split(/\s+/);
    if (words.length === 2) {
        return { lawChaos: words[0], goodEvil: words[1] };
    } else if (words.length === 1) {
        // Nur ein Wort - könnte "Good", "Evil", "Chaotic" etc. sein
        const word = words[0];
        if (["Good", "Evil"].includes(word)) {
            return { goodEvil: word };
        } else if (["Lawful", "Chaotic"].includes(word)) {
            return { lawChaos: word };
        }
    }

    return { override: text };
}

function extractBulletStats(lines: string[]): Map<string, string> {
    const stats = new Map<string, string>();

    for (const line of lines) {
        // Match "- **Label:** Value" oder "**Label:** Value"
        let match = line.match(/^-?\s*\*\*(.+?):\*\*\s*(.+)$/);
        if (match) {
            const label = match[1].toLowerCase().trim();
            const value = match[2].trim();
            stats.set(label, value);
            continue;
        }

        // Match ohne Doppelpunkt am Ende: "- **Label**: Value"
        match = line.match(/^-?\s*\*\*(.+?)\*\*:?\s+(.+)$/);
        if (match) {
            const label = match[1].toLowerCase().trim();
            const value = match[2].trim();
            stats.set(label, value);
        }
    }

    return stats;
}

function parseHitPoints(text: string): { hp?: string; hitDice?: string } {
    // Format: "150 (20d10 + 40)" oder nur "150"
    const match = text.match(/^(\d+)\s*(?:\((.+?)\))?/);
    if (match) {
        return {
            hp: match[1],
            hitDice: match[2] || undefined,
        };
    }
    return { hp: text };
}

function parseSpeed(text: string): CreatureSpeeds {
    // Format: "30 ft., Climb 30 ft., Fly 80 ft. (hover)"
    const speeds: CreatureSpeeds = {};
    const parts = text.split(',').map(p => p.trim());

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Erste ohne Label ist walk
        if (i === 0 && !part.match(/^(walk|climb|fly|swim|burrow)/i)) {
            const match = part.match(/^(\d+\s*ft\.?)/);
            if (match) {
                speeds.walk = { distance: match[1] };
            }
            continue;
        }

        // Mit Label
        const match = part.match(/^(walk|climb|fly|swim|burrow)\s+(\d+\s*ft\.?)(\s*\(hover\))?/i);
        if (match) {
            const type = match[1].toLowerCase() as keyof CreatureSpeeds;
            const distance = match[2];
            const hover = !!match[3];

            if (type === 'walk' || type === 'climb' || type === 'fly' || type === 'swim' || type === 'burrow') {
                speeds[type] = { distance };
                if (type === 'fly' && hover) {
                    speeds.fly!.hover = true;
                }
            }
        }
    }

    return speeds;
}

function parseSkills(text: string): string[] {
    // Format: "Athletics +5, Perception +3"
    const skills: string[] = [];
    const parts = text.split(',').map(p => p.trim());

    for (const part of parts) {
        const match = part.match(/^(.+?)\s+[+\-]\d+/);
        if (match) {
            skills.push(match[1].trim());
        }
    }

    return skills;
}

function parseSenses(text: string): { senses: string[]; passives: string[] } {
    // Format: "darkvision 120 ft.; Passive Perception 20"
    // Split an Semikolon
    const parts = text.split(';').map(p => p.trim());

    const senses: string[] = [];
    const passives: string[] = [];

    for (const part of parts) {
        if (part.toLowerCase().startsWith('passive')) {
            passives.push(part);
        } else if (part) {
            // Senses können kommasepariert sein
            senses.push(...part.split(',').map(s => s.trim()).filter(Boolean));
        }
    }

    return { senses, passives };
}

function parseList(text: string): string[] {
    // Komma- oder semikolonseparierte Liste
    return text.split(/[,;]/).map(item => item.trim()).filter(Boolean);
}

function parseCRLine(text: string): { cr?: string; xp?: string; pb?: string } {
    // Format: "1/2 (XP 100; PB +2)" oder "10 (XP 5,900, or 7,200 in lair)"
    const result: { cr?: string; xp?: string; pb?: string } = {};

    // CR ist der erste Teil
    const crMatch = text.match(/^([\d/]+)/);
    if (crMatch) {
        result.cr = crMatch[1];
    }

    // XP extrahieren
    const xpMatch = text.match(/XP\s+([\d,]+)/);
    if (xpMatch) {
        result.xp = xpMatch[1].replace(/,/g, '');
    }

    // PB extrahieren
    const pbMatch = text.match(/PB\s+([+\-]?\d+)/);
    if (pbMatch) {
        result.pb = pbMatch[1];
    }

    return result;
}

/**
 * Berechnet den Proficiency Bonus aus dem CR
 */
function calculatePBFromCR(cr?: string): string | undefined {
    if (!cr) return undefined;

    // Parse CR (kann "1/4", "1/2", "10" etc. sein)
    let crValue: number;
    if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(Number);
        crValue = num / denom;
    } else {
        crValue = Number(cr);
    }

    if (isNaN(crValue)) return undefined;

    // PB nach Tabelle
    if (crValue <= 4) return '+2';
    if (crValue <= 8) return '+3';
    if (crValue <= 12) return '+4';
    if (crValue <= 16) return '+5';
    if (crValue <= 20) return '+6';
    if (crValue <= 24) return '+7';
    if (crValue <= 28) return '+8';
    return '+9';
}

type AbilityRow = { score: string; mod: number; save: number };
type AbilityTableData = Record<AbilityScoreKey, AbilityRow>;

function extractAbilityTable(lines: string[]): AbilityTableData | null {
    // Finde Tabelle mit | STAT | SCORE | MOD | SAVE |
    let tableStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('| STAT |') || lines[i].includes('|STAT|')) {
            tableStart = i;
            break;
        }
    }

    if (tableStart === -1) return null;

    const result: Partial<AbilityTableData> = {};

    // Parse die nächsten 6 Zeilen (nach Header + Separator)
    for (let i = tableStart + 2; i < tableStart + 8 && i < lines.length; i++) {
        const line = lines[i];
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);

        if (cells.length >= 4) {
            const stat = cells[0].toLowerCase() as AbilityScoreKey;
            const score = cells[1];
            const mod = parseInt(cells[2].replace(/[+\-]/g, ''));
            const save = parseInt(cells[3].replace(/[+\-]/g, ''));

            if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(stat)) {
                result[stat] = { score, mod, save };
            }
        }
    }

    return result as AbilityTableData;
}

function determineSaveProficiencies(
    table: AbilityTableData,
    pb?: string
): { str?: boolean; dex?: boolean; con?: boolean; int?: boolean; wis?: boolean; cha?: boolean } {
    const proficiencies: Record<string, boolean> = {};
    const pbValue = pb ? parseInt(pb.replace(/[+\-]/g, '')) : 0;

    for (const [key, data] of Object.entries(table)) {
        // Wenn SAVE > MOD (um mehr als Rundungsfehler), dann Proficiency
        if (Math.abs(data.save) > Math.abs(data.mod) + 0.5) {
            proficiencies[key] = true;
        }
    }

    return proficiencies as any;
}

type SectionData = { category: string; content: string[] };

function extractSections(lines: string[]): SectionData[] {
    const sections: SectionData[] = [];
    let currentSection: SectionData | null = null;

    for (const line of lines) {
        const headerMatch = line.match(/^###\s+(.+)$/);
        if (headerMatch) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = {
                category: headerMatch[1].trim(),
                content: [],
            };
        } else if (currentSection && line) {
            currentSection.content.push(line);
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

function parseSections(sections: SectionData[], data: StatblockData): StatblockData['entries'] {
    const entries: NonNullable<StatblockData['entries']> = [];

    const categoryMap: Record<string, 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary'> = {
        'traits': 'trait',
        'actions': 'action',
        'bonus actions': 'bonus',
        'reactions': 'reaction',
        'legendary actions': 'legendary',
    };

    for (const section of sections) {
        const category = categoryMap[section.category.toLowerCase()];
        if (!category) continue;

        const parsedEntries = parseEntries(section.content, category, data);
        entries.push(...parsedEntries);
    }

    return entries.length > 0 ? entries : undefined;
}

function parseEntries(
    lines: string[],
    category: 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary',
    data: StatblockData
): NonNullable<StatblockData['entries']> {
    const entries: NonNullable<StatblockData['entries']> = [];
    let currentEntry: NonNullable<StatblockData['entries']>[0] | null = null;

    for (const line of lines) {
        // Entry beginnt mit ***Name.*** oder ***Name (Recharge X).*** oder ***Name (2/Day).***
        const entryMatch = line.match(/^\*\*\*(.+?)\.\*\*\*(.*)$/);
        if (entryMatch) {
            if (currentEntry) {
                entries.push(currentEntry);
            }

            const nameAndRecharge = entryMatch[1];
            const rest = entryMatch[2].trim();

            // Parse Recharge pattern: "(Recharge 5-6)" oder "(2/Day)"
            const rechargeMatch = nameAndRecharge.match(/^(.+?)\s*\((Recharge\s+\d+-?\d*|\d+\/Day)\)$/i);
            const name = rechargeMatch ? rechargeMatch[1].trim() : nameAndRecharge.trim();
            const recharge = rechargeMatch ? rechargeMatch[2] : undefined;

            currentEntry = {
                category,
                name,
                recharge,
                text: rest,
            };
        } else if (currentEntry && line) {
            // Fortsetzung des aktuellen Eintrags
            currentEntry.text = (currentEntry.text ? currentEntry.text + ' ' : '') + line;
        }
    }

    if (currentEntry) {
        entries.push(currentEntry);
    }

    // Parse Action-Details (to_hit, damage, saves, etc.)
    for (const entry of entries) {
        if (entry.text) {
            parseEntryDetails(entry, data);
        }
    }

    return entries;
}

function parseEntryDetails(entry: NonNullable<StatblockData['entries']>[0], data: StatblockData): void {
    if (!entry.text) return;

    const text = entry.text;

    // 1. Attack Roll: "*Melee Attack Roll:* +9, reach 15 ft."
    const attackMatch = text.match(/\*(Melee|Ranged)\s+Attack\s+Roll:\*\s*([+\-]\d+),\s*(?:reach|range)\s+([^.]+)/i);
    if (attackMatch) {
        entry.kind = `${attackMatch[1]} Attack Roll`;
        entry.to_hit = attackMatch[2];
        entry.range = attackMatch[3].trim();
    }

    // 2. Target: "one target", "all creatures in range", "each creature within 30 feet"
    const targetMatch = text.match(/\b(one\s+(?:target|creature)|all\s+creatures?|each\s+creature\s+(?:in|within)[^.]*)/i);
    if (targetMatch) {
        entry.target = targetMatch[1].trim();
    }

    // 3. Damage: "12 (2d6 + 5) Bludgeoning damage"
    const damageMatch = text.match(/(\d+)\s*\(([^)]+)\)\s+(\w+)\s+damage/i);
    if (damageMatch) {
        entry.damage = `${damageMatch[1]} (${damageMatch[2]}) ${damageMatch[3]}`;
    }

    // 4. Saving Throw: "*Intelligence Saving Throw*: DC 16"
    const saveMatch = text.match(/\*(\w+)\s+Saving\s+Throw\*:\s*DC\s+(\d+)/i);
    if (saveMatch) {
        entry.save_ability = saveMatch[1].substring(0, 3).toUpperCase();
        entry.save_dc = parseInt(saveMatch[2]);
    }

    // 5. Save Effect: "*Success:* Half damage" oder "*Failure:* ... damage"
    const successMatch = text.match(/\*Success:\*\s*([^.*]+)/i);
    if (successMatch) {
        entry.save_effect = successMatch[1].trim();
    }
}

function extractSpellcasting(entries: NonNullable<StatblockData['entries']>): SpellcastingData | undefined {
    // Suche nach "Spellcasting" Entry in Actions
    const spellcastingEntry = entries.find(e =>
        e.category === 'action' && e.name.toLowerCase().includes('spellcasting')
    );

    if (!spellcastingEntry || !spellcastingEntry.text) return undefined;

    const text = spellcastingEntry.text;
    const data: SpellcastingData = {
        title: spellcastingEntry.name,
        groups: [],
    };

    // Extract DC: "spell save DC 16"
    const dcMatch = text.match(/spell\s+save\s+DC\s+(\d+)/i);
    if (dcMatch) {
        data.saveDcOverride = parseInt(dcMatch[1]);
    }

    // Extract Ability: "using Wisdom as the spellcasting ability"
    const abilityMatch = text.match(/using\s+(\w+)\s+as\s+the\s+spellcasting\s+ability/i);
    if (abilityMatch) {
        const abilityName = abilityMatch[1].toLowerCase();
        const abilityMap: Record<string, AbilityScoreKey> = {
            'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
            'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha',
        };
        data.ability = abilityMap[abilityName];
    }

    // Parse spell groups aus bullet lists
    // Dieser Teil ist komplex - für erste Version speichern wir nur die summary
    data.summary = text;

    return data;
}
