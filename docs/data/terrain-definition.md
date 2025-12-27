# Schema: TerrainDefinition

> **Produziert von:** [Library](../application/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:**
> - [Travel](../features/Travel-System.md) - movementCost fuer Speed-Berechnung
> - [Weather](../features/Weather-System.md) - weatherRanges fuer Generierung
> - [Encounter](../features/encounter/Encounter.md) - nativeCreatures, encounterModifier, features, threatLevel/threatRange
> - [Cartographer](../application/Cartographer.md) - Terrain-Brush Auswahl

Template fuer Terrain-Typen. User koennen eigene Terrains erstellen. Default-Terrains werden als Presets mitgeliefert.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'terrain'> | Eindeutige ID | Required |
| name | string | Anzeigename | Required, non-empty |
| movementCost | number | Bewegungsfaktor (1.0 = normal, 2.0 = difficult) | Required, > 0 |
| requiresBoat | boolean? | Wasser-Terrain | Optional, default: false |
| blocksMounted | boolean? | Blockiert berittene Reise | Optional, default: false |
| blocksCarriage | boolean? | Blockiert Karren/Wagen | Optional, default: false |
| encounterModifier | number | Multiplikator fuer Encounter-Chance | Required |
| nativeCreatures | EntityId<'creature'>[] | Heimische Kreaturen | Required |
| features | EntityId<'feature'>[] | Terrain-Features (difficult-terrain, half-cover, etc.) | Required |
| threatLevel | number | Verschiebt Peak der Difficulty-Kurve | Required, -2 bis +2 |
| threatRange | number | Streuung der Difficulty-Verteilung | Required, 0.5 bis 2.0 |
| encounterVisibility | number | Basis-Sichtweite in Feet | Required, > 0 |
| weatherRanges | TerrainWeatherRanges | Wetter-Template | Required |
| displayColor | string | Hex-Farbe fuer Map-Rendering | Required, Hex-Format |
| icon | string? | Icon-Referenz | Optional |
| description | string? | Beschreibungstext | Optional |

---

## Sub-Schemas

### TerrainWeatherRanges

Wetter-Bereiche fuer die Wetter-Generierung.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| temperature | WeatherRange | Temperatur in Grad Celsius |
| wind | WeatherRange | Windgeschwindigkeit in km/h |
| precipChance | WeatherRange | Niederschlags-Wahrscheinlichkeit (0-100) |
| precipIntensity | WeatherRange | Niederschlags-Staerke (0-100) |
| fogChance | WeatherRange | Nebel-Wahrscheinlichkeit (0-100) |

### WeatherRange

Minimum/Durchschnitt/Maximum fuer einen Wetter-Wert.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| min | number | Minimum (z.B. extreme Kaelte) |
| average | number | Durchschnitt |
| max | number | Maximum (z.B. Hitzewelle) |

---

## Invarianten

- `nativeCreatures` wird bidirektional mit `creature.terrainAffinities` synchronisiert
- `weatherRanges` muss alle Felder enthalten
- `movementCost` muss > 0 sein
- `threatLevel` im Bereich -2 bis +2
- `threatRange` im Bereich 0.5 bis 2.0
- `displayColor` muss gueltiges Hex-Format sein (#RRGGBB)

---

## Default-Presets

Mitgelieferte Terrain-Presets:

### Bewegung & Encounter

| Terrain | movementCost | encounterMod | threatLevel | threatRange | Transport | encounterVisibility |
|---------|--------------|--------------|:-----------:|:-----------:|-----------|---------------------|
| road | 1.0 | 0.5 | -1 | 0.7 | - | 1000ft |
| plains | 0.9 | 1.0 | 0 | 1.0 | - | 8000ft |
| forest | 0.6 | 1.2 | 0 | 1.2 | blocksMounted | 150ft |
| hills | 0.7 | 1.0 | 0 | 1.0 | - | 2500ft |
| mountains | 0.4 | 0.8 | +1 | 1.3 | blocksMounted, blocksCarriage | 10000ft |
| swamp | 0.5 | 1.5 | +1 | 1.5 | blocksMounted, blocksCarriage | 300ft |
| desert | 0.7 | 0.7 | 0 | 0.8 | - | 8000ft |
| water | 1.0 | 0.5 | -1 | 1.0 | requiresBoat | 5000ft |

### Wetter-Ranges (min/average/max)

| Terrain | Temperatur | Wind | Precip-Chance | Precip-Intensitaet | Fog-Chance |
|---------|------------|------|---------------|--------------------| -----------|
| road | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| plains | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| forest | 0/15/30 | 0/10/30 | 20/40/70 | 15/35/60 | 20/40/70 |
| hills | -10/10/30 | 10/30/50 | 15/35/65 | 15/35/60 | 10/25/50 |
| mountains | -20/0/20 | 20/50/100 | 20/50/80 | 20/50/80 | 10/30/60 |
| swamp | 5/20/35 | 0/10/30 | 40/60/90 | 20/40/70 | 30/50/80 |
| desert | 0/35/50 | 5/15/80 | 0/5/20 | 5/20/50 | 0/5/20 |
| water | 5/18/30 | 10/30/80 | 20/40/70 | 20/40/70 | 15/30/50 |

### Features & Hazards

| Terrain | Features | Hazards |
|---------|----------|---------|
| road | - | - |
| plains | - | - |
| forest | Dichtes Unterholz, Alte Baeume, Stolperwurzeln, Dichte Dornen | Dornen: 1d4 piercing (DEX DC 12) |
| hills | Felsvorspruenge | - |
| mountains | Enge Paesse, Steinschlaggefahr | Steinschlag: 2d6 bludgeoning (DEX DC 14) |
| swamp | Schnappende Ranken, Sinkender Morast, Giftpflanzen | Ranken: restrained (Attack +5), Gift: poisoned (CON DC 13) |
| desert | Treibsand | Treibsand: restrained (STR DC 12) |
| water | Starke Stroemung | Stroemung: forced-movement 15ft |

---

## Beispiel

```typescript
const feyForest: TerrainDefinition = {
  id: 'user-fey-forest' as EntityId<'terrain'>,
  name: 'Feenwald',

  // Bewegung
  movementCost: 0.7,
  blocksMounted: true,

  // Encounter
  encounterModifier: 1.5,
  encounterVisibility: 45,
  threatLevel: 0,
  threatRange: 1.2,
  nativeCreatures: ['pixie', 'dryad', 'blink-dog'] as EntityId<'creature'>[],
  features: ['fey-mist', 'dancing-lights', 'whispering-trees'] as EntityId<'feature'>[],

  // Wetter
  weatherRanges: {
    temperature: { min: 5, average: 18, max: 28 },
    wind: { min: 0, average: 5, max: 15 },
    precipChance: { min: 30, average: 50, max: 80 },
    precipIntensity: { min: 20, average: 40, max: 60 },
    fogChance: { min: 25, average: 45, max: 75 }
  },

  // Darstellung
  displayColor: '#7B68EE',
  icon: 'sparkles',
  description: 'Ein von Feenmagie durchdrungener Wald mit ungewoehnlichem Wetter.'
};
```

---

## Storage

**Bundled Presets:**
```
presets/terrains/base-terrains.json
```

**User Custom Terrains:**
```
Vault/SaltMarcher/data/terrain/*.json
```

User-Terrains koennen Bundled-Terrains ueberschreiben (gleiche ID).
