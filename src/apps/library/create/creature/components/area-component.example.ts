// src/apps/library/create/creature/components/area-component.example.ts
// Usage examples for the Area component

import {
  createAreaComponent,
  formatAreaString,
  formatOriginString,
  validateAreaSize,
  toAreaComponentType,
  fromAreaComponentType,
  type AreaInstance,
} from "./area-component";

/**
 * Example 1: Basic cone area (dragon breath weapon)
 */
export function exampleCone(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cone",
    size: 60,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area updated:", formatAreaString(area));
      // Output: "60-foot cone"
    },
  });

  // Validate the area
  const errors = handle.validate();
  if (errors.length === 0) {
    console.log("Valid area configuration");
  }

  // Get current area state
  const currentArea = handle.getArea();
  console.log("Current area:", currentArea);
}

/**
 * Example 2: Sphere area (fireball)
 */
export function exampleSphere(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "sphere",
    size: 20,
    unit: "feet",
    origin: "point",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      console.log("Origin:", formatOriginString(area));
      // Output: "20-foot radius sphere"
      // Output: "Originates from a point within range"
    },
  });
}

/**
 * Example 3: Line area (lightning bolt)
 */
export function exampleLine(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "line",
    size: 100,
    secondarySize: 5,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      // Output: "100-foot line that is 5 feet wide"
    },
  });
}

/**
 * Example 4: Cylinder area (flame strike)
 */
export function exampleCylinder(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cylinder",
    size: 10,
    secondarySize: 40,
    unit: "feet",
    origin: "point",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      // Output: "10-foot radius, 40-foot high cylinder"
    },
  });
}

/**
 * Example 5: Cube area (wall of force)
 */
export function exampleCube(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cube",
    size: 10,
    unit: "feet",
    origin: "point",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      // Output: "10-foot cube"
    },
  });
}

/**
 * Example 6: Emanation area (paladin aura)
 */
export function exampleEmanation(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "emanation",
    size: 10,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      // Output: "10-foot emanation"
    },
  });
}

/**
 * Example 7: Custom origin
 */
export function exampleCustomOrigin(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "sphere",
    size: 20,
    unit: "feet",
    origin: "custom",
    notes: "a point you can see within 120 feet",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      console.log("Origin:", formatOriginString(area));
      // Output: "20-foot radius sphere"
      // Output: "a point you can see within 120 feet"
    },
  });
}

/**
 * Example 8: Using meters instead of feet
 */
export function exampleMeters(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cone",
    size: 18,
    unit: "meters",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Area:", formatAreaString(area));
      // Output: "18-meter cone"
    },
  });
}

/**
 * Example 9: Integrating with creature entry system
 */
export function exampleCreatureEntry(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cone",
    size: 30,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      // Convert to AreaComponent type for storage
      const areaComponent = toAreaComponentType(area);
      console.log("Component for storage:", areaComponent);
      // Output: {
      //   type: "area",
      //   shape: "cone",
      //   size: "30",
      //   origin: "Originates from self"
      // }
    },
  });
}

/**
 * Example 10: Loading from stored data
 */
export function exampleLoadFromStorage(): void {
  const container = document.createElement("div");

  // Simulate loading from storage
  const storedComponent = {
    type: "area" as const,
    shape: "line" as const,
    size: "60 × 5",
    origin: "Originates from self",
  };

  // Convert back to AreaInstance
  const area = fromAreaComponentType(storedComponent);

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Loaded area:", formatAreaString(area));
      // Output: "60-foot line that is 5 feet wide"
    },
  });
}

/**
 * Example 11: Validation example
 */
export function exampleValidation(): void {
  console.log("Valid size:", validateAreaSize(20)); // true
  console.log("Valid size string:", validateAreaSize("15")); // true
  console.log("Invalid size:", validateAreaSize(-5)); // false
  console.log("Invalid size:", validateAreaSize("abc")); // false
  console.log("Invalid size:", validateAreaSize("")); // false
}

/**
 * Example 12: Complete dragon breath weapon entry
 */
export function exampleDragonBreathWeapon(): void {
  const container = document.createElement("div");

  // Fire Breath (Recharge 5-6)
  const area: AreaInstance = {
    shape: "cone",
    size: 60,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      const areaStr = formatAreaString(area);
      const originStr = formatOriginString(area);

      // Complete description output
      const description = `
The dragon exhales fire in a ${areaStr}. ${originStr}.
Each creature in that area must make a DC 19 Dexterity saving throw,
taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.
      `.trim();

      console.log(description);
    },
  });
}

