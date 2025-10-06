// src/apps/library/create/creature/components/spellcasting/spell-group.ts
// Spell-Group Komponente für Zauber-Gruppen (At Will, X/Day, Level, Custom)

import type { SpellcastingGroup } from "../../../core/creature-files";
import { createSpellRow, createAddSpellRow, type SpellInputHandle } from "./spell-row";

/**
 * Options for creating a spell group
 */
export interface SpellGroupOptions {
  /** The spell group data to display/edit */
  group: SpellcastingGroup;
  /** Current index of this group (for move buttons) */
  groupIndex: number;
  /** Total number of groups (for move buttons) */
  totalGroups: number;
  /** Function that returns candidate spell names for autocomplete */
  getCandidates: () => readonly string[];
  /** Callback when group data changes */
  onUpdate: () => void;
  /** Callback when group should be moved up or down */
  onMove: (direction: "up" | "down") => void;
  /** Callback when group should be removed */
  onRemove: () => void;
}

/**
 * Get the heading for a spell group based on its type
 *
 * - "at-will": Shows title or "At Will"
 * - "per-day": Shows title or uses or "X/Day"
 * - "level": Shows title or "{level}th Level" with optional "(N slots)"
 * - "custom": Shows title or "Custom"
 */
function getGroupHeading(group: SpellcastingGroup): string {
  switch (group.type) {
    case "at-will":
      return group.title?.trim() || "At Will";
    case "per-day":
      return group.title?.trim() || group.uses?.trim() || "X/Day";
    case "level": {
      const levelLabel = group.title?.trim() || `${group.level}th Level`;
      const slots = group.slots;
      const slotsLabel = slots != null ? String(slots).trim() : undefined;
      return slotsLabel ? `${levelLabel} (${slotsLabel} slots)` : levelLabel;
    }
    case "custom":
      return group.title?.trim() || "Custom";
    default:
      return "Spell Group";
  }
}

/**
 * Ensure group has spells array (creates empty array if missing)
 */
function ensureGroupSpells(group: SpellcastingGroup) {
  if (!Array.isArray(group.spells)) {
    group.spells = [];
  }
  return group.spells;
}

/**
 * Creates a spell group component with full UI
 *
 * Structure:
 * - Header with title input and move/remove buttons
 * - Meta fields (type-specific: uses, level, slots, description)
 * - List of spell rows
 * - Add spell row
 *
 * Supports 4 group types:
 * - "at-will": No meta fields
 * - "per-day": Uses (e.g., "3/day each") and optional note
 * - "level": Level (0-9), optional slots, optional note
 * - "custom": Description text area
 *
 * @param parent - Parent element to append the group to
 * @param options - Configuration options
 * @returns Array of spell input handles for refreshing autocomplete
 *
 * @example
 * ```ts
 * const group = {
 *   type: "per-day",
 *   uses: "3/day each",
 *   spells: [{ name: "Fireball", notes: "" }]
 * };
 * const handles = createSpellGroup(container, {
 *   group, groupIndex: 0, totalGroups: 3,
 *   getCandidates: () => allSpells,
 *   onUpdate: () => console.log("Updated"),
 *   onMove: (dir) => console.log("Move", dir),
 *   onRemove: () => console.log("Remove")
 * });
 * ```
 */
