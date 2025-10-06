// src/apps/library/create/item/validation.ts
// Validates item data for consistency and completeness
import type { ItemData } from "../../core/item-files";

export const NAME_REQUIRED_MESSAGE = "Item name is required.";
export const CHARGES_INVALID_MESSAGE = "Max charges must be a positive number.";
export const SPELLS_REQUIRE_NAMES_MESSAGE = "All spells must have a name.";
export const BONUSES_REQUIRE_TYPE_MESSAGE = "All bonuses must have a type.";
export const ABILITY_CHANGES_INVALID_MESSAGE = "Ability changes must have a valid ability and value.";

/**
 * Collects validation issues for item data
 */
export function collectItemValidationIssues(data: ItemData): string[] {
    const issues: string[] = [];

    // Name is required
    if (!data.name || !data.name.trim()) {
        issues.push(NAME_REQUIRED_MESSAGE);
    }

    // Charges validation
    if (data.max_charges != null) {
        if (data.max_charges <= 0) {
            issues.push(CHARGES_INVALID_MESSAGE);
        }
    }

    // Spells validation
    if (data.spells && data.spells.length > 0) {
        for (const spell of data.spells) {
            if (!spell.name || !spell.name.trim()) {
                issues.push(SPELLS_REQUIRE_NAMES_MESSAGE);
                break;
            }
        }
    }

    // Bonuses validation
    if (data.bonuses && data.bonuses.length > 0) {
        for (const bonus of data.bonuses) {
            if (!bonus.type || !bonus.type.trim()) {
                issues.push(BONUSES_REQUIRE_TYPE_MESSAGE);
                break;
            }
        }
    }

    // Ability changes validation
    if (data.ability_changes && data.ability_changes.length > 0) {
        const validAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        for (const change of data.ability_changes) {
            if (!change.ability || !validAbilities.includes(change.ability.toLowerCase())) {
                issues.push(ABILITY_CHANGES_INVALID_MESSAGE);
                break;
            }
            if (!change.value || change.value < 1 || change.value > 30) {
                issues.push(ABILITY_CHANGES_INVALID_MESSAGE);
                break;
            }
        }
    }

    return issues;
}
