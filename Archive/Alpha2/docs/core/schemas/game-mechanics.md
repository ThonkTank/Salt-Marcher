# Game Mechanics Schema

D&D-Spielmechanik-Typen die von Creatures, NPCs und anderen Entitäten geteilt werden.

## Implementation

`src/core/schemas/game-mechanics.ts`

## Types

### CreatureSize

```typescript
type CreatureSize = "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";
```

### SIZE_WEIGHT

Typisches Gewicht in kg pro Größenklasse.

| Size | Gewicht (kg) |
|------|--------------|
| Tiny | 2 |
| Small | 15 |
| Medium | 70 |
| Large | 500 |
| Huge | 4000 |
| Gargantuan | 20000 |

### Movement

```typescript
interface Movement {
  walk?: number;    // feet per round
  fly?: number;
  swim?: number;
  burrow?: number;
  climb?: number;
}
```

### GameMechanics

Basis-Interface für D&D-Spielmechanik.

```typescript
interface GameMechanics {
  size: CreatureSize;
  CR: number;
  XP: number;
  bodyWeight: number;  // kg
  movement: Movement;
  stealth?: number;
  perception?: number;
}
```

## Siehe auch

- `docs/core/schemas/creature.md` - Erweitert GameMechanics mit Ecology-Feldern
- `docs/core/eco-math.md` - Verwendet SIZE_WEIGHT für FU-Berechnungen
