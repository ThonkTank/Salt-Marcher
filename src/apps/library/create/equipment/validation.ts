// src/apps/library/create/equipment/validation.ts
import type { EquipmentData } from "../../core/equipment-files";

export function collectEquipmentValidationIssues(d: EquipmentData): string[] {
    const issues: string[] = [];

    // Basic validation
    if (!d.name || !d.name.trim()) {
        issues.push("Name is required");
    }

    if (!d.type) {
        issues.push("Equipment type is required");
    }

    // Type-specific validation
    if (d.type === "weapon") {
        if (d.weapon_category && !["Simple", "Martial"].includes(d.weapon_category)) {
            issues.push("Weapon category must be 'Simple' or 'Martial'");
        }
        if (d.weapon_type && !["Melee", "Ranged"].includes(d.weapon_type)) {
            issues.push("Weapon type must be 'Melee' or 'Ranged'");
        }
    }

    if (d.type === "armor") {
        if (d.armor_category && !["Light", "Medium", "Heavy", "Shield"].includes(d.armor_category)) {
            issues.push("Armor category must be 'Light', 'Medium', 'Heavy', or 'Shield'");
        }
    }

    if (d.type === "tool") {
        if (d.tool_category && !["Artisan", "Gaming", "Musical", "Other"].includes(d.tool_category)) {
            issues.push("Tool category must be 'Artisan', 'Gaming', 'Musical', or 'Other'");
        }
    }

    return issues;
}
