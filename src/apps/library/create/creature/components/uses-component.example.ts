// src/apps/library/create/creature/components/uses-component.example.ts
// Example usage of the Uses component

import {
  createUsesComponentUI,
  formatUsesOutput,
  parseUsesString,
  validateUsesComponent,
  type UsesComponent,
} from "./uses-component";

/**
 * Example 1: Basic daily uses
 * Common pattern: ability usable X times per day
 */
export function example1_BasicDailyUses(container: HTMLElement) {
  const initialUses: UsesComponent = {
    type: "uses",
    count: 2,
    per: "day",
  };

  const handle = createUsesComponentUI(container, {
    uses: initialUses,
    onUpdate: (uses) => {
      console.log("Uses updated:", uses);
      if (uses) {
        console.log("Formatted output:", formatUsesOutput(uses));
      }
    },
  });

  // Output: "(2/Day)"
  console.log(formatUsesOutput(initialUses));
}

/**
 * Example 2: Short rest recharge
 * Many abilities recharge on a short rest
 */
export function example2_ShortRest(container: HTMLElement) {
  const uses: UsesComponent = {
    type: "uses",
    count: 3,
    per: "short",
  };

  const handle = createUsesComponentUI(container, {
    uses,
    onUpdate: (updated) => {
      console.log("Updated:", formatUsesOutput(updated!));
    },
  });

  // Output: "(3/Short Rest)"
  console.log(formatUsesOutput(uses));
}

/**
 * Example 3: Long rest recharge
 * Powerful abilities often recharge on long rest
 */
export function example3_LongRest(container: HTMLElement) {
  const uses: UsesComponent = {
    type: "uses",
    count: 1,
    per: "long",
  };

  const handle = createUsesComponentUI(container, {
    uses,
    onUpdate: (updated) => {
      console.log("Updated:", formatUsesOutput(updated!));
    },
  });

  // Output: "(1/Long Rest)"
  console.log(formatUsesOutput(uses));
}

/**
 * Example 4: Dawn/Dusk recharge
 * Thematic abilities that recharge at specific times
 */
export function example4_DawnDusk(container: HTMLElement) {
  const dawnUses: UsesComponent = {
    type: "uses",
    count: 1,
    per: "dawn",
  };

  const duskUses: UsesComponent = {
    type: "uses",
    count: 2,
    per: "dusk",
  };

  // Output: "(1/Dawn)"
  console.log(formatUsesOutput(dawnUses));

  // Output: "(2/Dusk)"
  console.log(formatUsesOutput(duskUses));
}

/**
 * Example 5: Custom period
 * Homebrew or unique abilities with custom reset conditions
 */
export function example5_CustomPeriod(container: HTMLElement) {
  const customUses: UsesComponent = {
    type: "uses",
    count: 3,
    per: "Per Battle",
  };

  const handle = createUsesComponentUI(container, {
    uses: customUses,
    onUpdate: (updated) => {
      console.log("Updated:", formatUsesOutput(updated!));
    },
  });

  // Output: "(3/Per Battle)"
  console.log(formatUsesOutput(customUses));
}

/**
 * Example 6: With stateful tracking
 * Track remaining uses during play
 */
export function example6_WithTracking(container: HTMLElement) {
  const uses: UsesComponent = {
    type: "uses",
    count: 3,
    per: "day",
  };

  const handle = createUsesComponentUI(container, {
    uses,
    enableTracking: true,
    onUpdate: (updated) => {
      console.log("Uses configuration updated:", updated);
    },
  });

  // Simulate using abilities
  console.log("Remaining uses:", handle.getRemainingUses!()); // 3
  handle.setRemainingUses!(2);
  console.log("After using once:", handle.getRemainingUses!()); // 2
  handle.setRemainingUses!(0);
  console.log("All used:", handle.getRemainingUses!()); // 0
  handle.setRemainingUses!(3);
  console.log("After rest:", handle.getRemainingUses!()); // 3
}

/**
 * Example 7: Compact mode
 * For inline display in tight spaces
 */
export function example7_CompactMode(container: HTMLElement) {
  const uses: UsesComponent = {
    type: "uses",
    count: 2,
    per: "day",
  };

  const handle = createUsesComponentUI(container, {
    uses,
    compact: true,
    onUpdate: (updated) => {
      console.log("Updated:", formatUsesOutput(updated!));
    },
  });
}

/**
 * Example 8: Parse from string
 * Convert existing text to UsesComponent
 */
export function example8_ParseString() {
  // Parse various formats
  const parsed1 = parseUsesString("2/Day");
  console.log(parsed1); // { type: "uses", count: 2, per: "day" }

  const parsed2 = parseUsesString("(3/Long Rest)");
  console.log(parsed2); // { type: "uses", count: 3, per: "long" }

  const parsed3 = parseUsesString("1/Dawn");
  console.log(parsed3); // { type: "uses", count: 1, per: "dawn" }

  const parsed4 = parseUsesString("5/Battle");
  console.log(parsed4); // { type: "uses", count: 5, per: "Battle" }
}

/**
 * Example 9: Validation
 * Validate uses configuration before saving
 */
