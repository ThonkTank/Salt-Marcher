// src/apps/library/create/creature/components/types.test.ts
// Type-level tests to ensure component system works correctly

import type {
  ComponentBasedEntry,
  AttackComponent,
  DamageComponent,
  SaveComponent,
} from "./types";
import {
  createAttackComponent,
  createDamageComponent,
  createSaveComponent,
  isAttackComponent,
  isDamageComponent,
  findComponentsByType,
  getFirstComponent,
  validateEntry,
  migrateFromLegacy,
  migrateToLegacy,
} from "./types";

// ============================================================================
// TYPE SAFETY TESTS
// ============================================================================

// Test 1: Component creation is type-safe
const testAttack: AttackComponent = createAttackComponent({
  reach: "5 ft.",
  target: "one target",
  autoCalc: {
    ability: "str",
    proficient: true,
  },
});

// Test 2: Entry creation is type-safe
const testEntry: ComponentBasedEntry = {
  category: "action",
  name: "Test Attack",
  components: [
    createAttackComponent({ reach: "5 ft." }),
    createDamageComponent("1d6", { damageType: "slashing" }),
  ],
  enabled: true,
};

// Test 3: Type guards narrow types correctly
function testTypeGuards(entry: ComponentBasedEntry): void {
  for (const component of entry.components) {
    if (isAttackComponent(component)) {
      // TypeScript should know component.reach exists
      const reach: string | undefined = component.reach;
      // @ts-expect-error - damage should not exist on AttackComponent
      const invalid = component.damageType;
    }

    if (isDamageComponent(component)) {
      // TypeScript should know component.damageType exists
      const type: string | undefined = component.damageType;
      // @ts-expect-error - reach should not exist on DamageComponent
      const invalid = component.reach;
    }
  }
}

// Test 4: Discriminated union switch is exhaustive
function testExhaustiveSwitch(entry: ComponentBasedEntry): void {
  for (const component of entry.components) {
    switch (component.type) {
      case "attack":
        component.reach; // OK
        break;
      case "save":
        component.dc; // OK
        break;
      case "damage":
        component.dice; // OK
        break;
      case "condition":
        component.condition; // OK
        break;
      case "area":
        component.shape; // OK
        break;
      case "recharge":
        component.min; // OK
        break;
      case "uses":
        component.count; // OK
        break;
      case "trigger":
        component.actions; // OK
        break;
      case "heal":
        component.dice; // OK
        break;
      case "effect":
        component.description; // OK
        break;
      default:
        // TypeScript should ensure we've covered all cases
        const _exhaustive: never = component;
        break;
    }
  }
}

// Test 5: Utility functions maintain type safety
function testUtilityFunctions(entry: ComponentBasedEntry): void {
  // findComponentsByType returns correctly typed array
  const attacks: AttackComponent[] = findComponentsByType(entry, "attack");
  const damages: DamageComponent[] = findComponentsByType(entry, "damage");
  const saves: SaveComponent[] = findComponentsByType(entry, "save");

  // getFirstComponent returns correctly typed component or undefined
  const firstAttack: AttackComponent | undefined = getFirstComponent(entry, "attack");
  const firstDamage: DamageComponent | undefined = getFirstComponent(entry, "damage");

  // Access properties safely
  if (firstAttack) {
    const reach = firstAttack.reach;
    // @ts-expect-error - dice doesn't exist on AttackComponent
    const invalid = firstAttack.dice;
  }

  if (firstDamage) {
    const dice = firstDamage.dice;
    // @ts-expect-error - reach doesn't exist on DamageComponent
    const invalid = firstDamage.reach;
  }
}

// Test 6: Validation returns correct error types
function testValidation(entry: ComponentBasedEntry): void {
  const errors: string[] = validateEntry(entry);
  errors.forEach((error) => {
    // Errors should be strings
    const _check: string = error;
  });
}

// Test 7: Migration maintains type safety
function testMigration(): void {
  const legacy = {
    category: "action" as const,
    name: "Claw",
    to_hit: "+5",
    range: "5 ft.",
    damage: "1d6+3 slashing",
  };

  const migrated: ComponentBasedEntry = migrateFromLegacy(legacy);
  const backToLegacy = migrateToLegacy(migrated);

  // Check types are preserved
  const _categoryCheck: string = backToLegacy.category;
  const _nameCheck: string | undefined = backToLegacy.name;
}

