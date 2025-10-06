// src/apps/library/create/creature/section-basics.ts
// Stellt separate Mount-Funktionen für Klassifikation (Name, Typ, Alignment, PB/CR/XP) und Vitaldaten (AC, HP, Bewegung) bereit.
import { enhanceExistingSelectDropdown } from "../shared/form-controls";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_MOVEMENT_TYPES,
} from "./presets";
import { mountTokenEditor } from "../shared/token-editor";
import { createFormCard, createFieldGrid } from "../shared/layouts";
import { mountMovementEditor } from "./section-utils";
import { createAlignmentEditor } from "./components/basics/alignment-editor";
import { createMovementModel } from "./components/basics/movement-model";

function ensureTypeTags(data: StatblockData): string[] {
  if (!Array.isArray(data.typeTags)) data.typeTags = [];
  return data.typeTags!;
}

export function mountCreatureClassificationSection(
  parent: HTMLElement,
  data: StatblockData,
  options?: {
    onPresetSelected?: (preset: any) => void;
    app?: any;
  }
) {
  const card = createFormCard(parent, {
    title: "Identität & Klassifikation",
    role: "group",
  });
  card.card.addClass("sm-cc-card--basics");
  card.body.addClass("sm-cc-card__body--basics");

  const identitySection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const identityGrid = createFieldGrid(identitySection, {
    variant: "identity",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "18rem",
  });

  const nameSetting = identityGrid.createSetting("Name");
  nameSetting.settingEl.addClass("sm-cc-setting--show-name");
  nameSetting.addText((t) => {
    t.setPlaceholder("Aboleth oder Preset suchen...")
      .setValue(data.name || "")
      .onChange((v: string) => (data.name = v.trim()));
    t.inputEl.classList.add("sm-cc-input");

    // Autocomplete für Presets
    if (options?.app && options?.onPresetSelected) {
      let autocompleteContainer: HTMLDivElement | null = null;
      let selectedIndex = -1;

      const showAutocomplete = async (query: string) => {
        if (query.length < 2) {
          hideAutocomplete();
          return;
        }

        // Dynamisches Import um Circular Dependency zu vermeiden
        const { findCreaturePresets } = await import('../../core/creature-presets');
        const results = await findCreaturePresets(options.app, query, { limit: 8 });

        if (results.length === 0) {
          hideAutocomplete();
          return;
        }

        if (!autocompleteContainer) {
          autocompleteContainer = document.createElement('div');
          autocompleteContainer.className = 'sm-cc-autocomplete';
          t.inputEl.parentElement?.appendChild(autocompleteContainer);
        }

        autocompleteContainer.empty();
        selectedIndex = -1;

        results.forEach((result, index) => {
          const item = autocompleteContainer!.createDiv({ cls: 'sm-cc-autocomplete__item' });
          const name = item.createDiv({ cls: 'sm-cc-autocomplete__name', text: result.data.name });
          const meta = item.createDiv({ cls: 'sm-cc-autocomplete__meta' });

          const parts: string[] = [];
          if (result.data.size) parts.push(result.data.size);
          if (result.data.type) parts.push(result.data.type);
          if (result.data.cr) parts.push(`CR ${result.data.cr}`);
          meta.setText(parts.join(' • '));

          item.addEventListener('click', () => {
            hideAutocomplete();
            options.onPresetSelected?.(result.data);
          });

          item.addEventListener('mouseenter', () => {
            selectedIndex = index;
            updateSelection();
          });
        });

        updateSelection();
      };

      const hideAutocomplete = () => {
        autocompleteContainer?.remove();
        autocompleteContainer = null;
        selectedIndex = -1;
      };

      const updateSelection = () => {
        if (!autocompleteContainer) return;
        const items = autocompleteContainer.querySelectorAll('.sm-cc-autocomplete__item');
        items.forEach((item, index) => {
          item.classList.toggle('is-selected', index === selectedIndex);
        });
      };

      const selectItem = () => {
        if (!autocompleteContainer || selectedIndex < 0) return;
        const items = autocompleteContainer.querySelectorAll('.sm-cc-autocomplete__item');
        const item = items[selectedIndex] as HTMLElement;
        item?.click();
      };

      t.inputEl.addEventListener('input', () => {
        void showAutocomplete(t.inputEl.value);
      });

      t.inputEl.addEventListener('keydown', (e) => {
        if (!autocompleteContainer) return;

        const items = autocompleteContainer.querySelectorAll('.sm-cc-autocomplete__item');

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          updateSelection();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
          updateSelection();
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          selectItem();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideAutocomplete();
        }
      });

      t.inputEl.addEventListener('blur', () => {
        // Delay to allow click events to fire
        setTimeout(() => hideAutocomplete(), 200);
      });
    }
  });

  const typeSetting = identityGrid.createSetting("Typ");
  typeSetting.settingEl.addClass("sm-cc-setting--show-name");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.type = v));
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.type ?? ""); // Set value AFTER enhancement to sync search display
  });

  const sizeSetting = identityGrid.createSetting("Größe");
  sizeSetting.settingEl.addClass("sm-cc-setting--show-name");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.size = v));
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.size ?? ""); // Set value AFTER enhancement to sync search display
  });

  const tags = ensureTypeTags(data);
  const typeTagsEditor = mountTokenEditor(identitySection, "Typ-Tags", {
    getItems: () => tags.slice(),
    add: (value) => {
      const normalized = value.trim();
      if (!normalized) return;
      const exists = tags.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
      if (!exists) tags.push(normalized);
      typeTagsEditor.refresh();
    },
    remove: (index) => {
      tags.splice(index, 1);
      typeTagsEditor.refresh();
    },
  }, {
    placeholder: "z. B. shapechanger",
    addButtonLabel: "+ Tag",
  });
  typeTagsEditor.setting.settingEl.addClass("sm-cc-setting--stack");

  const classificationSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const classificationGrid = createFieldGrid(classificationSection, {
    variant: "classification",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "16rem",
  });

  // Alignment editor (Law/Chaos, Good/Evil, Override)
  createAlignmentEditor({ grid: classificationGrid, data });

  const createClassificationField = (label: string, placeholder: string, key: keyof StatblockData) => {
    const setting = classificationGrid.createSetting(label);
    setting.settingEl.addClass("sm-cc-setting--show-name");
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-input");
    });
  };

  createClassificationField("PB", "+4", "pb");
  createClassificationField("CR", "10", "cr");
  createClassificationField("XP", "5900", "xp");
}

export function mountCreatureVitalSection(parent: HTMLElement, data: StatblockData) {
  const card = createFormCard(parent, {
    title: "Vitalwerte & Bewegung",
    role: "group",
  });
  card.card.addClass("sm-cc-card--basics");
  card.body.addClass("sm-cc-card__body--basics");

  const vitalsSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const vitalsGrid = createFieldGrid(vitalsSection, {
    variant: "vitals",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "16rem",
  });

  const createVitalField = (label: string, placeholder: string, key: keyof StatblockData) => {
    const setting = vitalsGrid.createSetting(label);
    setting.settingEl.addClass("sm-cc-setting--show-name");
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-input");
    });
  };

  createVitalField("AC", "17", "ac");
  createVitalField("HP", "150", "hp");
  createVitalField("Initiative", "+7", "initiative");
  createVitalField("Hit Dice", "20d10 + 40", "hitDice");

  const movementSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });

  // Movement editor
  const movementModel = createMovementModel(data, CREATURE_MOVEMENT_TYPES);
  mountMovementEditor(movementSection, "Bewegungsraten", CREATURE_MOVEMENT_TYPES, movementModel);
}