export function createSpellGroup(
  parent: HTMLElement,
  options: SpellGroupOptions
): SpellInputHandle[] {
  const { group, groupIndex, totalGroups, getCandidates, onUpdate, onMove, onRemove } = options;
  const handles: SpellInputHandle[] = [];

  const groupBox = parent.createDiv({ cls: "sm-cc-spell-group" });

  // Header
  const head = groupBox.createDiv({ cls: "sm-cc-spell-group__head" });
  const titleInput = head.createEl("input", {
    cls: "sm-cc-input sm-cc-spell-group__title",
    attr: { type: "text", placeholder: getGroupHeading(group) },
  }) as HTMLInputElement;
  titleInput.value = group.title ?? "";
  titleInput.addEventListener("input", () => {
    const value = titleInput.value.trim();
    if (group.type === "custom") {
      group.title = value || "";
    } else {
      group.title = value || undefined;
    }
    onUpdate();
  });

  // Controls
  const controls = head.createDiv({ cls: "sm-cc-spell-group__controls" });
  const moveUp = controls.createEl("button", {
    text: "↑",
    cls: "btn-compact",
    attr: { type: "button", "aria-label": "Nach oben" },
  });
  const moveDown = controls.createEl("button", {
    text: "↓",
    cls: "btn-compact",
    attr: { type: "button", "aria-label": "Nach unten" },
  });
  const remove = controls.createEl("button", {
    text: "×",
    cls: "btn-compact",
    attr: { type: "button", "aria-label": "Gruppe entfernen" },
  });

  moveUp.disabled = groupIndex === 0;
  moveDown.disabled = groupIndex === totalGroups - 1;
  moveUp.onclick = () => onMove("up");
  moveDown.onclick = () => onMove("down");
  remove.onclick = onRemove;

  // Meta fields (type-specific)
  const meta = groupBox.createDiv({ cls: "sm-cc-spell-group__meta" });
  createGroupMetaFields(meta, group, onUpdate);

  // Spells list
  const spellsList = groupBox.createDiv({ cls: "sm-cc-spell-group__spells" });
  const spells = ensureGroupSpells(group);

  spells.forEach((spell, spellIndex) => {
    const handle = createSpellRow(spellsList, {
      spell,
      getCandidates,
      onUpdate,
      onRemove: () => {
        spells.splice(spellIndex, 1);
        onUpdate();
      },
    });
    handles.push(handle);
  });

  // Add spell row
  const addHandle = createAddSpellRow(spellsList, {
    getCandidates,
    onAdd: (name, notes) => {
      spells.push({ name, notes });
      onUpdate();
    },
  });
  handles.push(addHandle);

  return handles;
}

/**
 * Creates meta fields for a spell group based on its type
 *
 * - "per-day": Uses input (e.g., "3/day") and optional note
 * - "level": Level input (0-9), slots input (number or string), optional note
 * - "custom": Description textarea
 * - "at-will": No meta fields
 */
function createGroupMetaFields(
  parent: HTMLElement,
  group: SpellcastingGroup,
  onUpdate: () => void
): void {
  switch (group.type) {
    case "per-day": {
      const usesInput = parent.createEl("input", {
        cls: "sm-cc-input sm-cc-input--small",
        attr: { type: "text", placeholder: "3/day", "aria-label": "Nutzungen" },
      }) as HTMLInputElement;
      usesInput.value = group.uses ?? "";
      usesInput.addEventListener("input", () => {
        group.uses = usesInput.value.trim();
        onUpdate();
      });

      const noteInput = parent.createEl("input", {
        cls: "sm-cc-input",
        attr: { type: "text", placeholder: "Notiz", "aria-label": "Notiz" },
      }) as HTMLInputElement;
      noteInput.value = group.note ?? "";
      noteInput.addEventListener("input", () => {
        group.note = noteInput.value.trim() || undefined;
        onUpdate();
      });
      break;
    }

    case "level": {
      const levelInput = parent.createEl("input", {
        cls: "sm-cc-input sm-cc-input--small",
        attr: { type: "number", min: "0", max: "9", "aria-label": "Zaubergrad" },
      }) as HTMLInputElement;
      levelInput.value = group.level != null ? String(group.level) : "";
      levelInput.addEventListener("input", () => {
        const parsed = Number(levelInput.value);
        group.level = Number.isFinite(parsed) ? parsed : (group.level ?? 0);
        onUpdate();
      });

      const slotsInput = parent.createEl("input", {
        cls: "sm-cc-input sm-cc-input--small",
        attr: { type: "text", placeholder: "Slots", "aria-label": "Slots" },
      }) as HTMLInputElement;
      if (group.slots != null) slotsInput.value = String(group.slots);
      slotsInput.addEventListener("input", () => {
        const value = slotsInput.value.trim();
        if (!value) {
          group.slots = undefined;
        } else {
          const parsed = Number(value);
          group.slots = Number.isFinite(parsed) ? parsed : value;
        }
        onUpdate();
      });

      const noteInput = parent.createEl("input", {
        cls: "sm-cc-input",
        attr: { type: "text", placeholder: "Notiz", "aria-label": "Notiz" },
      }) as HTMLInputElement;
      noteInput.value = group.note ?? "";
      noteInput.addEventListener("input", () => {
        group.note = noteInput.value.trim() || undefined;
        onUpdate();
      });
      break;
    }

    case "custom": {
      const descArea = parent.createEl("textarea", {
        cls: "sm-cc-textarea",
        attr: { placeholder: "Beschreibung" },
      });
      descArea.value = group.description ?? "";
      descArea.addEventListener("input", () => {
        group.description = descArea.value.trim() || undefined;
        onUpdate();
      });
      break;
    }

    case "at-will":
      // At-will groups have no meta fields
      break;
  }
}
