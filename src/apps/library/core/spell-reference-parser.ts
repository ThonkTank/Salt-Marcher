// src/apps/library/core/spell-reference-parser.ts
// Parst Reference Spell Markdown zu SpellData

import type { SpellData } from "./spell-files";

/**
 * Parst einen Reference Spell (reines Markdown ohne Frontmatter) zu SpellData.
 *
 * Reference Format:
 * - #### Name
 * - *Level X School (Class1, Class2)*
 * - **Casting Time:** ...
 * - **Range:** ...
 * - **Components:** V, S, M (materials)
 * - **Duration:** ...
 * - Description text
 * - **_Using a Higher-Level Spell Slot._** Higher level effects (optional)
 */
export function parseReferenceSpell(markdown: string): SpellData {
    const lines = markdown.split('\n').map(line => line.trim());

    const data: SpellData = { name: "" };

    // 1. Name aus H4 (#### Spell Name)
    data.name = extractH4(lines);

    // 2. Subtitle (Level, School, Classes)
    const subtitle = extractSubtitle(lines);
    if (subtitle) {
        const parsed = parseSubtitle(subtitle);
        data.level = parsed.level;
        data.school = parsed.school;
        data.classes = parsed.classes;
    }

    // 3. Stats aus **Label:** Format
    const stats = extractLabeledStats(lines);

    data.casting_time = stats.get("casting time");
    data.range = stats.get("range");
    data.duration = stats.get("duration");

    // Parse components
    const componentsText = stats.get("components");
    if (componentsText) {
        const parsed = parseComponents(componentsText);
        data.components = parsed.components;
        data.materials = parsed.materials;
    }

    // 4. Extract description and higher levels
    const { description, higherLevels } = extractDescription(lines);
    data.description = description;
    data.higher_levels = higherLevels;

    // 5. Parse special flags from duration
    if (data.duration) {
        if (data.duration.toLowerCase().includes('concentration')) {
            data.concentration = true;
        }
        if (data.duration.toLowerCase().includes('ritual')) {
            data.ritual = true;
        }
    }

    // 6. Parse special properties from casting time
    if (data.casting_time?.toLowerCase().includes('ritual')) {
        data.ritual = true;
    }

    // 7. Try to extract damage/save/attack info from description
    if (description) {
        const details = parseSpellDetails(description);
        if (details.save_ability) data.save_ability = details.save_ability;
        if (details.save_effect) data.save_effect = details.save_effect;
        if (details.attack) data.attack = details.attack;
        if (details.damage) data.damage = details.damage;
        if (details.damage_type) data.damage_type = details.damage_type;
    }

    return data;
}

function extractH4(lines: string[]): string {
    for (const line of lines) {
        const match = line.match(/^####\s+(.+)$/);
        if (match) {
            // Remove ** bold markers
            return match[1].trim().replace(/^\*\*(.+)\*\*$/, '$1');
        }
    }
    return "Unknown Spell";
}

function extractSubtitle(lines: string[]): string | null {
    for (const line of lines) {
        // Match: *Level 2 Evocation (Wizard)* or *Evocation Cantrip (Sorcerer, Wizard)*
        const match = line.match(/^\*(.+)\*$/);
        if (match) return match[1].trim();
    }
    return null;
}

function parseSubtitle(subtitle: string): {
    level?: number;
    school?: string;
    classes?: string[];
} {
    const result: { level?: number; school?: string; classes?: string[] } = {};

    // Extract classes from parentheses
    const classMatch = subtitle.match(/\(([^)]+)\)$/);
    if (classMatch) {
        result.classes = classMatch[1].split(',').map(c => c.trim());
    }

    // Remove classes part for parsing level and school
    const withoutClasses = subtitle.replace(/\s*\([^)]+\)$/, '').trim();

    // Check for Cantrip
    if (withoutClasses.toLowerCase().includes('cantrip')) {
        result.level = 0;
        // Extract school: "Evocation Cantrip" -> "Evocation"
        const schoolMatch = withoutClasses.match(/^(\w+)\s+Cantrip/i);
        if (schoolMatch) {
            result.school = schoolMatch[1];
        }
    } else {
        // Parse "Level X School": "Level 2 Evocation"
        const levelMatch = withoutClasses.match(/Level\s+(\d+)\s+(\w+)/i);
        if (levelMatch) {
            result.level = parseInt(levelMatch[1]);
            result.school = levelMatch[2];
        }
    }

    return result;
}

