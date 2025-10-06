// src/apps/library/create/creature/components/basics/alignment-editor.ts
// Alignment-Editor Komponente für Law/Chaos, Good/Evil und Override

import { DropdownComponent } from "obsidian";
import { enhanceExistingSelectDropdown } from "../../../shared/form-controls";
import type { StatblockData } from "../../../core/creature-files";
import type { FieldGridHandle } from "../../../shared/layouts";

const LAW_CHAOS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Lawful", label: "Rechtschaffen" },
  { value: "Neutral", label: "Neutral" },
  { value: "Chaotic", label: "Chaotisch" },
];

const GOOD_EVIL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Good", label: "Gut" },
  { value: "Neutral", label: "Neutral" },
  { value: "Evil", label: "Böse" },
];

/**
 * Options for creating an alignment editor
 */
export interface AlignmentEditorOptions {
  /** Field grid to add settings to */
  grid: FieldGridHandle;
  /** The statblock data to read/write */
  data: StatblockData;
}

/**
 * Creates alignment editor with Law/Chaos, Good/Evil dropdowns and Override field
 *
 * Features:
 * - Two dropdowns: Law/Chaos and Good/Evil axis
 * - Override input that disables dropdowns when filled
 * - Stores values in data.alignmentLawChaos, data.alignmentGoodEvil, data.alignmentOverride
 *
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * const grid = createFieldGrid(parent, { variant: "classification" });
 * createAlignmentEditor({ grid, data: statblockData });
 * // User selects "Lawful" and "Good" → data.alignmentLawChaos = "Lawful", data.alignmentGoodEvil = "Good"
 * // User types "Unaligned" in override → dropdowns become disabled
 * ```
 */
export function createAlignmentEditor(options: AlignmentEditorOptions): void {
  const { grid, data } = options;

  let lawChaosDropdown: DropdownComponent | null = null;
  let goodEvilDropdown: DropdownComponent | null = null;

  const refreshControls = () => {
    const hasOverride = Boolean((data.alignmentOverride ?? "").trim());
    const toggleDropdown = (dropdown: DropdownComponent | null) => {
      if (!dropdown) return;
      if (hasOverride) {
        dropdown.selectEl.setAttribute("disabled", "true");
        dropdown.selectEl.setAttribute("aria-disabled", "true");
      } else {
        dropdown.selectEl.removeAttribute("disabled");
        dropdown.selectEl.removeAttribute("aria-disabled");
      }
    };
    toggleDropdown(lawChaosDropdown);
    toggleDropdown(goodEvilDropdown);
  };

  // Law/Chaos Dropdown
  const lawChaosSetting = grid.createSetting("Gesetz/Chaos", {
    className: "sm-cc-setting--show-name",
  });
  lawChaosSetting.addDropdown((dd) => {
    lawChaosDropdown = dd;
    for (const option of LAW_CHAOS_OPTIONS) dd.addOption(option.value, option.label);
    dd.onChange((value: string) => {
      data.alignmentLawChaos = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.alignmentLawChaos ?? ""); // Set value AFTER enhancement to sync search display
    refreshControls();
  });

  // Good/Evil Dropdown
  const goodEvilSetting = grid.createSetting("Gut/Böse", {
    className: "sm-cc-setting--show-name",
  });
  goodEvilSetting.addDropdown((dd) => {
    goodEvilDropdown = dd;
    for (const option of GOOD_EVIL_OPTIONS) dd.addOption(option.value, option.label);
    dd.onChange((value: string) => {
      data.alignmentGoodEvil = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.alignmentGoodEvil ?? ""); // Set value AFTER enhancement to sync search display
    refreshControls();
  });

  // Override Input
  const overrideSetting = grid.createSetting("Alignment-Override", {
    className: [
      "sm-cc-setting--span-2",
      "sm-cc-setting--show-name",
      "sm-cc-setting--alignment-override",
    ],
  });
  overrideSetting.addText((t) => {
    const applyOverride = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed) data.alignmentOverride = trimmed;
      else data.alignmentOverride = undefined;
      refreshControls();
    };
    t.setPlaceholder('z. B. Unaligned oder "Lawful Neutral"')
      .setValue(data.alignmentOverride ?? "")
      .onChange(applyOverride);
    t.inputEl.addEventListener("input", () => applyOverride(t.inputEl.value));
    t.inputEl.classList.add("sm-cc-input", "sm-cc-input--alignment-override");
  });

  refreshControls();
}
