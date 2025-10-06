// src/apps/library/create/creature/components/spellcasting/spell-row.ts
// Spell-Row Komponente für einzelne Zauber

import type { SpellcastingSpell } from "../../../core/creature-files";
import { createSpellInput, type SpellInputHandle } from "./spell-input";

/**
 * Options for creating a spell row
 */
export interface SpellRowOptions {
  /** The spell data to display/edit */
  spell: SpellcastingSpell;
  /** Function that returns candidate spell names for autocomplete */
  getCandidates: () => readonly string[];
  /** Callback when spell data changes */
  onUpdate: () => void;
  /** Callback when spell should be removed */
  onRemove: () => void;
}

/**
 * Creates a spell row with name input, notes field, and remove button
 *
 * Layout: [Name Input (autocomplete)] [Notes Input] [× Remove]
 *
 * @param parent - Parent element to append the row to
 * @param options - Configuration options
 * @returns Handle for the spell name input (for refresh)
 *
 * @example
 * ```ts
 * const spell = { name: "Fireball", notes: "3d6 damage" };
 * const handle = createSpellRow(container, {
 *   spell,
 *   getCandidates: () => allSpells,
 *   onUpdate: () => console.log("Updated"),
 *   onRemove: () => console.log("Removed")
 * });
 * ```
 */
export function createSpellRow(
  parent: HTMLElement,
  options: SpellRowOptions
): SpellInputHandle {
  const { spell, getCandidates, onUpdate, onRemove } = options;

  const row = parent.createDiv({ cls: "sm-cc-spell-row" });

  // Name Cell with Autocomplete
  const nameCell = row.createDiv({ cls: "sm-cc-spell-row__name" });
  const spellHandle = createSpellInput(nameCell, {
    placeholder: "Zaubername",
    getCandidates,
    onChange: (value) => {
      spell.name = value;
      onUpdate();
    },
  });
  spellHandle.input.value = spell.name ?? "";

  // Notes Cell
  const notesCell = row.createDiv({ cls: "sm-cc-spell-row__notes" });
  const notesInput = notesCell.createEl("input", {
    cls: "sm-cc-input",
    attr: { type: "text", placeholder: "Notiz" },
  }) as HTMLInputElement;
  notesInput.value = spell.notes ?? "";
  notesInput.addEventListener("input", () => {
    const trimmed = notesInput.value.trim();
    spell.notes = trimmed || undefined;
    onUpdate();
  });

  // Remove Button
  const removeBtn = row.createEl("button", {
    text: "×",
    cls: "btn-compact",
    attr: { type: "button", "aria-label": "Zauber entfernen" },
  });
  removeBtn.onclick = onRemove;

  return spellHandle;
}

/**
 * Options for creating an add-spell row
 */
export interface AddSpellRowOptions {
  /** Function that returns candidate spell names for autocomplete */
  getCandidates: () => readonly string[];
  /** Callback when a new spell should be added */
  onAdd: (name: string, notes?: string) => void;
}

/**
 * Creates an "add spell" row with input fields and add button
 *
 * Features:
 * - Empty name input with autocomplete
 * - Optional notes input
 * - + button to add spell
 * - Enter key in name input triggers add
 * - Clears inputs after adding
 *
 * Layout: [Name Input] [Notes Input (optional)] [+ Add]
 *
 * @param parent - Parent element to append the row to
 * @param options - Configuration options
 * @returns Handle for the spell name input (for refresh)
 *
 * @example
 * ```ts
 * const handle = createAddSpellRow(container, {
 *   getCandidates: () => ["Fireball", "Magic Missile"],
 *   onAdd: (name, notes) => {
 *     spells.push({ name, notes });
 *     render();
 *   }
 * });
 * ```
 */
export function createAddSpellRow(
  parent: HTMLElement,
  options: AddSpellRowOptions
): SpellInputHandle {
  const { getCandidates, onAdd } = options;

  const row = parent.createDiv({ cls: "sm-cc-spell-row sm-cc-spell-row--add" });

  // Name Cell with Autocomplete
  const nameCell = row.createDiv({ cls: "sm-cc-spell-row__name" });
  const spellHandle = createSpellInput(nameCell, {
    placeholder: "Zauber hinzufügen…",
    getCandidates,
  });

  // Notes Cell
  const notesCell = row.createDiv({ cls: "sm-cc-spell-row__notes" });
  const notesInput = notesCell.createEl("input", {
    cls: "sm-cc-input",
    attr: { type: "text", placeholder: "Notiz (optional)" },
  }) as HTMLInputElement;

  // Add Button
  const addButton = row.createEl("button", {
    text: "+",
    cls: "btn-compact",
    attr: { type: "button", "aria-label": "Zauber hinzufügen" },
  });

  const addSpell = () => {
    const name = spellHandle.input.value.trim();
    if (!name) return;

    const notes = notesInput.value.trim() || undefined;
    onAdd(name, notes);

    // Clear inputs
    spellHandle.input.value = "";
    notesInput.value = "";
  };

  addButton.onclick = addSpell;
  spellHandle.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSpell();
    }
  });

  return spellHandle;
}