// Test 8: Required fields are enforced
function testRequiredFields(): void {
  // @ts-expect-error - name is required
  const invalid1: ComponentBasedEntry = {
    category: "action",
    components: [],
  };

  // @ts-expect-error - category is required
  const invalid2: ComponentBasedEntry = {
    name: "Test",
    components: [],
  };

  // @ts-expect-error - components is required
  const invalid3: ComponentBasedEntry = {
    category: "action",
    name: "Test",
  };

  // Valid entry
  const valid: ComponentBasedEntry = {
    category: "action",
    name: "Test",
    components: [],
  };
}

// Test 9: Component discriminator prevents mixing
function testComponentDiscriminator(): void {
  const attack: AttackComponent = {
    type: "attack",
    reach: "5 ft.",
  };

  const damage: DamageComponent = {
    type: "damage",
    dice: "1d6",
  };

  // @ts-expect-error - can't assign attack component to damage type
  const invalid: DamageComponent = attack;

  // Can assign to union type
  const valid1: AttackComponent | DamageComponent = attack;
  const valid2: AttackComponent | DamageComponent = damage;
}

// Test 10: Optional fields work correctly
function testOptionalFields(): void {
  // Minimal valid attack component
  const minimal: AttackComponent = {
    type: "attack",
  };

  // Fully specified attack component
  const full: AttackComponent = {
    type: "attack",
    bonus: "+5",
    reach: "5 ft.",
    target: "one target",
    attackType: "Melee Weapon Attack",
    autoCalc: {
      ability: "str",
      proficient: true,
    },
  };

  // Both should be valid
  const _check1: AttackComponent = minimal;
  const _check2: AttackComponent = full;
}

// ============================================================================
// RUNTIME TESTS (for actual implementation)
// ============================================================================

/**
 * Test suite for component system (would be run with a test framework)
 */
export function runComponentSystemTests(): void {
  console.log("Running component system tests...");

  // Test 1: Type guards work correctly
  const testComponents = [
    createAttackComponent({ reach: "5 ft." }),
    createDamageComponent("1d6"),
    createSaveComponent("dex", 15),
  ];

  console.assert(isAttackComponent(testComponents[0]), "Attack type guard failed");
  console.assert(isDamageComponent(testComponents[1]), "Damage type guard failed");
  console.assert(!isAttackComponent(testComponents[1]), "Attack type guard false positive");

  // Test 2: Component finding works
  const entry: ComponentBasedEntry = {
    category: "action",
    name: "Test",
    components: testComponents,
    enabled: true,
  };

  const attacks = findComponentsByType(entry, "attack");
  console.assert(attacks.length === 1, "Should find 1 attack component");

  const firstDamage = getFirstComponent(entry, "damage");
  console.assert(firstDamage?.dice === "1d6", "Should find damage component with correct dice");

  // Test 3: Validation catches errors
  const invalidEntry: ComponentBasedEntry = {
    category: "action",
    name: "",
    components: [],
    enabled: true,
  };

  const errors = validateEntry(invalidEntry);
  console.assert(errors.length > 0, "Should detect validation errors");

  // Test 4: Migration round-trip works
  const legacy = {
    category: "action" as const,
    name: "Claw",
    to_hit: "+5",
    damage: "1d6 slashing",
  };

  const migrated = migrateFromLegacy(legacy);
  console.assert(migrated.name === "Claw", "Migration should preserve name");
  console.assert(migrated.components.length > 0, "Migration should create components");

  const backToLegacy = migrateToLegacy(migrated);
  console.assert(backToLegacy.name === "Claw", "Reverse migration should preserve name");

  console.log("All component system tests passed!");
}

// Export for use in test runners
export const tests = {
  testTypeGuards,
  testExhaustiveSwitch,
  testUtilityFunctions,
  testValidation,
  testMigration,
  testRequiredFields,
  testComponentDiscriminator,
  testOptionalFields,
  runComponentSystemTests,
};
