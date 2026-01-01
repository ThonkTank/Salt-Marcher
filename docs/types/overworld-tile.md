# Schema: OverworldTile

> **Produziert von:** [Cartographer](../views/Cartographer.md) (Terrain/Danger-Zone Painting)
> **Konsumiert von:** [Travel](../features/Travel-System.md) (Terrain-Faktoren, Reisezeit), [Encounter](../services/encounter/Encounter.md) (CR-Budget, EncounterZones), [Map-Feature](../features/Map-Feature.md) (Rendering)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| coordinate | HexCoordinate | Axiale Position | Required |
| terrain | EntityId<'terrain'> | Terrain-Referenz | Required |
| elevation | number? | Hoehenstufe | Optional |
| crBudget | number? | CR-Budget Override | Optional, Fallback: terrain.defaultCrBudget |
| crSpent | number? | Summe factionPresence[].strength | Computed |
| factionPresence | FactionPresence[]? | Fraktions-Praesenz | Optional |
| paths | TilePathInfo[]? | Pfade durch dieses Tile | Optional |
| climateModifiers | TileClimateModifiers? | Klima-Anpassungen | Optional |

**Typische crBudget-Werte:**

| Wert | Beschreibung |
|------|--------------|
| 5 | Staedte, Lager, Schutzgebiete |
| 15 | Standard-Wildnis |
| 30 | Monster-Territorien |
| 50 | Drachen-Lande, verfluchte Zonen |

## Sub-Schemas

### HexCoordinate

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| q | number | Axiale Q-Koordinate |
| r | number | Axiale R-Koordinate |

### TilePathInfo

Pfad-Informationen fuer ein spezifisches Tile. Referenziert [PathDefinition](path.md).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| pathId | EntityId<'path'> | Pfad-Referenz |
| connections.from | HexCoordinate? | Vorheriges Tile im Pfad |
| connections.to | HexCoordinate? | Naechstes Tile im Pfad |

### TileClimateModifiers

Tile-spezifische Klima-Anpassungen. Ueberschreibt Werte aus dem Terrain-Template.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| temperatureModifier | number? | Offset in Grad Celsius (z.B. -5 fuer kalten Sumpf) |
| humidityModifier | number? | Offset in % - beeinflusst fogChance + precipChance |
| windExposure | WindExposure? | Windexposition |

**WindExposure:**

| Wert | Wind | Audio-Reichweite | Scent-Reichweite |
|------|------|------------------|------------------|
| `sheltered` | -30% | x1.5 | x1.5 |
| `normal` | ±0% | x1.0 | x1.0 |
| `exposed` | +30% | x0.5 | x0.5 |

Geschuetzte Bereiche (Wald, Schlucht): weniger Wind, Schall/Geruch halten sich.
Exponierte Bereiche (Berggipfel, Ebene): mehr Wind, Schall/Geruch verstreuen.

## Invarianten

- `terrain` referenziert Terrain-Entity (nicht eingebettet)
- Effektives CR-Budget = `tile.crBudget ?? terrain.defaultCrBudget`
- Available CR = effektives CR-Budget - crSpent
- CR-Painting erfolgt via Cartographer Brush-Tool (setzt `crBudget` Override)
- `climateModifiers` Felder sind alle optional - nur ueberschriebene Werte werden gespeichert
- Climate-Modifiers werden VOR dem Area-Averaging angewendet

## Beispiel

```typescript
// Tile mit CR-Budget Override (gefaehrlicher als Standard-Forest)
const dangerousTile: OverworldTile = {
  coordinate: { q: 3, r: -2 },
  terrain: 'forest',
  crBudget: 30,  // Override: Monster-Territorium (forest.defaultCrBudget = 15)
  factionPresence: [
    { factionId: 'bloodfang', weight: 2.5 }
  ],
};
// Effektives CR-Budget: 30

// Tile ohne Override (nutzt Terrain-Default)
const normalTile: OverworldTile = {
  coordinate: { q: 4, r: -2 },
  terrain: 'forest',
  // kein crBudget -> nutzt forest.defaultCrBudget (15)
};
// Effektives CR-Budget: 15
```