/**
 * Example 13: Spell with multiple area options
 */
export function exampleMultipleAreaOptions(): void {
  const container = document.createElement("div");

  // Gust of Wind - line area
  const gustOfWind: AreaInstance = {
    shape: "line",
    size: 60,
    secondarySize: 10,
    unit: "feet",
    origin: "self",
  };

  // Burning Hands - cone area
  const burningHands: AreaInstance = {
    shape: "cone",
    size: 15,
    unit: "feet",
    origin: "self",
  };

  // Spirit Guardians - emanation area
  const spiritGuardians: AreaInstance = {
    shape: "emanation",
    size: 15,
    unit: "feet",
    origin: "self",
  };

  // Create components for each
  [gustOfWind, burningHands, spiritGuardians].forEach((area, index) => {
    const handle = createAreaComponent(container, {
      area,
      onChange: () => {
        console.log(`Spell ${index + 1}:`, formatAreaString(area));
      },
    });
  });
}

/**
 * Example 14: Disabling unit selector (for consistent formatting)
 */
export function exampleNoUnitSelector(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "sphere",
    size: 20,
    unit: "feet",
    origin: "point",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => console.log("Area updated"),
    showUnitSelector: false, // Hide unit selector
  });
}

/**
 * Example 15: Disabling preview (for compact UI)
 */
export function exampleNoPreview(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cone",
    size: 30,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => console.log("Area updated"),
    showPreview: false, // Hide ASCII preview
  });
}

/**
 * Example 16: Programmatic area updates
 */
export function exampleProgrammaticUpdate(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "sphere",
    size: 10,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => console.log("Area changed:", formatAreaString(area)),
  });

  // Simulate programmatic changes (e.g., from spell level scaling)
  setTimeout(() => {
    area.size = 20; // Increase radius
    handle.refresh(); // Update UI
    console.log("Area scaled up:", formatAreaString(area));
    // Output: "20-foot radius sphere"
  }, 2000);
}

/**
 * Example 17: Real-world creature ability - Ancient Red Dragon Breath
 */
export function exampleAncientRedDragonBreath(): void {
  const container = document.createElement("div");

  const area: AreaInstance = {
    shape: "cone",
    size: 90,
    unit: "feet",
    origin: "self",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      const formatted = formatAreaString(area);
      console.log(`Fire Breath (Recharge 5-6). The dragon exhales fire in a ${formatted}.`);
      // Output: "Fire Breath (Recharge 5-6). The dragon exhales fire in a 90-foot cone."
    },
  });
}

/**
 * Example 18: Real-world spell - Wall of Fire
 */
export function exampleWallOfFire(): void {
  const container = document.createElement("div");

  // Wall of Fire can be a line
  const area: AreaInstance = {
    shape: "line",
    size: 60,
    secondarySize: 10, // 10 feet high
    unit: "feet",
    origin: "point",
  };

  const handle = createAreaComponent(container, {
    area,
    onChange: () => {
      console.log("Wall dimensions:", formatAreaString(area));
      // Output: "60-foot line that is 10 feet wide"
      // (In this case, secondary dimension represents height)
    },
  });
}

/**
 * Run all examples (for testing)
 */
export function runAllExamples(): void {
  console.log("=== Running Area Component Examples ===\n");

  console.log("Example 1: Cone");
  exampleCone();

  console.log("\nExample 2: Sphere");
  exampleSphere();

  console.log("\nExample 3: Line");
  exampleLine();

  console.log("\nExample 4: Cylinder");
  exampleCylinder();

  console.log("\nExample 5: Cube");
  exampleCube();

  console.log("\nExample 6: Emanation");
  exampleEmanation();

  console.log("\nExample 7: Custom Origin");
  exampleCustomOrigin();

  console.log("\nExample 8: Meters");
  exampleMeters();

  console.log("\nExample 11: Validation");
  exampleValidation();

  console.log("\nExample 12: Dragon Breath Weapon");
  exampleDragonBreathWeapon();

  console.log("\n=== All examples completed ===");
}
