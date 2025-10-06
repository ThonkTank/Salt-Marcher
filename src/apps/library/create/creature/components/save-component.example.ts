// src/apps/library/create/creature/components/save-component.example.ts
// Usage examples and integration guide for the save component

import { createSaveComponent, formatSaveOutput, validateSaveEntry } from "./save-component";
import type { CreatureEntry } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";

/**
 * EXAMPLE 1: Basic Save Component
 *
 * Creates a simple save component with manual DC entry.
 * This is the most common use case for creature abilities.
 */
export function example1_BasicSave() {
  // Sample creature data
  const statblockData: StatblockData = {
    name: "Young Red Dragon",
    pb: 4,
    str: 23,
    dex: 10,
    con: 21,
    int: 14,
    wis: 11,
    cha: 19,
    // ... other fields
  } as StatblockData;

  // Create an entry for a breath weapon
  const breathEntry: CreatureEntry = {
    category: "action",
    name: "Fire Breath",
    save_ability: "DEX",
    save_dc: 17,
    text: "59 (17d6) fire damage",
    save_effect: "Half damage",
  };

  // Get container element (in real usage, this would be a parent element)
  const container = document.createElement("div");

  // Create the save component
  const handle = createSaveComponent(container, {
    entry: breathEntry,
    data: statblockData,
    onUpdate: () => {
      console.log("Entry updated:", breathEntry);

      // Validate the entry
      const errors = handle.validate();
      if (errors.length > 0) {
        console.error("Validation errors:", errors);
      }

      // Format output
      const formatted = formatSaveOutput(breathEntry);
      console.log("Formatted output:\n", formatted);
    },
    enableAutoDC: false, // Manual DC entry
  });

  // Append to page
  document.body.appendChild(container);
}

/**
 * EXAMPLE 2: Auto-Calculated DC
 *
 * Uses the spellcasting ability to automatically calculate DC.
 * Ideal for spellcasters and creatures with spell-like abilities.
 */
