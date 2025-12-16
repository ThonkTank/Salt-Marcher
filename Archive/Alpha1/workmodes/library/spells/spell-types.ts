// src/workmodes/library/entities/spells/types.ts
// Type definitions for spell data structures

/**
 * Comprehensive spell data structure for D&D 5e spells
 */
export type SpellData = {
    name: string;
    level?: number;
    school?: string;
    casting_time?: string;
    range?: string;
    components?: string[];
    materials?: string;
    duration?: string;
    concentration?: boolean;
    ritual?: boolean;
    classes?: string[];
    save_ability?: string;
    save_effect?: string;
    attack?: string;
    damage?: string;
    damage_type?: string;
    description?: string;
    higher_levels?: string;
};
