// src/apps/library/create/creature/components/condition-component.example.ts
// Usage examples and integration guide for the condition component

import {
  createConditionComponent,
  formatConditionString,
  conditionInstancesToString,
  parseConditionString,
  validateConditions,
} from "./condition-component";
import type { ConditionInstance } from "./condition-component";
import type { StatblockData } from "../../../core/creature-files";

/**
 * EXAMPLE 1: Basic Grapple Condition
 *
 * Creates a simple grapple condition with escape DC.
 * This is common for creatures with tentacles or constricting attacks.
 */
export function example1_BasicGrapple() {
  // Sample creature data
  const statblockData: StatblockData = {
    name: "Giant Octopus",
    pb: 2,
    str: 17,
    dex: 13,
    con: 13,
    int: 4,
    wis: 10,
    cha: 4,
  } as StatblockData;

  // Create condition instances
  const conditions: ConditionInstance[] = [
    {
      condition: "grappled",
      escape: {
        type: "dc",
        dc: 16,
      },
    },
  ];

  // Get container element
  const container = document.createElement("div");

  // Create the condition component
  const component = createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      console.log("Conditions updated:", conditions);

      // Validate conditions
      const errors = validateConditions(conditions);
      if (errors.length > 0) {
        console.error("Validation errors:", errors);
      }

      // Format output
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target has the Grappled condition (escape DC 16)"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 2: Poisoned with Save to End
 *
 * Creates a poisoned condition with duration and saving throw to end.
 * Common for poison attacks and disease effects.
 */
export function example2_PoisonedWithSave() {
  const statblockData: StatblockData = {
    name: "Giant Spider",
    pb: 2,
    str: 14,
    dex: 16,
    con: 12,
    int: 2,
    wis: 11,
    cha: 4,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "poisoned",
      duration: {
        amount: 1,
        unit: "hour",
      },
      escape: {
        type: "save",
        ability: "con",
        dc: 11,
      },
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target is Poisoned for 1 hour (DC 11 Constitution save ends)"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 3: Multiple Conditions
 *
 * Creates multiple conditions from a single attack.
 * Example: A creature that both grapples and poisons.
 */
export function example3_MultipleConditions() {
  const statblockData: StatblockData = {
    name: "Ankheg",
    pb: 2,
    str: 17,
    dex: 11,
    con: 13,
    int: 1,
    wis: 13,
    cha: 6,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "grappled",
      escape: {
        type: "dc",
        dc: 13,
      },
      notes: "while grappled, the target is also restrained",
    },
    {
      condition: "restrained",
      escape: {
        type: "dc",
        dc: 13,
      },
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target has the Grappled condition (escape DC 13) - while grappled, the target is also restrained, and has the Restrained condition (escape DC 13)"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 4: Exhaustion Levels
 *
 * Creates an exhaustion condition with level tracking.
 * Used for long-term debuffs and environmental hazards.
 */
export function example4_ExhaustionLevels() {
  const statblockData: StatblockData = {
    name: "Shadow",
    pb: 2,
    str: 6,
    dex: 14,
    con: 13,
    int: 6,
    wis: 10,
    cha: 8,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "exhaustion",
      exhaustionLevel: 1,
      duration: {
        amount: 0,
        unit: "permanent",
      },
      notes: "removed by magic such as lesser restoration",
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target suffers one level of Exhaustion permanently - removed by magic such as lesser restoration"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 5: Prone Condition
 *
 * Simple condition that costs action/movement to remove.
 * Common for trip attacks and knockdown effects.
 */
export function example5_ProneCondition() {
  const statblockData: StatblockData = {
    name: "Wolf",
    pb: 2,
    str: 12,
    dex: 15,
    con: 12,
    int: 3,
    wis: 12,
    cha: 6,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "prone",
      escape: {
        type: "action",
        description: "costs half movement to stand up",
      },
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target has the Prone condition (costs half movement to stand up)"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 6: Temporary Condition with Custom Duration
 *
 * Creates a short-duration condition common in combat.
 * Example: Stunned until end of next turn.
 */
export function example6_TemporaryCondition() {
  const statblockData: StatblockData = {
    name: "Medusa",
    pb: 3,
    str: 10,
    dex: 15,
    con: 16,
    int: 12,
    wis: 13,
    cha: 15,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "stunned",
      duration: {
        amount: 1,
        unit: "round",
        text: "until the end of the medusa's next turn",
      },
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target has the Stunned condition for until the end of the medusa's next turn"
    },
  });

  document.body.appendChild(container);
}

/**
 * EXAMPLE 7: Parsing Existing Condition Text
 *
 * Demonstrates backwards compatibility by parsing legacy condition strings.
 */
export function example7_ParsingConditions() {
  // Legacy condition strings from existing entries
  const legacyConditions = [
    "target is Grappled (escape DC 14)",
    "target is Poisoned for 1 minute (DC 15 Constitution save ends)",
    "target has the Prone condition",
  ];

  legacyConditions.forEach((legacyStr) => {
    const parsed = parseConditionString(legacyStr);
    console.log("Legacy:", legacyStr);
    console.log("Parsed:", parsed);

    // Re-format to ensure consistency
    const reformatted = conditionInstancesToString(parsed);
    console.log("Reformatted:", reformatted);
    console.log("---");
  });
}

/**
 * EXAMPLE 8: Validation and Error Handling
 *
 * Shows how to validate conditions and handle common errors.
 */
export function example8_ValidationAndErrors() {
  // Invalid condition: missing DC for escape
  const invalidConditions: ConditionInstance[] = [
    {
      condition: "grappled",
      escape: {
        type: "dc",
        // Missing DC!
      },
    },
  ];

  const errors = validateConditions(invalidConditions);
  console.log("Validation errors:", errors);
  // Output: ["Condition 1: Escape DC is required for DC-based escape"]

  // Valid condition after fix
  invalidConditions[0].escape!.dc = 14;
  const errorsAfterFix = validateConditions(invalidConditions);
  console.log("Validation errors after fix:", errorsAfterFix);
  // Output: []
}

/**
 * EXAMPLE 9: Integration with Entry System
 *
 * Shows how to use conditions as part of a complete creature entry.
 */
export function example9_EntryIntegration() {
  const statblockData: StatblockData = {
    name: "Roper",
    pb: 3,
    str: 18,
    dex: 8,
    con: 17,
    int: 7,
    wis: 16,
    cha: 6,
  } as StatblockData;

  // Define conditions for a Roper's tentacle attack
  const conditions: ConditionInstance[] = [
    {
      condition: "grappled",
      escape: {
        type: "dc",
        dc: 15,
      },
      notes: "the grappled creature is pulled up to 25 feet toward the roper",
    },
  ];

  // This would be part of a larger entry with attack, damage, etc.
  const entryText = [
    "Melee Weapon Attack: +7 to hit, reach 50 ft., one creature.",
    "Hit: The target is grappled (escape DC 15).",
    conditionInstancesToString(conditions),
    "Until the grapple ends, the target is restrained and has disadvantage on Strength checks and Strength saving throws.",
  ].join(" ");

  console.log("Complete entry text:", entryText);
}

/**
 * EXAMPLE 10: Complex Condition with All Features
 *
 * Demonstrates using all available features of the condition component.
 */
export function example10_ComplexCondition() {
  const statblockData: StatblockData = {
    name: "Aboleth",
    pb: 5,
    str: 21,
    dex: 9,
    con: 15,
    int: 18,
    wis: 15,
    cha: 18,
  } as StatblockData;

  const conditions: ConditionInstance[] = [
    {
      condition: "poisoned",
      duration: {
        amount: 24,
        unit: "hour",
      },
      escape: {
        type: "save",
        ability: "con",
        dc: 14,
      },
      notes: "The poisoned target can breathe only underwater and must be submerged within 1 minute or begin suffocating. The disease can be removed by lesser restoration.",
    },
  ];

  const container = document.createElement("div");

  createConditionComponent(container, {
    conditions,
    data: statblockData,
    maxConditions: 2, // Limit to 2 conditions
    onChange: () => {
      const formatted = conditionInstancesToString(conditions);
      console.log("Formatted output:", formatted);
      // Output: "target is Poisoned for 24 hours (DC 14 Constitution save ends) - The poisoned target can breathe only underwater and must be submerged within 1 minute or begin suffocating. The disease can be removed by lesser restoration."

      // Validate
      const errors = validateConditions(conditions);
      if (errors.length === 0) {
        console.log("All conditions valid!");
      }
    },
  });

  document.body.appendChild(container);
}

// Export all examples for easy testing
export const examples = {
  example1_BasicGrapple,
  example2_PoisonedWithSave,
  example3_MultipleConditions,
  example4_ExhaustionLevels,
  example5_ProneCondition,
  example6_TemporaryCondition,
  example7_ParsingConditions,
  example8_ValidationAndErrors,
  example9_EntryIntegration,
  example10_ComplexCondition,
};