export function example2_AutoCalculatedDC() {
  const statblockData: StatblockData = {
    name: "Lich",
    pb: 7,
    str: 11,
    dex: 16,
    con: 16,
    int: 20, // Primary spellcasting ability
    wis: 14,
    cha: 16,
  } as StatblockData;

  const paralyticTouchEntry: CreatureEntry = {
    category: "action",
    name: "Paralyzing Touch",
    spellAbility: "int", // Use Intelligence for DC calculation
    // save_dc will be auto-calculated: 8 + 7 (PB) + 5 (INT mod) = 20
    save_ability: "CON",
    text: "The target is paralyzed for 1 minute",
    save_effect: "No effect",
    recharge: "Save at end of each turn",
  };

  const container = document.createElement("div");

  const handle = createSaveComponent(container, {
    entry: paralyticTouchEntry,
    data: statblockData,
    onUpdate: () => {
      console.log("Auto-calculated DC:", paralyticTouchEntry.save_dc);
      // DC should be 20 (8 + 7 + 5)
    },
    enableAutoDC: true, // Enable auto-calculation
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 3: Multiple Damage Types on Save
 *
 * Demonstrates handling complex save effects with
 * different outcomes on success and failure.
 */
export function example3_ComplexSaveEffect() {
  const statblockData: StatblockData = {
    name: "Adult Blue Dragon",
    pb: 6,
    str: 27,
    dex: 10,
    con: 25,
    int: 16,
    wis: 15,
    cha: 19,
  } as StatblockData;

  const lightningBreathEntry: CreatureEntry = {
    category: "action",
    name: "Lightning Breath",
    save_ability: "DEX",
    save_dc: 19,
    text: "66 (12d10) lightning damage",
    save_effect: "Half damage",
    recharge: "Recharge 5-6",
  };

  const container = document.createElement("div");

  const handle = createSaveComponent(container, {
    entry: lightningBreathEntry,
    data: statblockData,
    onUpdate: () => {
      // Format for display in statblock
      const output = formatSaveOutput(lightningBreathEntry);
      console.log(output);
      /*
       * Output:
       * Dexterity Saving Throw: DC 19
       * Failure: 66 (12d10) lightning damage
       * Success: Half damage
       */
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 4: Custom Success Effect
 *
 * Shows how to use a custom success effect instead
 * of the predefined presets.
 */
export function example4_CustomSuccessEffect() {
  const statblockData: StatblockData = {
    name: "Medusa",
    pb: 4,
    str: 10,
    dex: 15,
    con: 16,
    int: 12,
    wis: 13,
    cha: 15,
  } as StatblockData;

  const petrifyingGazeEntry: CreatureEntry = {
    category: "action",
    name: "Petrifying Gaze",
    save_ability: "CON",
    save_dc: 14,
    text: "The target begins to turn to stone and is restrained. It must repeat the saving throw at the end of its next turn. On a success, the effect ends. On a failure, the target is petrified.",
    save_effect: "Restrained until end of next turn",
  };

  const container = document.createElement("div");

  createSaveComponent(container, {
    entry: petrifyingGazeEntry,
    data: statblockData,
    onUpdate: () => {
      console.log("Custom effect:", petrifyingGazeEntry.save_effect);
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 5: Recurring Saves
 *
 * Demonstrates the "Save at end of turn" checkbox
 * for ongoing effects.
 */
export function example5_RecurringSaves() {
  const statblockData: StatblockData = {
    name: "Mind Flayer",
    pb: 4,
    str: 11,
    dex: 12,
    con: 12,
    int: 19,
    wis: 17,
    cha: 17,
  } as StatblockData;

  const mindBlastEntry: CreatureEntry = {
    category: "action",
    name: "Mind Blast",
    save_ability: "INT",
    save_dc: 15,
    text: "22 (4d8 + 4) psychic damage and is stunned for 1 minute",
    save_effect: "Half damage and not stunned",
    recharge: "Save at end of each turn", // Recurring save
  };

  const container = document.createElement("div");

  const handle = createSaveComponent(container, {
    entry: mindBlastEntry,
    data: statblockData,
    onUpdate: () => {
      const output = formatSaveOutput(mindBlastEntry);
      console.log(output);
      /*
       * Output:
       * Intelligence Saving Throw: DC 15
       * Failure: 22 (4d8 + 4) psychic damage and is stunned for 1 minute
       * Success: Half damage and not stunned
       * (Save at end of each turn)
       */
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 6: Validation and Error Handling
 *
 * Shows how to validate save entries and handle
 * incomplete or invalid configurations.
 */
export function example6_Validation() {
  // Incomplete entry (missing DC)
  const incompleteEntry: CreatureEntry = {
    category: "action",
    name: "Poison Spray",
    save_ability: "CON",
    // save_dc is missing!
    text: "10 (3d6) poison damage",
  };

  // Validate using the standalone function
  const errors = validateSaveEntry(incompleteEntry);

  if (errors.length > 0) {
    console.error("Validation errors found:");
    errors.forEach(error => console.error(" -", error));
    /*
     * Output:
     * Validation errors found:
     *  - Poison Spray: DC is required when save ability is set
     */
  }

  // Can also validate via the component handle
  const statblockData = { pb: 2 } as StatblockData;
  const container = document.createElement("div");

  const handle = createSaveComponent(container, {
    entry: incompleteEntry,
    data: statblockData,
    onUpdate: () => {},
  });

  const componentErrors = handle.validate();
  console.log("Component validation:", componentErrors);
}

/**
 * EXAMPLE 7: Integration with Entry Card
 *
 * Shows how to integrate the save component into
 * the existing entry card system.
 */
export function example7_EntryCardIntegration() {
  const statblockData: StatblockData = {
    name: "Green Dragon",
    pb: 5,
    str: 23,
    dex: 12,
    con: 21,
    int: 18,
    wis: 15,
    cha: 17,
  } as StatblockData;

  const poisonBreathEntry: CreatureEntry = {
    category: "action",
    name: "Poison Breath",
    save_ability: "CON",
    save_dc: 18,
    text: "56 (16d6) poison damage",
    save_effect: "Half damage",
  };

  // In the actual entry card, you would call this within
  // the createEntryCard function:
  const entryCard = document.createElement("div");
  entryCard.className = "sm-cc-entry-card";

  // Add save section if it's a save-based action
  if (poisonBreathEntry.save_ability || poisonBreathEntry.save_dc) {
    const saveSection = entryCard.createDiv({ cls: "sm-cc-entry-section" });

    createSaveComponent(saveSection, {
      entry: poisonBreathEntry,
      data: statblockData,
      onUpdate: () => {
        // Trigger entry card refresh or validation
        console.log("Save component updated");
      },
      enableAutoDC: false,
    });
  }

  document.body.appendChild(entryCard);
}

/**
 * EXAMPLE 8: Dynamic Updates
 *
 * Shows how to programmatically update the component
 * and refresh the UI.
 */
export function example8_DynamicUpdates() {
  const statblockData: StatblockData = {
    name: "Test Creature",
    pb: 3,
    str: 14,
    dex: 16,
    con: 14,
    int: 10,
    wis: 12,
    cha: 10,
  } as StatblockData;

  const entry: CreatureEntry = {
    category: "action",
    name: "Dynamic Effect",
    save_ability: "DEX",
    save_dc: 13,
    text: "Initial damage",
    save_effect: "Half damage",
  };

  const container = document.createElement("div");

  const handle = createSaveComponent(container, {
    entry: entry,
    data: statblockData,
    onUpdate: () => {
      console.log("Entry updated");
    },
  });

  // Later, update the entry programmatically
  setTimeout(() => {
    entry.save_dc = 15;
    entry.text = "Updated damage: 35 (10d6) fire damage";

    // Refresh the component to reflect changes
    handle.refresh();

    console.log("Component refreshed with new values");
  }, 2000);

  document.body.appendChild(container);
}

/**
 * EXAMPLE 9: Preset Success Effects
 *
 * Demonstrates using the preset buttons for
 * quick configuration.
 */
export function example9_PresetEffects() {
  const statblockData: StatblockData = {
    name: "Fire Elemental",
    pb: 3,
    str: 10,
    dex: 17,
    con: 16,
    int: 6,
    wis: 10,
    cha: 7,
  } as StatblockData;

  const fireFormEntry: CreatureEntry = {
    category: "action",
    name: "Fire Form",
    save_ability: "DEX",
    save_dc: 13,
    text: "10 (3d6) fire damage",
    // save_effect will be set via preset buttons
  };

  const container = document.createElement("div");

  createSaveComponent(container, {
    entry: fireFormEntry,
    data: statblockData,
    onUpdate: () => {
      // The preset buttons update save_effect to one of:
      // - "Half damage"
      // - "No effect"
      // - "Takes half damage"
      // - "Takes no damage"
      console.log("Selected preset:", fireFormEntry.save_effect);
    },
  });

  document.body.appendChild(container);
}

/**
 * USAGE NOTES:
 *
 * 1. The save component integrates with the existing CreatureEntry model
 * 2. It supports both manual DC entry and auto-calculation from spell ability
 * 3. The component provides built-in validation for complete configuration
 * 4. Preset buttons make it easy to select common success effects
 * 5. The "Save at end of turn" checkbox handles recurring saves
 * 6. The component is fully responsive and supports dark mode
 * 7. All user interactions trigger the onUpdate callback
 *
 * INTEGRATION CHECKLIST:
 *
 * [ ] Import the save component functions
 * [ ] Ensure StatblockData has required fields (pb, ability scores)
 * [ ] Create or modify a CreatureEntry with save fields
 * [ ] Call createSaveComponent with appropriate options
 * [ ] Handle the onUpdate callback to persist changes
 * [ ] Use validate() to check for errors before saving
 * [ ] Use formatSaveOutput() to generate display text
 * [ ] Include save-component.css in your styles
 */
