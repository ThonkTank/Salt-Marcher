# gridSpace Service

> **Verantwortlichkeit:** Grid-State und Positioning für Combat und andere Workmodes
> **Input:** Grid-Konfiguration, Combatant-Profile, Allianzen
> **Output:** GridConfig, positionierte Combatants, Cell-Listen

## Übersicht

Der gridSpace Service kapselt alle Grid-bezogenen Operationen für Combat und zukünftige Grid-basierte Features (z.B. Dungeon). Er ist von Workmodes direkt nutzbar und liefert Ergebnisse für andere Services/Workflows.

**Pfad:** `src/services/gridSpace/`

## Funktionen

### Grid Initialization

```typescript
function initializeGrid(config: {
  encounterDistanceCells?: number;
  marginCells?: number;
}): GridConfig
```

Erstellt GridConfig für Combat-Tracking mit konfigurierbarer Größe.

### Positioning

```typescript
function spreadFormation(
  profiles: PositionedCombatant[],
  center: GridPosition
): void
```

Verteilt Combatants in Formation (2 Cells = 10ft Abstand). Mutiert `profile.position` direkt.

```typescript
function calculateInitialPositions(
  profiles: PositionedCombatant[],
  alliances: Record<string, string[]>,
  config?: { encounterDistanceCells?: number }
): void
```

Setzt Initial-Positionen: Party + Verbündete auf einer Seite, Feinde auf der anderen.

### Cell Enumeration

```typescript
function getRelevantCells(
  center: GridPosition,
  movementCells: number
): GridPosition[]
```

Gibt alle Cells innerhalb 2× Bewegungsreichweite zurück.

```typescript
function getCellsInRange(
  center: GridPosition,
  rangeCells: number
): GridPosition[]
```

Gibt alle Cells innerhalb einer Reichweite zurück (PHB-Variant Distanz).

## Konstanten

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `GRID_MARGIN_CELLS` | 20 | Margin um das Kampffeld |
| `DEFAULT_ENCOUNTER_DISTANCE_FEET` | 60 | Standard-Distanz in Feet |
| `DEFAULT_ENCOUNTER_DISTANCE_CELLS` | 12 | Standard-Distanz in Cells |

## Abhängigkeiten

- `utils/squareSpace/` - Pure Grid-Utilities (createGrid, spreadFormation, getDistance)
- `combatHelpers` - Distance-Wrapper mit PHB-Variant

## Consumer

- [combatTracking](combatTracking.md) - Nutzt für State-Initialisierung
- [combatantAI](combatantAI/combatantAI.md) - Nutzt für Cell-Evaluation
- [difficulty](encounter/difficulty.md) - Nutzt via combatTracking

## Siehe auch

- [utils/grid.md](../utils/grid.md) - Low-level Grid-Utilities