export function example9_Validation() {
  const validUses: UsesComponent = {
    type: "uses",
    count: 3,
    per: "day",
  };

  const invalidUses1: UsesComponent = {
    type: "uses",
    count: 0, // Invalid! Must be at least 1
    per: "day",
  };

  const invalidUses2: UsesComponent = {
    type: "uses",
    count: 100, // Invalid! Max is 99
    per: "day",
  };

  console.log("Valid errors:", validateUsesComponent(validUses));
  // []

  console.log("Invalid (too low):", validateUsesComponent(invalidUses1));
  // ["Uses count must be between 1 and 99"]

  console.log("Invalid (too high):", validateUsesComponent(invalidUses2));
  // ["Uses count must be between 1 and 99"]
}

/**
 * Example 10: Programmatic control
 * Update uses configuration dynamically
 */
export function example10_ProgrammaticControl(container: HTMLElement) {
  const handle = createUsesComponentUI(container, {
    onUpdate: (uses) => {
      console.log("Updated:", uses);
    },
  });

  // Start disabled
  console.log("Current value:", handle.getValue()); // undefined

  // Enable with default
  handle.setValue({
    type: "uses",
    count: 2,
    per: "day",
  });

  // Later, change to different configuration
  setTimeout(() => {
    handle.setValue({
      type: "uses",
      count: 1,
      per: "long",
    });
  }, 2000);

  // Disable
  setTimeout(() => {
    handle.setValue(undefined);
  }, 4000);
}

/**
 * Example 11: Real-world ability
 * Complete example: Paladin's Lay on Hands
 */
export function example11_LayOnHands(container: HTMLElement) {
  const abilitySection = container.createDiv({ cls: "creature-ability" });

  abilitySection.createEl("h3", { text: "Lay on Hands" });

  // Lay on Hands has a pool of hit points, but we can represent uses
  const uses: UsesComponent = {
    type: "uses",
    count: 5,
    per: "long",
  };

  const usesHandle = createUsesComponentUI(abilitySection, {
    uses,
    enableTracking: true,
    onUpdate: (updated) => {
      const headerText = updated
        ? `Lay on Hands ${formatUsesOutput(updated)}`
        : "Lay on Hands";

      abilitySection.querySelector("h3")!.textContent = headerText;
    },
  });

  abilitySection.createEl("p", {
    text:
      "As an action, you can touch a creature and restore hit points to it. Alternatively, you can expend 5 hit points to cure the target of one disease or neutralize one poison.",
  });

  // Simulate usage during play
  const useAbilityBtn = abilitySection.createEl("button", {
    text: "Use Lay on Hands",
  });

  useAbilityBtn.onclick = () => {
    const remaining = usesHandle.getRemainingUses!();
    if (remaining > 0) {
      usesHandle.setRemainingUses!(remaining - 1);
      console.log("Used! Remaining:", usesHandle.getRemainingUses!());
    } else {
      console.log("No uses remaining!");
    }
  };
}

/**
 * Example 12: Innate spellcasting
 * Typical pattern for innate spellcasting abilities
 */
export function example12_InnateSpellcasting(container: HTMLElement) {
  const spellcastingSection = container.createDiv({ cls: "innate-spellcasting" });

  spellcastingSection.createEl("h3", { text: "Innate Spellcasting" });

  // At will spells (no component needed)
  spellcastingSection.createEl("p", {
    text: "At will: detect magic, light, mage hand",
  });

  // 3/day each
  const threePerDay = container.createDiv();
  const uses3: UsesComponent = {
    type: "uses",
    count: 3,
    per: "day",
  };

  threePerDay.createSpan({ text: `${formatUsesOutput(uses3)} each: ` });
  threePerDay.createSpan({
    text: "dispel magic, fly, invisibility",
    cls: "spell-list",
  });

  // 1/day each
  const onePerDay = container.createDiv();
  const uses1: UsesComponent = {
    type: "uses",
    count: 1,
    per: "day",
  };

  onePerDay.createSpan({ text: `${formatUsesOutput(uses1)} each: ` });
  onePerDay.createSpan({ text: "plane shift, teleport", cls: "spell-list" });
}

/**
 * Example 13: Integration with component system
 * Use with ComponentBasedEntry
 */
export function example13_ComponentIntegration(container: HTMLElement) {
  import("./types").then((module) => {
    const { createUsesComponent } = module;
    // Create an ability with limited uses
    const entry: any = {
      category: "action",
      name: "Frightful Presence",
      components: [
        createUsesComponent(1, "day"),
        {
          type: "effect",
          description:
            "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute.",
        },
      ],
      enabled: true,
    };

    console.log("Entry:", entry);

    // Find the uses component
    const usesComp = entry.components.find((c) => c.type === "uses") as UsesComponent;

    if (usesComp) {
      console.log("Uses:", formatUsesOutput(usesComp));
      // Output: "(1/Day)"
    }
  });
}

/**
 * Example 14: Multiple abilities with shared pool
 * Some abilities share uses from a common pool
 */
export function example14_SharedPool(container: HTMLElement) {
  // Note: The shared pool feature is defined in the type but not yet
  // implemented in the UI component. This shows the data structure.

  const sharedUses: UsesComponent = {
    type: "uses",
    count: 3,
    per: "day",
    shared: {
      poolName: "Channel Divinity",
    },
  };

  console.log("Shared pool uses:", formatUsesOutput(sharedUses));
  // Output: "(3/Day)" but conceptually shared with other abilities
}
