# Schema: OverworldTile

> **Produziert von:** [Cartographer](../application/Cartographer.md) (Terrain/Danger-Zone Painting)
> **Konsumiert von:** [Travel](../features/Travel-System.md) (Terrain-Faktoren, Reisezeit), [Encounter](../services/encounter/Encounter.md) (CR-Budget, EncounterZones), [Map-Feature](../features/Map-Feature.md) (Rendering)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| coordinate | HexCoordinate | Axiale Position | Required |
| terrain | EntityId<'terrain'> | Terrain-Referenz | Required |
| elevation | number? | Hoehenstufe | Optional |
| dangerZone | DangerZone? | Gefahrenstufe | Default: 'normal' |
| crBudget | number? | Manueller CR-Override | Optional |
| crSpent | number? | Summe factionPresence[].strength | Computed |
| factionPresence | FactionPresence[]? | Fraktions-Praesenz | Optional |
| paths | TilePathInfo[]? | Pfade durch dieses Tile | Optional |
| climateModifiers | TileClimateModifiers? | Klima-Anpassungen | Optional |

## Sub-Schemas

### HexCoordinate

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| q | number | Axiale Q-Koordinate |
| r | number | Axiale R-Koordinate |

### DangerZone

| Wert | CR-Budget | Beschreibung |
|------|-----------|--------------|
| `safe` | 5 | Staedte, Lager, Schutzgebiete |
| `normal` | 15 | Standard-Wildnis |
| `dangerous` | 30 | Monster-Territorien |
| `deadly` | 50 | Drachen-Lande, verfluchte Zonen |

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
- CR-Budget = dangerZone-Basis oder crBudget-Override
- Available CR = Budget - crSpent
- DangerZone-Painting erfolgt via Cartographer Brush-Tool
- `climateModifiers` Felder sind alle optional - nur ueberschriebene Werte werden gespeichert
- Climate-Modifiers werden VOR dem Area-Averaging angewendet

## Beispiel

```typescript
const tile: OverworldTile = {
  coordinate: { q: 3, r: -2 },
  terrain: 'terrain:forest' as EntityId<'terrain'>,
  elevation: 2,
  dangerZone: 'dangerous',
  factionPresence: [
    { factionId: 'faction:bloodfang' as EntityId<'faction'>, strength: 2.5 }
  ],
  crSpent: 2.5,
  climateModifiers: {
    temperatureModifier: -5,    // Kalter Wald
    windExposure: 'sheltered'   // Geschuetzt durch Baeume
  }
};

// Available CR: 30 (dangerous) - 2.5 = 27.5
```
