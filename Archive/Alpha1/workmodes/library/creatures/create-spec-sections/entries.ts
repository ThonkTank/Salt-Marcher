// src/workmodes/library/creatures/create-spec-sections/entries.ts
// Entries fields for creature traits, actions, reactions, and legendary actions

import { setIcon } from "obsidian";
import { CREATURE_DAMAGE_PRESETS, CREATURE_ENTRY_CATEGORIES } from "../constants";
import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

// ============================================================================
// COMPACT ENTRY RENDERERS
// ============================================================================

/**
 * Render attack entry in compact 2-line format
 */
function renderAttackEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Line 1: Attack type, bonus, reach/range
  const attackRow = container.createDiv({ cls: "sm-cc-entry-row" });

  // Attack type selector
  const typeSelect = attackRow.createEl("select", {
    cls: "sm-cc-compact-select",
    value: (entry['attack.type'] as string) || 'melee'
  });
  ['melee', 'ranged'].forEach(type => {
    const opt = typeSelect.createEl("option", { value: type, text: type });
    if (type === entry['attack.type']) opt.selected = true;
  });
  typeSelect.addEventListener("change", () => {
    entry['attack.type'] = typeSelect.value;
    ctx.requestRender();
  });

  // Attack bonus
  attackRow.createEl("span", { text: "+" });
  const bonusInput = attackRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['attack.bonus'] || 0),
    placeholder: "bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['attack.bonus'] = parseInt(bonusInput.value) || 0;
  });
  attackRow.createEl("span", { text: "hit," });

  // Reach or Range (conditional)
  if (entry['attack.type'] === 'melee') {
    const reachInput = attackRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.reach'] as string) || '',
      placeholder: "reach"
    });
    reachInput.addEventListener("input", () => {
      entry['attack.reach'] = reachInput.value;
    });
  } else {
    const rangeInput = attackRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.range'] as string) || '',
      placeholder: "range"
    });
    rangeInput.addEventListener("input", () => {
      entry['attack.range'] = rangeInput.value;
    });
  }

  attackRow.createEl("span", { cls: "sm-cc-separator", text: "|" });

  // Line 2: Damage (simplified)
  const damageList = (entry['attack.damage'] as any[]) || [];
  if (damageList.length > 0) {
    const firstDamage = damageList[0];
    const damageText = `${firstDamage.dice || ''}${firstDamage.bonus ? '+' + firstDamage.bonus : ''} ${firstDamage.type || ''}`;
    attackRow.createEl("span", { text: damageText, cls: "sm-cc-damage-text" });
  }

  // Add damage button
  const addDamageBtn = attackRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Damage"
  });
  addDamageBtn.addEventListener("click", () => {
    // TODO: Open modal to add damage entry
  });
}

/**
 * Render save entry in compact 2-line format
 */
function renderSaveEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const saveRow = container.createDiv({ cls: "sm-cc-entry-row" });

  // Save ability
  const abilitySelect = saveRow.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' },
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === entry['save.ability']) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['save.ability'] = abilitySelect.value;
  });

  // Save DC
  saveRow.createEl("span", { text: "DC" });
  const dcInput = saveRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['save.dc'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['save.dc'] = parseInt(dcInput.value) || 10;
  });

  // Area/targets (optional)
  if (entry['save.area']) {
    const areaInput = saveRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: entry['save.area'] as string,
      placeholder: "area"
    });
    areaInput.addEventListener("input", () => {
      entry['save.area'] = areaInput.value;
    });
  }

  saveRow.createEl("span", { cls: "sm-cc-separator", text: "|" });

  // Effects summary
  const failDamage = entry['save.onFail.damage'] as any[];
  if (failDamage && failDamage[0]) {
    saveRow.createEl("span", { text: `Fail: ${failDamage[0].dice} ${failDamage[0].type}` });
  }

  const successEffect = entry['save.onSuccess.damage'] || entry['save.onSuccess.legacyText'];
  if (successEffect) {
    saveRow.createEl("span", { text: `Success: ${successEffect}` });
  }
}

/**
 * Render multiattack entry in compact format
 */
function renderMultiattackEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const multiRow = container.createDiv({ cls: "sm-cc-entry-row" });

  const attacks = (entry['multiattack.attacks'] as any[]) || [];
  const attackText = attacks.map(a => `${a.count}x ${a.name}`).join(", ");

  if (attackText) {
    multiRow.createEl("span", { text: attackText });
  } else {
    multiRow.createEl("span", { text: "No attacks defined", cls: "sm-cc-muted" });
  }

  // Edit button for complex multiattack
  const editBtn = multiRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "Edit"
  });
  editBtn.addEventListener("click", () => {
    // TODO: Open modal to edit multiattack entry
  });
}

