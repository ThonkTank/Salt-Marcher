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

### Struktur

```
src/constants/
├── xp-thresholds.ts     # XP pro Level für Encounter-Difficulty
├── encounter-multipliers.ts  # Party-Size/Monster-Count Multiplikatoren
├── travel-speed.ts      # Basis-Reisegeschwindigkeiten
├── time-segments.ts     # Tagesabschnitte (dawn, morning, etc.)
├── creature-sizes.ts    # Größen-Kategorien
├── creature-types.ts    # D&D Kreatur-Typen
├── loot-rarity.ts       # Seltenheits-Stufen
└── index.ts             # Re-exports
```

### Beispiel

```typescript
// src/constants/xp-thresholds.ts
export const XP_THRESHOLDS_BY_LEVEL: Record<number, XPThreshold> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  // ...
};
```

---

## Utils (`src/utils/`)

### Struktur

```
src/utils/
├── hex-math.ts          # hexDistance, coordToKey, hexNeighbors
├── time-math.ts         # addDuration, getTimeOfDay, getCurrentSeason
├── creature-utils.ts    # parseCR, calculateXP, getEncounterMultiplier
├── terrain-utils.ts     # getMovementCost, matchEncounterTerrain
├── inventory-utils.ts   # addItem, removeItem, calculateWeight
├── loot-utils.ts        # distributeCurrency, quickAssign
└── index.ts             # Re-exports
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
| `docs/constants/TimeSegments.md` | `src/constants/time-segments.ts` |
| `docs/constants/Difficulty.md` | `src/constants/xp-thresholds.ts` |
| `docs/constants/CreatureSizes.md` | `src/constants/creature-sizes.ts` |
| ... | ... |

---

## Weiterführend

- [../constants/](../constants/) - Konstanten-Spezifikationen (Single Source of Truth)
- [schemas.md](schemas.md) - Entity-Schemas
- [Orchestration.md](Orchestration.md) - Architektur-Übersicht
