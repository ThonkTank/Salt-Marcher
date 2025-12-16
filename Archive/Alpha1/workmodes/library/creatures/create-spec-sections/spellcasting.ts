// src/workmodes/library/creatures/create-spec-sections/spellcasting.ts
// Spellcasting fields with custom rendering for spell lists and configuration

import type { AnyFieldSpec } from "@features/data-manager/data-manager-types";

/**
 * Render spellcasting entry with full details
 */
function renderSpellcastingEntry(container: HTMLElement, entry: Record<string, unknown>, ctx: any): void {
  // Configuration section
  const configSection = container.createDiv({ cls: "sm-cc-spell-config" });

  // Spellcasting ability
  configSection.createEl("span", { text: "Fähigkeit:", cls: "sm-cc-spell-label" });
  const abilitySelect = configSection.createEl("select", {
    cls: "sm-cc-compact-select"
  });
  const abilities = [
    { value: 'int', label: 'INT' },
    { value: 'wis', label: 'WIS' },
    { value: 'cha', label: 'CHA' },
    { value: 'str', label: 'STR' },
    { value: 'dex', label: 'DEX' },
    { value: 'con', label: 'CON' }
  ];
  abilities.forEach(ab => {
    const opt = abilitySelect.createEl("option", { value: ab.value, text: ab.label });
    if (ab.value === (entry['spellcasting.ability'] || 'int')) opt.selected = true;
  });
  abilitySelect.addEventListener("change", () => {
    entry['spellcasting.ability'] = abilitySelect.value;
  });

  // Save DC
  configSection.createEl("span", { text: "Zauber DC:", cls: "sm-cc-spell-label" });
  const dcInput = configSection.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['spellcasting.saveDC'] || 10),
    placeholder: "DC"
  });
  dcInput.addEventListener("input", () => {
    entry['spellcasting.saveDC'] = parseInt(dcInput.value) || 10;
  });

  // Attack bonus
  configSection.createEl("span", { text: "Angriffsbonus:", cls: "sm-cc-spell-label" });
  const bonusWrapper = configSection.createDiv({ cls: "sm-cc-entry-row" });
  bonusWrapper.createEl("span", { text: "+" });
  const bonusInput = bonusWrapper.createEl("input", {
    type: "number",
    cls: "sm-cc-compact-number",
    value: String(entry['spellcasting.attackBonus'] || 0),
    placeholder: "Bonus"
  });
  bonusInput.addEventListener("input", () => {
    entry['spellcasting.attackBonus'] = parseInt(bonusInput.value) || 0;
  });

  // Excluded components
  configSection.createEl("span", { text: "Ohne:", cls: "sm-cc-spell-label" });
  const componentsDiv = configSection.createDiv({ cls: "sm-cc-entry-row" });
  const excludedComponents = (entry['spellcasting.excludeComponents'] as string[]) || [];
  ['V', 'S', 'M'].forEach(comp => {
    const checkbox = componentsDiv.createEl("input", {
      type: "checkbox",
      attr: { id: `exclude-${comp}` }
    });
    checkbox.checked = excludedComponents.includes(comp);
    checkbox.addEventListener("change", () => {
      const current = (entry['spellcasting.excludeComponents'] as string[]) || [];
      if (checkbox.checked && !current.includes(comp)) {
        current.push(comp);
      } else if (!checkbox.checked) {
        const index = current.indexOf(comp);
        if (index > -1) current.splice(index, 1);
      }
      entry['spellcasting.excludeComponents'] = current;
    });
    const label = componentsDiv.createEl("label", {
      text: comp,
      attr: { for: `exclude-${comp}` },
      cls: "sm-cc-checkbox-label"
    });
    label.style.marginRight = "12px";
  });

  // Spell lists section
  const listsSection = container.createDiv({ cls: "sm-cc-spell-lists" });
  listsSection.createEl("h4", { text: "Zauberlisten", cls: "sm-cc-spell-label" });

  const spellLists = (entry['spellcasting.spellLists'] as any[]) || [];

  // Display existing spell lists
  spellLists.forEach((list, index) => {
    const listItem = listsSection.createDiv({ cls: "sm-cc-spell-list-item" });

    // Frequency
    const freqInput = listItem.createEl("input", {
      cls: "sm-cc-spell-frequency",
      value: list.frequency || "At Will",
      placeholder: "Frequency"
    });
    freqInput.addEventListener("input", () => {
      list.frequency = freqInput.value;
      ctx.requestRender();
    });

    // Spell names
    const spellsDiv = listItem.createDiv({ cls: "sm-cc-spell-names" });
    const spells = list.spells || [];
    spells.forEach((spell: string) => {
      spellsDiv.createEl("span", {
        text: spell,
        cls: "sm-cc-spell-chip"
      });
    });

    // Add spell button
    const addSpellBtn = listItem.createEl("button", {
      cls: "sm-cc-compact-btn",
      text: "+ Zauber"
    });
    addSpellBtn.addEventListener("click", () => {
      // TODO: Open modal to add spells to list
    });
  });

  // Add new spell list button
  const addListBtn = listsSection.createEl("button", {
    cls: "sm-cc-compact-btn",
    text: "+ Neue Zauberliste"
  });
  addListBtn.addEventListener("click", () => {
    if (!entry['spellcasting.spellLists']) {
      entry['spellcasting.spellLists'] = [];
    }
    (entry['spellcasting.spellLists'] as any[]).push({
      frequency: "1/Tag",
      spells: []
    });
    ctx.requestRender();
  });
}

// Section 8: Zauber & Zauberwirken (Spells & Spellcasting) - Separated from main entries
export const spellcastingFields: AnyFieldSpec[] = [
  {
    id: "spellcastingEntries",
    label: "Zauber & Zauberwirken",
    type: "repeating",
    config: {
      static: false,
      card: (context) => {
        const entry = context.entry as Record<string, unknown>;
        return {
          className: "sm-cc-spellcasting-entry",
          type: "spellcasting",
          badge: () => ({
            text: "Zauberwirken",
            variant: "spellcasting",
          }),
          renderName: (nameBox, ctx) => {
            // Simple single input for spellcasting
            const nameInput = nameBox.createEl("input", {
              value: (entry.name as string) || "",
              placeholder: "Zaubername oder Beschreibung",
              cls: "sm-cc-entry-name-input",
              attr: { type: "text" }
            });
            nameInput.addEventListener("input", () => {
              entry.name = nameInput.value;
            });
            return nameInput;
          },
          renderBody: (card, ctx) => {
            const body = card.createDiv({ cls: "sm-cc-spell-body" });
            renderSpellcastingEntry(body, entry, ctx);
          },
        };
      },
    },
    default: [],
  },
];
