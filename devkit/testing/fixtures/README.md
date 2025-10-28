# Test Fixtures

Reusable test data for Salt Marcher plugin testing.

## Purpose

Test fixtures eliminate repetitive test data creation and ensure consistency across tests. Instead of manually creating test objects in every test file, import pre-built fixtures with known, predictable data.

## Available Fixtures

### Creatures (`creatures.ts`)

- **minimal** - Bare minimum creature (Test Goblin, CR 0.25)
- **simple** - Basic combat creature (Test Orc, CR 0.5)
- **complex** - Full-featured creature with saves, skills, spellcasting (Test Dragon, CR 17)
- **withTokens** - Creature with populated token fields (Test Wizard, CR 6)
- **withSaves** - Creature with save proficiencies (Test Fighter, CR 5)

### Spells (`spells.ts`)

- **minimal** - Simple cantrip (Test Cantrip)
- **simple** - Basic spell (Test Magic Missile, level 1)
- **complex** - Full spell with all features (Test Fireball, level 3)
- **ritual** - Ritual spell (Test Detect Magic)
- **concentration** - Concentration spell (Test Haste)
- **material** - Spell with material cost (Test Revivify, 300 gp)
- **scalingCantrip** - Cantrip with scaling (Test Eldritch Blast)

### Items (`items.ts`)

- **minimal** - Simple item (Test Potion)
- **simple** - Basic magic item (Test +1 Sword)
- **complex** - Item with charges and spells (Test Wand of Fireballs)
- **consumable** - Consumable item (Test Potion of Healing)
- **wondrous** - Wondrous item (Test Bag of Holding)
- **artifact** - Legendary artifact (Test Vorpal Sword)
- **cursed** - Cursed item (Test Berserker Axe)

### Equipment (`equipment.ts`)

- **minimal** - Basic equipment (Test Club)
- **simpleWeapon** - Simple melee weapon (Test Longsword)
- **rangedWeapon** - Ranged weapon with range (Test Longbow)
- **lightArmor** - Light armor (Test Leather Armor)
- **heavyArmor** - Heavy armor with requirements (Test Plate Armor)
- **shield** - Shield (Test Shield)
- **tool** - Tool (Test Thieves' Tools)
- **adventuringGear** - General gear (Test Rope)
- **complexWeapon** - Weapon with multiple properties (Test Hand Crossbow)
- **mount** - Mount (Test Warhorse)
- **vehicle** - Vehicle (Test Rowboat)

## Usage

### Import All Fixtures

```typescript
import { creatures, spells, items, equipment } from 'devkit/testing/fixtures';

test('should create creature', () => {
  const creature = creatures.minimal;
  expect(creature.name).toBe("Test Goblin");
});
```

### Import Specific Fixtures

```typescript
import { minimalCreature, complexCreature } from 'devkit/testing/fixtures/creatures';

test('should handle different creature complexities', () => {
  const simple = minimalCreature;
  const complex = complexCreature;

  expect(simple.cr).toBe(0.25);
  expect(complex.cr).toBe(17);
});
```

### Import Consolidated Objects

```typescript
import { creatures } from 'devkit/testing/fixtures';

describe('Creature Tests', () => {
  test('minimal creature', () => {
    const creature = creatures.minimal;
    expect(creature.name).toBe("Test Goblin");
  });

  test('complex creature', () => {
    const creature = creatures.complex;
    expect(creature.spellcasting).toBeDefined();
  });
});
```

## Design Principles

1. **Predictable** - Fixture data never changes, making tests stable
2. **Comprehensive** - Cover common testing scenarios (minimal, simple, complex)
3. **Realistic** - Use D&D 5e-accurate data where applicable
4. **Documented** - Each fixture has a descriptive comment
5. **Typed** - All fixtures are TypeScript objects for type safety

## Adding New Fixtures

When adding new fixtures:

1. **Choose the right file** - Add to existing file or create new one
2. **Export individually** - `export const myFixture = { ... }`
3. **Export in group** - Add to consolidated export object
4. **Document** - Add JSDoc comment describing the fixture
5. **Update index** - Add to `index.ts` if creating new file
6. **Update this README** - Add to the list above

### Example

```typescript
// devkit/testing/fixtures/creatures.ts

/**
 * Creature with legendary actions
 */
export const legendaryCreature = {
  name: "Test Ancient Dragon",
  cr: 24,
  // ... other fields
  entries: [
    { type: "legendary", name: "Tail Attack", description: "..." },
  ],
};

export const creatures = {
  // ... existing fixtures
  legendary: legendaryCreature,
};
```

## Integration with Tests

### Unit Tests

Use fixtures in Vitest unit tests:

```typescript
import { describe, test, expect } from 'vitest';
import { creatures } from 'devkit/testing/fixtures';
import { calculateCR } from 'src/somewhere';

describe('CR Calculator', () => {
  test('should calculate CR for minimal creature', () => {
    const result = calculateCR(creatures.minimal);
    expect(result).toBe(0.25);
  });
});
```

### Integration Tests

Reference fixtures in YAML tests:

```yaml
name: "Test creature creation"
steps:
  - name: "Create creature"
    command: create-creature
    args: ["fixtures.creatures.minimal"]
```

### UI Tests

Use fixtures with DevKit CLI:

```bash
# Create test creature from fixture
./devkit-cli ui open creature --fixture minimal

# Validate UI with complex fixture
./devkit-cli ui validate --entity creature --fixture complex
```

## Best Practices

1. **Don't mutate fixtures** - Always clone if you need to modify:
   ```typescript
   const creature = { ...creatures.minimal, hp: 20 };
   ```

2. **Use appropriate fixture** - Choose the simplest fixture that tests your scenario:
   - Testing basic field? Use `minimal`
   - Testing complex interactions? Use `complex`
   - Testing specific feature? Use fixture with that feature

3. **Avoid fixture bloat** - Don't create fixtures for one-off scenarios, just create the object inline

4. **Keep fixtures realistic** - Use valid D&D 5e data when possible

## Maintenance

- **Review regularly** - Remove unused fixtures
- **Update when schema changes** - Keep fixtures aligned with CreateSpecs
- **Test fixtures themselves** - Ensure fixtures are valid against current schemas