/**
 * Render special/trait entry - just description
 */
function renderSpecialEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Just show a text area for description
  const descRow = container.createDiv({ cls: "sm-cc-entry-row" });

  const textarea = descRow.createEl("textarea", {
    cls: "sm-cc-compact-textarea",
    placeholder: "Description...",
    value: (entry.text as string) || ''
  });
  textarea.addEventListener("input", () => {
    entry.text = textarea.value;
  });
}

// ============================================================================
// EFFECT RENDERERS FOR MODULAR SYSTEM
// ============================================================================

/**
 * Render attack effect component
 */
function renderAttackEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Angriff", cls: "sm-cc-effect-title" });

  const attackContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Attack configuration row
  const configRow = attackContent.createDiv({ cls: "sm-cc-field-row" });

  // Attack type
  const typeSelect = configRow.createEl("select", {
    cls: "sm-cc-compact-select",
    value: (entry['attack.type'] as string) || 'melee'
  });
  ['melee', 'ranged'].forEach(type => {
    const opt = typeSelect.createEl("option", { value: type, text: type });
    if (type === entry['attack.type']) opt.selected = true;
  });
  typeSelect.addEventListener("change", () => {
    entry['attack.type'] = typeSelect.value;
    ctx.requestRender();
  });

  // Attack bonus
  configRow.createEl("span", { text: "+" });
  const bonusInput = configRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['attack.bonus'] || 0),
    placeholder: "bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['attack.bonus'] = parseInt(bonusInput.value) || 0;
  });

  // Reach/Range
  if (entry['attack.type'] === 'melee') {
    configRow.createEl("span", { text: "Reichweite:" });
    const reachInput = configRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.reach'] as string) || '',
      placeholder: "5 ft."
    });
    reachInput.addEventListener("input", () => {
      entry['attack.reach'] = reachInput.value;
    });
  } else {
    configRow.createEl("span", { text: "Distanz:" });
    const rangeInput = configRow.createEl("input", {
      cls: "sm-cc-compact-text",
      value: (entry['attack.range'] as string) || '',
      placeholder: "30/120 ft."
    });
    rangeInput.addEventListener("input", () => {
      entry['attack.range'] = rangeInput.value;
    });
  }

  // Damage section
  const damageRow = attackContent.createDiv({ cls: "sm-cc-field-row" });
  damageRow.createEl("span", { text: "Schaden:", cls: "sm-cc-field-label" });
  const damageList = (entry['attack.damage'] as any[]) || [];
  if (damageList.length > 0) {
    const firstDamage = damageList[0];
    const damageText = `${firstDamage.dice || ''}${firstDamage.bonus ? '+' + firstDamage.bonus : ''} ${firstDamage.type || ''}`;
    damageRow.createEl("span", { text: damageText, cls: "sm-cc-damage-text" });
  }
  const addDamageBtn = damageRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Schaden"
  });
}

/**
 * Render save effect component
 */
function renderSaveEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Rettungswurf", cls: "sm-cc-effect-title" });

  const saveContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Save configuration
  const configRow = saveContent.createDiv({ cls: "sm-cc-field-row" });

  // Ability
  const abilitySelect = configRow.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' },
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === entry['save.ability']) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['save.ability'] = abilitySelect.value;
  });

  // DC
  configRow.createEl("span", { text: "DC" });
  const dcInput = configRow.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['save.dc'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['save.dc'] = parseInt(dcInput.value) || 10;
  });

  // Targeting
  const targetRow = saveContent.createDiv({ cls: "sm-cc-field-row" });
  targetRow.createEl("span", { text: "Ziele:", cls: "sm-cc-field-label" });
  const targetInput = targetRow.createEl("input", {
    cls: "sm-cc-compact-text",
    value: (entry['save.area'] as string) || '',
    placeholder: "z.B. 30 ft. cone"
  });
  targetInput.addEventListener("input", () => {
    entry['save.area'] = targetInput.value;
  });

  // Effects
  const effectsRow = saveContent.createDiv({ cls: "sm-cc-field-row" });
  effectsRow.createEl("span", { text: "Fehlschlag:", cls: "sm-cc-field-label" });
  const failDamage = entry['save.onFail.damage'] as any[];
  if (failDamage && failDamage.length > 0) {
    const damage = failDamage[0];
    effectsRow.createEl("span", {
      text: `${damage.dice} ${damage.type}`,
      cls: "sm-cc-damage-text"
    });
  }
}

/**
 * Render multiattack effect component
 */
