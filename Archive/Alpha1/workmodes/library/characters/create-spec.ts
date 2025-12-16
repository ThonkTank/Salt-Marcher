/**
 * Character Create Specification
 *
 * Declarative field definitions that auto-generate UI, storage, and validation
 * for the Character entity type.
 */

import type { CreateSpec } from "../library-types";
import type { Character } from "./character-types";

/**
 * Character entity create specification
 *
 * Follows CreateSpec pattern used by creatures, spells, items, etc.
 * Fields automatically generate form UI in Library workmode.
 */
export const characterCreateSpec: CreateSpec<Character> = {
    fields: [
        {
            id: "name",
            type: "text",
            label: "Name",
            required: true,
            placeholder: "Enter character name",
        },
        {
            id: "level",
            type: "number",
            label: "Level",
            required: true,
            min: 1,
            max: 20,
            default: 1,
        },
        {
            id: "characterClass",
            type: "text",
            label: "Class",
            required: true,
            placeholder: "e.g., Fighter, Wizard, Rogue",
        },
        {
            id: "maxHp",
            type: "number",
            label: "Max HP",
            required: true,
            min: 1,
            placeholder: "Maximum hit points",
        },
        {
            id: "ac",
            type: "number",
            label: "Armor Class",
            required: true,
            min: 1,
            max: 30,
            placeholder: "AC value",
        },
        {
            id: "notes",
            type: "textarea",
            label: "Notes",
            placeholder: "Optional character notes or description",
        },
    ],
    storage: {
        path: "Characters",
        extension: "md",
        bodyTemplate: (character: Character) => {
            // Simple markdown body with character information
            const parts: string[] = [];

            parts.push(`# ${character.name}`);
            parts.push("");
            parts.push(`**Class:** ${character.characterClass} (Level ${character.level})`);
            parts.push(`**HP:** ${character.maxHp}`);
            parts.push(`**AC:** ${character.ac}`);
            parts.push("");

            if (character.notes) {
                parts.push("## Notes");
                parts.push("");
                parts.push(character.notes);
                parts.push("");
            }

            return parts.join("\n");
        },
    },
};
