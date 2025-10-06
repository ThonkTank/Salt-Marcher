// src/apps/library/create/creature/components/recharge-component.example.ts
// Example usage of the Recharge component

import {
  createRechargeComponentUI,
  formatRechargeOutput,
  parseRechargeString,
  validateRechargeComponent,
  type RechargeComponent,
} from "./recharge-component";

/**
 * Example 1: Basic recharge component
 * Creates a standard "Recharge 5-6" mechanic
 */
export function example1_BasicRecharge(container: HTMLElement) {
  const initialRecharge: RechargeComponent = {
    type: "recharge",
    min: 5,
    max: 6,
  };

  const handle = createRechargeComponentUI(container, {
    recharge: initialRecharge,
    onUpdate: (recharge) => {
      console.log("Recharge updated:", recharge);
      if (recharge) {
        console.log("Formatted output:", formatRechargeOutput(recharge));
      }
    },
  });

  // Output: "(Recharge 5-6)"
  console.log(formatRechargeOutput(initialRecharge));
}

/**
 * Example 2: Single number recharge
 * Dragon breath weapons often recharge on a 6
 */
export function example2_SingleNumberRecharge(container: HTMLElement) {
  const recharge: RechargeComponent = {
    type: "recharge",
    min: 6,
    max: 6,
  };

  const handle = createRechargeComponentUI(container, {
    recharge,
    onUpdate: (updated) => {
      console.log("Updated:", formatRechargeOutput(updated!));
    },
  });

  // Output: "(Recharge 6)"
  console.log(formatRechargeOutput(recharge));
}

/**
 * Example 3: Recharge with timing
 * Some abilities specify when the recharge roll occurs
 */
export function example3_RechargeWithTiming(container: HTMLElement) {
  const recharge: RechargeComponent = {
    type: "recharge",
    min: 5,
    max: 6,
    timing: "start of turn",
  };

  const handle = createRechargeComponentUI(container, {
    recharge,
    onUpdate: (updated) => {
      console.log("Updated:", formatRechargeOutput(updated!));
    },
  });

  // Output: "(Recharge 5-6 at start of turn)"
  console.log(formatRechargeOutput(recharge));
}

/**
 * Example 4: Custom range
 * Homebrew abilities might use non-standard ranges
 */
export function example4_CustomRange(container: HTMLElement) {
  const recharge: RechargeComponent = {
    type: "recharge",
    min: 3,
    max: 6,
  };

  const handle = createRechargeComponentUI(container, {
    recharge,
    onUpdate: (updated) => {
      console.log("Updated:", formatRechargeOutput(updated!));
    },
  });

  // Output: "(Recharge 3-6)"
  console.log(formatRechargeOutput(recharge));
}

/**
 * Example 5: Compact mode
 * For inline display in tight spaces
 */
export function example5_CompactMode(container: HTMLElement) {
  const recharge: RechargeComponent = {
    type: "recharge",
    min: 5,
    max: 6,
  };

  const handle = createRechargeComponentUI(container, {
    recharge,
    compact: true,
    onUpdate: (updated) => {
      console.log("Updated:", formatRechargeOutput(updated!));
    },
  });
}

/**
 * Example 6: Parse from string
 * Convert existing text to RechargeComponent
 */
export function example6_ParseString() {
  // Parse various formats
  const parsed1 = parseRechargeString("Recharge 5-6");
  console.log(parsed1); // { type: "recharge", min: 5, max: 6 }

  const parsed2 = parseRechargeString("(Recharge 6)");
  console.log(parsed2); // { type: "recharge", min: 6, max: 6 }

  const parsed3 = parseRechargeString("Recharge 4-6 at start of turn");
  console.log(parsed3); // { type: "recharge", min: 4, max: 6, timing: "start of turn" }
}

/**
 * Example 7: Validation
 * Validate recharge configuration before saving
 */
export function example7_Validation() {
  const validRecharge: RechargeComponent = {
    type: "recharge",
    min: 5,
    max: 6,
  };

  const invalidRecharge: RechargeComponent = {
    type: "recharge",
    min: 7, // Invalid! Must be 1-6
    max: 6,
  };

  console.log("Valid errors:", validateRechargeComponent(validRecharge));
  // []

  console.log("Invalid errors:", validateRechargeComponent(invalidRecharge));
  // ["Recharge minimum must be between 1 and 6"]
}

/**
 * Example 8: Programmatic control
 * Update recharge configuration dynamically
 */
export function example8_ProgrammaticControl(container: HTMLElement) {
  const handle = createRechargeComponentUI(container, {
    onUpdate: (recharge) => {
      console.log("Updated:", recharge);
    },
  });

  // Start disabled
  console.log("Current value:", handle.getValue()); // undefined

  // Enable with preset
  handle.setValue({
    type: "recharge",
    min: 5,
    max: 6,
  });

  // Later, change to different preset
  setTimeout(() => {
    handle.setValue({
      type: "recharge",
      min: 6,
      max: 6,
      timing: "end of turn",
    });
  }, 2000);

  // Disable
  setTimeout(() => {
    handle.setValue(undefined);
  }, 4000);
}

/**
 * Example 9: Real-world ability
 * Complete example: Ancient Red Dragon breath weapon
 */
export function example9_DragonBreathWeapon(container: HTMLElement) {
  const abilitySection = container.createDiv({ cls: "creature-ability" });

  abilitySection.createEl("h3", { text: "Fire Breath" });

  const recharge: RechargeComponent = {
    type: "recharge",
    min: 5,
    max: 6,
  };

  const rechargeHandle = createRechargeComponentUI(abilitySection, {
    recharge,
    onUpdate: (updated) => {
      // Update ability header with recharge text
      const headerText = updated
        ? `Fire Breath ${formatRechargeOutput(updated)}`
        : "Fire Breath";

      abilitySection.querySelector("h3")!.textContent = headerText;
    },
  });

  abilitySection.createEl("p", {
    text:
      "The dragon exhales fire in a 90-foot cone. Each creature in that area must make a DC 24 Dexterity saving throw, taking 91 (26d6) fire damage on a failed save, or half as much damage on a successful one.",
  });

  // Header now shows: "Fire Breath (Recharge 5-6)"
}

/**
 * Example 10: Integration with component system
 * Use with ComponentBasedEntry
 */
export function example10_ComponentIntegration(container: HTMLElement) {
  import("./types").then(({ createBreathWeaponEntry }) => {
    // Create a breath weapon entry with recharge
    const breathWeapon = createBreathWeaponEntry(
      "Fire Breath",
      "cone",
      "60",
      "dex",
      18,
      "10d6",
      "fire"
    );

    console.log("Breath weapon entry:", breathWeapon);
    console.log("Components:", breathWeapon.components);

    // Find the recharge component
    const rechargeComp = breathWeapon.components.find(
      (c) => c.type === "recharge"
    ) as RechargeComponent;

    if (rechargeComp) {
      console.log("Recharge:", formatRechargeOutput(rechargeComp));
      // Output: "(Recharge 5-6)"
    }
  });
}