function extractLabeledStats(lines: string[]): Map<string, string> {
    const stats = new Map<string, string>();

    for (const line of lines) {
        // Match "**Label:** Value"
        const match = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
        if (match) {
            const label = match[1].toLowerCase().trim();
            const value = match[2].trim();
            stats.set(label, value);
        }
    }

    return stats;
}

function parseComponents(text: string): {
    components?: string[];
    materials?: string;
} {
    const result: { components?: string[]; materials?: string } = {};

    // Extract components: "V, S, M (materials)" -> ["V", "S", "M"]
    const components: string[] = [];

    if (text.includes('V')) components.push('V');
    if (text.includes('S')) components.push('S');
    if (text.includes('M')) components.push('M');

    if (components.length > 0) {
        result.components = components;
    }

    // Extract materials from parentheses
    const materialMatch = text.match(/M\s*\(([^)]+)\)/);
    if (materialMatch) {
        result.materials = materialMatch[1].trim();
    }

    return result;
}

function extractDescription(lines: string[]): {
    description?: string;
    higherLevels?: string;
} {
    let descriptionLines: string[] = [];
    let higherLevelLines: string[] = [];
    let inHigherLevels = false;

    let startCapturing = false;

    for (const line of lines) {
        // Skip until we've passed the stat lines
        if (line.startsWith('**Duration:')) {
            startCapturing = true;
            continue;
        }

        if (!startCapturing) continue;

        // Check for higher levels section
        if (line.match(/\*\*_Using a Higher-Level Spell Slot\._\*\*/i) ||
            line.match(/\*\*_Cantrip Upgrade\._\*\*/i)) {
            inHigherLevels = true;
            continue;
        }

        // Skip empty lines at the start
        if (!inHigherLevels && descriptionLines.length === 0 && !line) continue;
        if (inHigherLevels && higherLevelLines.length === 0 && !line) continue;

        // Skip markdown headers (section boundaries)
        if (line.startsWith('####') || line.startsWith('###') || line.startsWith('##')) {
            break;
        }

        if (inHigherLevels) {
            if (line) higherLevelLines.push(line);
        } else {
            if (line) descriptionLines.push(line);
        }
    }

    const description = descriptionLines.join('\n\n').trim();
    const higherLevels = higherLevelLines.join('\n\n').trim();

    return {
        description: description || undefined,
        higher_levels: higherLevels || undefined,
    };
}

function parseSpellDetails(description: string): {
    save_ability?: string;
    save_effect?: string;
    attack?: string;
    damage?: string;
    damage_type?: string;
} {
    const result: {
        save_ability?: string;
        save_effect?: string;
        attack?: string;
        damage?: string;
        damage_type?: string;
    } = {};

    // Saving throw: "Dexterity saving throw" or "Constitution saving throw"
    const saveMatch = description.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
    if (saveMatch) {
        result.save_ability = saveMatch[1].substring(0, 3).toUpperCase();
    }

    // Save effect: "half as much damage on a successful one" or typical patterns
    if (description.toLowerCase().includes('half') && description.toLowerCase().includes('damage')) {
        result.save_effect = "Half damage on success";
    } else if (description.toLowerCase().includes('no effect on a successful save')) {
        result.save_effect = "No effect on success";
    }

    // Attack: "ranged spell attack" or "melee spell attack"
    const attackMatch = description.match(/\b(ranged|melee)\s+spell\s+attack/i);
    if (attackMatch) {
        result.attack = `${attackMatch[1]} spell attack`;
    }

    // Damage: "8d6 Fire damage" or "1d10 Fire damage"
    const damageMatch = description.match(/(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s+(\w+)\s+damage/i);
    if (damageMatch) {
        result.damage = damageMatch[1];
        result.damage_type = damageMatch[2];
    }

    return result;
}
