# Constants & Utils

> **Verantwortlichkeit:** D&D-Regeln, Lookup-Tabellen und Pure Utility Functions
> **Pfade:** `src/constants/`, `src/utils/`
>
> **Single Source of Truth:** Konstanten werden in [docs/constants/](../constants/) spezifiziert

---

## Übersicht

Zwei Verzeichnisse für kontextunabhängige Daten und Logik:

| Verzeichnis | Inhalt |
|-------------|--------|
| `src/constants/` | Unveränderliche Werte, Lookup-Tabellen, Enums |
| `src/utils/` | Pure Functions ohne Side Effects |

**Kontextunabhängig bedeutet:** Die Werte und Logik ändern sich nicht basierend auf Feature-State oder User-Kontext. D&D 5e XP-Tabellen, Reisegeschwindigkeiten, CR-Berechnungen sind immer gleich.

---

## Constants (`src/constants/`)

### Import-Pattern

```typescript
// Index-Import (bevorzugt)
import type { FactionStatus, CreatureSize, TimeSegment } from '@/constants';

// Direkter Import
import { FACTION_STATUSES, type FactionStatus } from '@/constants/faction';
```

### Struktur

```
src/constants/
├── index.ts          # Re-exports aller Konstanten
├── creature.ts       # CREATURE_SIZES, DISPOSITIONS, DESIGN_ROLES, NOISE_LEVELS, SCENT_STRENGTHS, STEALTH_ABILITIES
├── encounter.ts      # ENCOUNTER_TRIGGERS, NARRATIVE_ROLES, DIFFICULTY_LABELS
├── encounterConfig.ts  # Encounter-Konfiguration (Chancen, Modifikatoren)
├── faction.ts        # FACTION_STATUSES
├── npc.ts            # NPC_STATUSES
├── terrain.ts        # MAP_TYPES, WIND_EXPOSURES, ENVIRONMENTAL_POOL_TYPES, WEATHER_CATEGORIES
└── time.ts           # TIME_SEGMENTS
```

### Pattern: Konstante + Type-Derivation

Konstanten werden als `as const` Array definiert. Der zugehörige Type wird direkt daneben abgeleitet:

```typescript
// src/constants/creature.ts
export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type CreatureSize = typeof CREATURE_SIZES[number];

export const DISPOSITIONS = ['hostile', 'neutral', 'friendly'] as const;
export type Disposition = typeof DISPOSITIONS[number];
```

### Verwendung in Zod-Schemas

Zod-Schemas importieren die Konstante und nutzen `z.enum()`:

```typescript
// src/types/entities/creature.ts
import { z } from 'zod';
import { CREATURE_SIZES, DISPOSITIONS } from '../../constants/creature';

export const sizeSchema = z.enum(CREATURE_SIZES);
export const dispositionSchema = z.enum(DISPOSITIONS);
```

> **Regel:** Enums für Zod-Schemas gehören nach `constants/`. Zod-Schemas importieren die Konstante, nicht umgekehrt. Keine Re-Exports von Types aus `constants/` in `types/`.

---

## Utils (`src/utils/`)

### Import-Pattern

```typescript
// Index-Import (bevorzugt)
import { randomBetween, rollDice, weightedRandomSelect } from '@/utils';

// Direkter Import
import { parseDice } from '@/utils/diceParser';
```

### Struktur

```
src/utils/
├── index.ts             # Re-exports aller Utils
├── diceParser.ts        # parseDice, validateDiceExpression, asDiceExpression
└── random.ts            # randomBetween, weightedRandomSelect, rollDice, diceMin, diceMax, diceAvg
```

### Regeln

1. **Nur pure functions** - Kein interner State, keine Side Effects
2. **Keine Storage-Abhängigkeiten** - Daten als Parameter übergeben
3. **Unit-testbar ohne Mocks** - Input → Output
4. **Von allen Layern importierbar**

### Beispiel

```typescript
// src/utils/creature-utils.ts
export function parseCR(crString: string): number {
  if (crString === '1/8') return 0.125;
  if (crString === '1/4') return 0.25;
  if (crString === '1/2') return 0.5;
  return parseFloat(crString);
}

export function calculateXP(cr: number): number {
  const xpByCR: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, // ...
  };
  return xpByCR[cr] ?? 0;
}
```

---

## Dokumentation

Die autoritative Spezifikation für Konstanten befindet sich in [docs/constants/](../constants/). Die Implementierung muss mit der Dokumentation übereinstimmen.

| Dokumentation | Implementierung |
|---------------|-----------------|
| `docs/constants/TimeSegments.md` | `src/constants/time.ts` |
| `docs/constants/Difficulty.md` | `src/constants/encounter.ts` |
| `docs/constants/CreatureSizes.md` | `src/constants/creature.ts` |
| ... | ... |

---

## Weiterführend

- [../constants/](../constants/) - Konstanten-Spezifikationen (Single Source of Truth)
- [types.md](types.md) - TypeScript-Typen und Entity-Schemas
- [Orchestration.md](Orchestration.md) - Architektur-Übersicht