function renderMultiattackEffect(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  const effectCard = container.createDiv({ cls: "sm-cc-effect-card" });
  effectCard.createEl("h5", { text: "Mehrfachangriff", cls: "sm-cc-effect-title" });

  const multiContent = effectCard.createDiv({ cls: "sm-cc-effect-content" });

  // Attacks configuration
  const attacksRow = multiContent.createDiv({ cls: "sm-cc-field-row" });
  attacksRow.createEl("span", { text: "Angriffe:", cls: "sm-cc-field-label" });

  const attacks = (entry['multiattack.attacks'] as any[]) || [];
  attacks.forEach(attack => {
    const chip = attacksRow.createEl("span", {
      text: `${attack.count}x ${attack.name}`,
      cls: "sm-cc-attack-chip"
    });
  });

  const addAttackBtn = attacksRow.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Angriff"
  });
}

// Helper function to get fields for each entry type
function getFieldsForEntryType(entryType: string, entry: Record<string, unknown>): AnyFieldSpec[] {
  // Base fields available for all types (but conditionally visible)
  const baseFields: AnyFieldSpec[] = [
    {
      id: "text",
      label: "Beschreibung",
      type: "textarea" as const,
      placeholder: "Entry description (Markdown)...",
    },
    {
      id: "recharge",
      label: "Aufladung",
      type: "text" as const,
      placeholder: "z.B. 5-6, 4-6",
      help: "Wird im Namen angezeigt (Recharge 5-6)",
      // Only show if has value or user explicitly added it
      visibleIf: (values) => Boolean(values['recharge']) || entry.showRecharge,
    },
    {
      id: "limitedUse.count",
      label: "Begrenzte Nutzung (Anzahl)",
      type: "number-stepper" as const,
      min: 1,
      max: 10,
      placeholder: "3",
      // Only show if has value
      visibleIf: (values) => Boolean(values['limitedUse.count']) || Boolean(values['limitedUse.reset']),
    },
    {
      id: "limitedUse.reset",
      label: "Zurücksetzen",
      type: "select" as const,
      options: [
        { value: "short-rest", label: "Kurze Rast" },
        { value: "long-rest", label: "Lange Rast" },
        { value: "day", label: "Tag" },
        { value: "dawn", label: "Morgendämmerung" },
        { value: "dusk", label: "Abenddämmerung" },
      ],
      visibleIf: (values) => Boolean(values['limitedUse.count']),
    },
  ];

  // Type-specific fields
  const typeFields: Record<string, AnyFieldSpec[]> = {
    attack: [
      {
        id: "attack.type",
        label: "Angriffsart",
        type: "select" as const,
        section: "Angriff",
        options: [
          { value: "melee", label: "Nahkampf" },
          { value: "ranged", label: "Fernkampf" },
        ],
      },
      {
        id: "attack.bonus",
        label: "Angriffsbonus",
        type: "number-stepper" as const,
        section: "Angriff",
        min: -10,
        max: 30,
        placeholder: "+12",
      },
      {
        id: "attack.reach",
        label: "Reichweite",
        type: "text" as const,
        section: "Angriff",
        placeholder: "10 ft.",
        // Only visible for melee attacks
        visibleIf: (values) => values['attack.type'] === "melee",
      },
      {
        id: "attack.range",
        label: "Distanz",
        type: "text" as const,
        section: "Angriff",
        placeholder: "120 ft. oder 30/120 ft.",
        // Only visible for ranged attacks
        visibleIf: (values) => values['attack.type'] === "ranged",
      },
      {
        id: "attack.damage",
        label: "Schaden",
        type: "tokens" as const,
        section: "Schaden",
        config: {
          fields: [
            {
              id: "dice",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "2d8",
            },
            {
              id: "bonus",
              type: "number-stepper",
              label: " +",
              displayInChip: true,
              editable: true,
              min: 0,
              max: 50,
              default: 0,
            },
            {
              id: "type",
              type: "select",
              label: " ",
              displayInChip: true,
              editable: true,
              suggestions: CREATURE_DAMAGE_PRESETS,
              placeholder: "Schadensart",
            },
          ],
          primaryField: "dice",
        },
        default: [],
      },
      {
        id: "attack.additionalEffects",
        label: "Zusätzliche Effekte",
        type: "textarea" as const,
        placeholder: "z.B. Ziel ist festgehalten...",
        section: "Effekte",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['attack.additionalEffects']),
      },
    ],

    save: [
      {
        id: "save.ability",
        label: "Attribut",
        type: "select" as const,
        section: "Rettungswurf",
        options: [
          { value: "str", label: "Stärke" },
          { value: "dex", label: "Geschick" },
          { value: "con", label: "Konstitution" },
          { value: "int", label: "Intelligenz" },
          { value: "wis", label: "Weisheit" },
          { value: "cha", label: "Charisma" },
        ],
      },
      {
        id: "save.dc",
        label: "SG",
        type: "number-stepper" as const,
        section: "Rettungswurf",
        min: 1,
        max: 30,
        placeholder: "19",
      },
      {
        id: "save.area",
        label: "Bereich/Ziele",
        type: "text" as const,
        section: "Zielerfassung",
        placeholder: "z.B. 90-foot-long, 5-foot-wide Line",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['save.area']),
      },
      {
        id: "save.onFail.damage",
        label: "Schaden bei Misserfolg",
        type: "tokens" as const,
        section: "Effekte",
        config: {
          fields: [
            {
              id: "dice",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "11d10",
            },
            {
              id: "bonus",
              type: "number-stepper",
              label: " +",
              displayInChip: true,
              editable: true,
              min: 0,
              max: 50,
              default: 0,
            },
            {
              id: "type",
              type: "select",
              label: " ",
              displayInChip: true,
              editable: true,
              suggestions: CREATURE_DAMAGE_PRESETS,
              placeholder: "Schadensart",
            },
          ],
          primaryField: "dice",
        },
        default: [],
      },
      {
        id: "save.onFail.legacyEffects",
        label: "Weitere Effekte bei Misserfolg",
        type: "textarea" as const,
        section: "Effekte",
        placeholder: "z.B. Ziel ist festgehalten...",
        // Only show if data exists
        visibleIf: (values) => Boolean(values['save.onFail.legacyEffects']),
      },
      {
        id: "save.onSuccess.damage",
        label: "Schaden bei Erfolg",
        type: "select" as const,
        section: "Effekte",
        options: [
          { value: "half", label: "Halber Schaden" },
          { value: "none", label: "Kein Schaden" },
        ],
      },
      {
        id: "save.onSuccess.legacyText",
        label: "Bei Erfolg (Text)",
        type: "text" as const,
        placeholder: "z.B. Halber Schaden oder andere Effekte",
        help: "Für komplexe Erfolgs-Effekte",
      },
    ],

    multiattack: [
      {
        id: "multiattack.attacks",
        label: "Angriffe",
        type: "tokens" as const,
        section: "Angriffe",
        config: {
          fields: [
            {
              id: "count",
              type: "number-stepper",
              displayInChip: true,
              editable: true,
              min: 1,
              max: 10,
              default: 1,
            },
            {
              id: "name",
              type: "text",
              label: "x ",
              displayInChip: true,
              editable: true,
              placeholder: "Angriffsname",
            },
          ],
          primaryField: "name",
        },
        default: [],
      },
      {
        id: "multiattack.substitutions",
        label: "Ersetzungen",
        type: "tokens" as const,
        section: "Ersetzungen",
        help: "Optional: Angriffe durch andere Aktionen ersetzen",
        config: {
          fields: [
            {
              id: "replace",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "Angriffsname",
              label: "Ersetze ",
            },
            {
              id: "with.type",
              type: "select",
              displayInChip: true,
              editable: true,
              label: " durch ",
              options: [
                { value: "attack", label: "Angriff" },
                { value: "spellcasting", label: "Zauber" },
                { value: "other", label: "Anderes" },
              ],
              default: "attack",
            },
            {
              id: "with.name",
              type: "text",
              displayInChip: true,
              editable: true,
              placeholder: "Name",
              label: ": ",
            },
          ],
          primaryField: "replace",
        },
        default: [],
      },
    ],

    spellcasting: [
      {
        id: "spellcasting.ability",
        label: "Zauberattribut",
        type: "select" as const,
        options: [
          { value: "int", label: "Intelligenz" },
          { value: "wis", label: "Weisheit" },
          { value: "cha", label: "Charisma" },
        ],
      },
      {
        id: "spellcasting.saveDC",
        label: "Zauber-SG",
        type: "number-stepper" as const,
        min: 1,
        max: 30,
        placeholder: "18",
      },
      {
        id: "spellcasting.attackBonus",
        label: "Zauberangriffsbonus",
        type: "number-stepper" as const,
        min: -10,
        max: 30,
        placeholder: "+10",
      },
    ],
  };

  // Return ONLY fields relevant for this specific type
  switch(entryType) {
    case "attack":
      return [
        baseFields[0], // text (description)
        ...typeFields.attack,
        baseFields[1], // recharge (optional)
        baseFields[2], // limitedUse.count (optional)
        baseFields[3], // limitedUse.reset (optional)
      ];

    case "save":
      return [
        baseFields[0], // text
        ...typeFields.save,
        baseFields[1], // recharge (often used for breath weapons)
        baseFields[2], // limitedUse.count (optional)
        baseFields[3], // limitedUse.reset (optional)
      ];

    case "multiattack":
      return [
        baseFields[0], // text
        ...typeFields.multiattack,
      ];

    // Spellcasting moved to separate section

    case "special":
    default:
      // For special/passive traits, only show basic fields
      return baseFields;
  }
}

// Section 9: Einträge (Entries) - Using entry card system (ohne Zauber)
export const entriesFields: AnyFieldSpec[] = [
  {
    id: "entries",
    label: "Eigenschaften & Aktionen (ohne Zauber)",
    type: "repeating",
    // Transform when saving: flatten keys to nested objects
    transform: (entries: any[]) => {
      if (!entries) return [];

      return entries.map(entry => {
        const result: any = {};

        for (const [key, value] of Object.entries(entry)) {
          if (key.includes('.')) {
            // Skip undefined/null values
            if (value === undefined || value === null || value === '') continue;

            // Split key and create nested object
            const parts = key.split('.');
            let current = result;

            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) {
                current[parts[i]] = {};
              }
              current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = value;
          } else {
            result[key] = value;
          }
        }

        // Post-process: save.onSuccess should be string if only legacyText is set
        if (result.save?.onSuccess) {
          const onSuccess = result.save.onSuccess;
          if (onSuccess.legacyText && !onSuccess.damage) {
            result.save.onSuccess = onSuccess.legacyText;
          }
        }

        // Post-process: Clean up empty nested objects
        const cleanEmpty = (obj: any) => {
          for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
              cleanEmpty(obj[key]);
              if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
              }
            }
          }
        };
        cleanEmpty(result);

        return result;
      });
    },
    config: {
      static: false,

      // Use card-based rendering instead of template fields
      card: (context) => {
        const entry = context.entry as Record<string, unknown>;
        const entryType = entry.entryType as string || "special";
        const category = entry.category as string || "trait";

        return {
          className: "sm-cc-creature-entry",
          type: entryType,

          // Badge showing category
          badge: () => {
            const categoryLabel = CREATURE_ENTRY_CATEGORIES.find(
              ([id]) => id === category
            )?.[1] ?? "Unknown";
            return {
              text: categoryLabel,
              variant: category,
            };
          },

          // Simple single-line header with just name
          renderName: (nameBox, ctx) => {
            // Just the name input, full width
            const nameInput = nameBox.createEl("input", {
              value: (entry.name as string) || "",
              placeholder: "Eigenschaft benennen...",
              cls: "sm-cc-entry-name-full",
              attr: { type: "text" }
            });
            nameInput.addEventListener("input", () => {
              entry.name = nameInput.value;
            });

            // Category and type are now determined by trigger settings in the body
            // No need for separate dropdowns

            return nameInput;
          },

          // Modular trigger/effect based rendering
          renderBody: (card, ctx) => {
            const body = card.createDiv({ cls: "sm-cc-entry-body-modular" });

            // TRIGGER Section
            const triggerSection = body.createDiv({ cls: "sm-cc-trigger-section" });
            triggerSection.createEl("h4", { text: "TRIGGER", cls: "sm-cc-section-label" });

            const triggerContent = triggerSection.createDiv({ cls: "sm-cc-trigger-content" });

            // Row 1: Aktivierung (Activation)
            const activationRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            activationRow.createEl("span", { text: "Aktivierung:", cls: "sm-cc-field-label" });
            const activationSelect = activationRow.createEl("select", {
              cls: "sm-cc-compact-select",
              value: (entry['trigger.activation'] as string) || 'action'
            });
            const activationOptions = [
              { value: 'action', label: 'Aktion' },
              { value: 'bonus', label: 'Bonusaktion' },
              { value: 'reaction', label: 'Reaktion' },
              { value: 'passive', label: 'Passiv' },
              { value: 'automatic', label: 'Automatisch' }
            ];
            activationOptions.forEach(opt => {
              const option = activationSelect.createEl("option", { value: opt.value, text: opt.label });
              if (opt.value === (entry['trigger.activation'] || 'action')) option.selected = true;
            });
            activationSelect.addEventListener("change", () => {
              entry['trigger.activation'] = activationSelect.value;
              // Update category based on activation
              if (activationSelect.value === 'bonus') entry.category = 'bonus';
              else if (activationSelect.value === 'reaction') entry.category = 'reaction';
              else if (activationSelect.value === 'passive') entry.category = 'trait';
              else entry.category = 'action';
              ctx.requestRender();
            });

            // Row 2: Modifikatoren (always visible)
            const modifiersRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            modifiersRow.createEl("span", { text: "Modifikatoren:", cls: "sm-cc-field-label" });

            // Recharge checkbox and inputs
            const rechargeCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "recharge-check" }
            });
            rechargeCheck.checked = Boolean(entry.recharge);
            rechargeCheck.addEventListener("change", () => {
              if (rechargeCheck.checked) {
                entry.recharge = "5-6";
              } else {
                delete entry.recharge;
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Aufladung:",
              attr: { for: "recharge-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry.recharge) {
              const rechargeMin = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry.recharge).split("-")[0] || "5"
              });
              modifiersRow.createEl("span", { text: "-" });
              const rechargeMax = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry.recharge).split("-")[1] || "6"
              });
              [rechargeMin, rechargeMax].forEach(input => {
                input.addEventListener("input", () => {
                  entry.recharge = `${rechargeMin.value}-${rechargeMax.value}`;
                });
              });
            }

            // Limited use checkbox and inputs
            const limitedCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "limited-check" }
            });
            limitedCheck.checked = Boolean(entry.limitedUse);
            limitedCheck.addEventListener("change", () => {
              if (limitedCheck.checked) {
                entry.limitedUse = { count: 3, reset: "day" };
              } else {
                delete entry.limitedUse;
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Begrenzt:",
              attr: { for: "limited-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry.limitedUse) {
              const limitInput = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String((entry.limitedUse as any)?.count || 3)
              });
              modifiersRow.createEl("span", { text: "pro" });
              const resetSelect = modifiersRow.createEl("select", {
                cls: "sm-cc-tiny-select"
              });
              const resetOptions = [
                { value: 'day', label: 'Tag' },
                { value: 'short-rest', label: 'Kurze Rast' },
                { value: 'long-rest', label: 'Lange Rast' }
              ];
              resetOptions.forEach(opt => {
                const option = resetSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === (entry.limitedUse as any)?.reset) option.selected = true;
              });
              limitInput.addEventListener("input", () => {
                if (!entry.limitedUse) entry.limitedUse = {};
                (entry.limitedUse as any).count = parseInt(limitInput.value) || 1;
              });
              resetSelect.addEventListener("change", () => {
                if (!entry.limitedUse) entry.limitedUse = {};
                (entry.limitedUse as any).reset = resetSelect.value;
              });
            }

            // Legendary checkbox and input
            const legendaryCheck = modifiersRow.createEl("input", {
              type: "checkbox",
              attr: { id: "legendary-check" }
            });
            legendaryCheck.checked = Boolean(entry['trigger.legendaryCost']);
            legendaryCheck.addEventListener("change", () => {
              if (legendaryCheck.checked) {
                entry['trigger.legendaryCost'] = 1;
                entry.category = 'legendary';
              } else {
                delete entry['trigger.legendaryCost'];
                if (entry['trigger.activation'] !== 'passive') {
                  entry.category = 'action';
                }
              }
              ctx.requestRender();
            });
            modifiersRow.createEl("label", {
              text: "Legendär:",
              attr: { for: "legendary-check" },
              cls: "sm-cc-checkbox-label"
            });

            if (entry['trigger.legendaryCost']) {
              const costInput = modifiersRow.createEl("input", {
                type: "number",
                cls: "sm-cc-tiny-number",
                value: String(entry['trigger.legendaryCost'] || 1)
              });
              modifiersRow.createEl("span", { text: "Kosten" });
              costInput.addEventListener("input", () => {
                entry['trigger.legendaryCost'] = parseInt(costInput.value) || 1;
              });
            }

            // Row 3: Bedingungen (Conditions) - based on activation type
            if (entry['trigger.activation'] === 'reaction') {
              const reactionRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
              reactionRow.createEl("span", { text: "Auslöser:", cls: "sm-cc-field-label" });
              const reactionInput = reactionRow.createEl("input", {
                cls: "sm-cc-long-text",
                value: (entry['trigger.reactionTrigger'] as string) || '',
                placeholder: "z.B. wird getroffen, sieht einen Zauber gewirkt..."
              });
              reactionInput.addEventListener("input", () => {
                entry['trigger.reactionTrigger'] = reactionInput.value;
              });
            } else if (entry['trigger.activation'] === 'automatic') {
              const timingRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
              timingRow.createEl("span", { text: "Zeitpunkt:", cls: "sm-cc-field-label" });
              const timingSelect = timingRow.createEl("select", {
                cls: "sm-cc-compact-select",
                value: (entry['trigger.automaticTiming'] as string) || 'start-of-turn'
              });
              const timingOptions = [
                { value: 'start-of-turn', label: 'Am Beginn der Runde der Kreatur' },
                { value: 'end-of-turn', label: 'Am Ende der Runde der Kreatur' },
                { value: 'start-of-any-turn', label: 'Am Beginn jeder Kreatur-Runde' },
                { value: 'end-of-any-turn', label: 'Am Ende jeder Kreatur-Runde' }
              ];
              timingOptions.forEach(opt => {
                const option = timingSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === entry['trigger.automaticTiming']) option.selected = true;
              });
              timingSelect.addEventListener("change", () => {
                entry['trigger.automaticTiming'] = timingSelect.value;
              });
            }

            // Row 4: Zielbereich (Targeting)
            const targetingRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            targetingRow.createEl("span", { text: "Zielbereich:", cls: "sm-cc-field-label" });
            const targetTypeSelect = targetingRow.createEl("select", {
              cls: "sm-cc-compact-select",
              value: (entry['trigger.targeting.type'] as string) || 'single'
            });
            const targetTypes = [
              { value: 'self', label: 'Selbst' },
              { value: 'single', label: 'Einzelziel' },
              { value: 'multiple', label: 'Mehrere Ziele' },
              { value: 'area', label: 'Bereich' }
            ];
            targetTypes.forEach(opt => {
              const option = targetTypeSelect.createEl("option", { value: opt.value, text: opt.label });
              if (opt.value === (entry['trigger.targeting.type'] || 'single')) option.selected = true;
            });
            targetTypeSelect.addEventListener("change", () => {
              if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
              (entry['trigger.targeting'] as any).type = targetTypeSelect.value;
              ctx.requestRender();
            });

            // Additional targeting fields based on type
            const targetType = entry['trigger.targeting.type'] || 'single';
            if (targetType === 'single' || targetType === 'multiple') {
              if (targetType === 'multiple') {
                targetingRow.createEl("span", { text: "Anzahl:" });
                const countInput = targetingRow.createEl("input", {
                  type: "number",
                  cls: "sm-cc-tiny-number",
                  value: String(entry['trigger.targeting.count'] || 2)
                });
                countInput.addEventListener("input", () => {
                  if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                  (entry['trigger.targeting'] as any).count = parseInt(countInput.value) || 1;
                });
              }
              targetingRow.createEl("span", { text: "Reichweite:" });
              const rangeInput = targetingRow.createEl("input", {
                cls: "sm-cc-compact-text",
                value: (entry['trigger.targeting.range'] as string) || '',
                placeholder: "z.B. 30 ft."
              });
              rangeInput.addEventListener("input", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).range = rangeInput.value;
              });

              const sightCheck = targetingRow.createEl("input", {
                type: "checkbox",
                attr: { id: "sight-required" }
              });
              sightCheck.checked = entry['trigger.targeting.sightRequired'] === true;
              sightCheck.addEventListener("change", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).sightRequired = sightCheck.checked;
              });
              targetingRow.createEl("label", {
                text: "Sichtlinie erforderlich",
                attr: { for: "sight-required" },
                cls: "sm-cc-checkbox-label"
              });
            } else if (targetType === 'area') {
              targetingRow.createEl("span", { text: "Form:" });
              const shapeSelect = targetingRow.createEl("select", {
                cls: "sm-cc-compact-select",
                value: (entry['trigger.targeting.shape'] as string) || 'cone'
              });
              const shapes = [
                { value: 'cone', label: 'Kegel' },
                { value: 'emanation', label: 'Aura' },
                { value: 'line', label: 'Linie' },
                { value: 'cube', label: 'Würfel' },
                { value: 'sphere', label: 'Kugel' }
              ];
              shapes.forEach(opt => {
                const option = shapeSelect.createEl("option", { value: opt.value, text: opt.label });
                if (opt.value === entry['trigger.targeting.shape']) option.selected = true;
              });
              shapeSelect.addEventListener("change", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).shape = shapeSelect.value;
              });

              targetingRow.createEl("span", { text: "Größe:" });
              const sizeInput = targetingRow.createEl("input", {
                cls: "sm-cc-compact-text",
                value: (entry['trigger.targeting.size'] as string) || '',
                placeholder: "z.B. 15 ft."
              });
              sizeInput.addEventListener("input", () => {
                if (!entry['trigger.targeting']) entry['trigger.targeting'] = {};
                (entry['trigger.targeting'] as any).size = sizeInput.value;
              });
            }

            // Row 5: Einschränkungen (Restrictions) - always visible
            const restrictionsRow = triggerContent.createDiv({ cls: "sm-cc-field-row" });
            restrictionsRow.createEl("span", { text: "Einschränkungen:", cls: "sm-cc-field-label" });

            // Size restriction checkbox and dropdown
            const sizeCheck = restrictionsRow.createEl("input", {
              type: "checkbox",
              attr: { id: "size-restriction" }
            });
            const restrictions = entry['trigger.restrictions'] as any || {};
            sizeCheck.checked = Boolean(restrictions.maxSize);
            sizeCheck.addEventListener("change", () => {
              if (sizeCheck.checked) {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).maxSize = 'Mittel';
              } else {
                if (entry['trigger.restrictions']) {
                  delete (entry['trigger.restrictions'] as any).maxSize;
                  // Clean up if empty
                  if (Object.keys(entry['trigger.restrictions'] as any).length === 0) {
                    delete entry['trigger.restrictions'];
                  }
                }
              }
              ctx.requestRender();
            });
            restrictionsRow.createEl("label", {
              text: "Max. Größe:",
              attr: { for: "size-restriction" },
              cls: "sm-cc-checkbox-label-small"
            });

            if (restrictions.maxSize) {
              const sizeSelect = restrictionsRow.createEl("select", {
                cls: "sm-cc-tiny-select"
              });
              ['Klein', 'Mittel', 'Groß', 'Riesig'].forEach(size => {
                const opt = sizeSelect.createEl("option", { value: size, text: size });
                if (size === restrictions.maxSize) opt.selected = true;
              });
              sizeSelect.addEventListener("change", () => {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).maxSize = sizeSelect.value;
              });
            }

            // Custom restriction text input
            const otherInput = restrictionsRow.createEl("input", {
              cls: "sm-cc-long-text",
              value: restrictions.other || '',
              placeholder: "Weitere Einschränkungen (z.B. muss ergriffen sein)"
            });
            otherInput.addEventListener("input", () => {
              if (otherInput.value) {
                if (!entry['trigger.restrictions']) entry['trigger.restrictions'] = {};
                (entry['trigger.restrictions'] as any).other = otherInput.value;
              } else {
                if (entry['trigger.restrictions']) {
                  delete (entry['trigger.restrictions'] as any).other;
                  // Clean up if empty
                  if (Object.keys(entry['trigger.restrictions'] as any).length === 0) {
                    delete entry['trigger.restrictions'];
                  }
                }
              }
            });

            // EFFEKTE Section
            const effectsSection = body.createDiv({ cls: "sm-cc-effects-section" });
            effectsSection.createEl("h4", { text: "EFFEKTE", cls: "sm-cc-section-label" });

            const effectsContent = effectsSection.createDiv({ cls: "sm-cc-effects-content" });

            // Render existing effects based on entry type (for backward compatibility)
            if (entryType === "attack") {
              renderAttackEffect(effectsContent, entry, ctx);
            } else if (entryType === "save") {
              renderSaveEffect(effectsContent, entry, ctx);
            } else if (entryType === "multiattack") {
              renderMultiattackEffect(effectsContent, entry, ctx);
            }

            // Add effect buttons
            const addEffectsRow = effectsContent.createDiv({ cls: "sm-cc-add-effects-row" });
            ['+ Angriff', '+ Rettungswurf', '+ Schaden', '+ Zustand'].forEach(label => {
              const btn = addEffectsRow.createEl("button", {
                cls: "sm-cc-compact-btn",
                text: label
              });
              btn.addEventListener("click", () => {
                // TODO: Add effect to action
              });
            });

            // Description
            const descSection = body.createDiv({ cls: "sm-cc-description-section" });
            const textarea = descSection.createEl("textarea", {
              cls: "sm-cc-entry-description",
              placeholder: "Beschreibungstext...",
              value: (entry.text as string) || ''
            });
            textarea.addEventListener("input", () => {
              entry.text = textarea.value;
            });
          },

          // Add data-entry-id for navigation
          dataset: {
            entryId: String(entry.name || `entry-${context.index}`)
          },

          // Add collapse toggle in head
          renderHeadExtras: (head, ctx, slots) => {
            const toggle = head.createDiv({
              cls: "sm-cc-entry-toggle",
              attr: { "aria-expanded": "true", "aria-label": "Toggle entry" }
            });
            setIcon(toggle, "chevron-down");

            // Move toggle to start of head
            head.prepend(toggle);

            toggle.addEventListener("click", (e) => {
              e.stopPropagation();
              const isExpanded = toggle.getAttribute("aria-expanded") === "true";
              toggle.setAttribute("aria-expanded", String(!isExpanded));
              slots.card.toggleClass("is-collapsed", isExpanded);
              setIcon(toggle, isExpanded ? "chevron-right" : "chevron-down");
            });
          },
        };
      },

      // Categories for filtering
      categories: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({
        id,
        label,
        defaultActive: true,
      })),

      // Filters for entry types
      filters: CREATURE_ENTRY_CATEGORIES.map(([id, label]) => ({
        id,
        label,
        predicate: (entry: Record<string, unknown>) => entry.category === id,
      })),
    },
    default: [],
  },
];
