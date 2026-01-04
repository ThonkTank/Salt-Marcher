# Schema: TerrainDefinition

> **Produziert von:** [Library](../views/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:**
> - [Travel](../features/Travel-System.md) - movementCost fuer Speed-Berechnung
> - [Weather](../services/Weather.md) - weatherRanges fuer Generierung
> - [Encounter](../services/encounter/Encounter.md) - nativeCreatures, encounterModifier, features, threatLevel
> - [Cartographer](../views/Cartographer.md) - Terrain-Brush Auswahl

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
| environmentalPool | EnvironmentalPoolEntry[] | Zufaellig auswaehlbare Features fuer Encounters | Optional, default: [] |
| threatLevel | `{ min: number; max: number }` | CR-Bereich fuer native Kreaturen | Required, min/max >= 0 |
| blockerHeight | number | Hoehe von Sicht-Blockern in Feet (0 = keine) | Required, >= 0 |
| visibilityRange | number? | Max. Sichtweite in Feet (fuer dichte Terrains) | Optional, > 0 |
| defaultCrBudget | number | Standard CR-Budget fuer Tiles dieses Terrains | Required, >= 0 |
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

### EnvironmentalPoolEntry

Eintrag im Environmental-Pool fuer zufaellige Feature-Auswahl bei Encounters.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | EntityId<'feature'> | Referenz auf ein Feature |
| type | 'location' \| 'local' | `location` = max 1 pro Encounter, `local` = Diminishing Returns |
| chance | number | Basis-Wahrscheinlichkeit (0.0 - 1.0) |

**Auswahl-Logik:**
- `location`: Generische Orte (Lichtung, Ruine, Hoehle). Maximal einer pro Encounter.
- `local`: Lokale Features (Dornen, Felsen, Kraeuter). Diminishing Returns: 1. = 100%, 2. = 60%, 3. = 30%, ...

→ Details: [groupSeed.md#step-21b](../services/encounter/groupSeed.md#step-21b-environmental-feature-auswahl-post-mvp)

---

## Invarianten

- `nativeCreatures` wird bidirektional mit `creature.terrainAffinities` synchronisiert
- `weatherRanges` muss alle Felder enthalten
- `movementCost` muss > 0 sein
- `threatLevel.min` und `threatLevel.max` muessen >= 0 sein
- `threatLevel.min` <= `threatLevel.max`
- `displayColor` muss gueltiges Hex-Format sein (#RRGGBB)

---

## Default-Presets

Mitgelieferte Terrain-Presets:

### Bewegung & Encounter

| Terrain | movementCost | encounterMod | threatLevel (CR) | Transport | blockerHeight | defaultCrBudget |
|---------|--------------|--------------|:----------------:|-----------|---------------|-----------------|
| grassland | 1.0 | 1.0 | 0-2 | - | 0 | 15 |
| forest | 1.5 | 1.2 | 0.25-4 | blocksMounted | 60 | 15 |
| hill | 1.5 | 1.0 | 0.5-3 | - | 30 | 15 |
| mountain | 2.5 | 0.8 | 2-8 | blocksMounted, blocksCarriage | 100 | 30 |
| swamp | 2.0 | 1.5 | 1-6 | blocksMounted, blocksCarriage | 10 | 30 |
| desert | 1.5 | 0.7 | 0.5-5 | - | 0 | 15 |
| coast | 1.0 | 0.8 | 0-3 | - | 0 | 10 |
| arctic | 2.0 | 0.7 | 1-7 | - | 0 | 30 |

**threatLevel:** CR-Bereich fuer native (fraktionslose) Kreaturen. Kreaturen ausserhalb dieses Bereichs werden seltener ausgewaehlt (-20% pro CR Distanz, min 10%).

**blockerHeight (in Feet):** Hoehe von Sicht-Blockern ueber dem Terrain.
- `0` = Flach, keine Blocker (grassland, desert, coast, arctic)
- `10` = Niedriges Gestruepp (swamp)
- `30` = Huegel-Hoehe (hill)
- `60` = Baumkronen (forest)
- `100` = Bergspitzen (mountain)

**visibilityRange (in Feet):** Maximale Sichtweite fuer Encounter-Erkennung. Optional - nur fuer Terrains mit dichter Vegetation oder anderen Sichtblockern.
- Wenn gesetzt: Verwendet diesen Wert als maximale Sichtweite
- Wenn nicht gesetzt: Verwendet berechnete Sichtweite (Horizont-basiert, ~8000ft fuer offene Terrains)

| Terrain | visibilityRange | Begruendung |
|---------|-----------------|-------------|
| forest | 150 | Dichtes Blattwerk blockiert Sicht |
| swamp | 100 | Niedriges Gestruepp, haeufiger Nebel |
| grassland, hill, mountain, desert, coast, arctic | - | Offenes Terrain, Horizont-basiert |

### Wetter-Ranges (min/average/max)

| Terrain | Temperatur | Wind | Precip-Chance | Precip-Intensitaet | Fog-Chance |
|---------|------------|------|---------------|--------------------| -----------|
| grassland | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| forest | 0/15/30 | 0/10/30 | 20/40/70 | 15/35/60 | 20/40/70 |
| hill | -10/10/30 | 10/30/50 | 15/35/65 | 15/35/60 | 10/25/50 |
| mountain | -20/0/20 | 20/50/100 | 20/50/80 | 20/50/80 | 10/30/60 |
| swamp | 5/20/35 | 0/10/30 | 40/60/90 | 20/40/70 | 30/50/80 |
| desert | 0/35/50 | 5/15/80 | 0/5/20 | 5/20/50 | 0/5/20 |
| coast | 5/18/30 | 10/30/80 | 20/40/70 | 20/40/70 | 15/30/50 |
| arctic | -40/-15/5 | 10/40/100 | 20/40/70 | 10/30/60 | 5/20/50 |

### Features & Hazards (statisch)

| Terrain | Features | Hazards |
|---------|----------|---------|
| grassland | - | - |
| forest | Dichtes Unterholz, Alte Baeume, Stolperwurzeln, Dichte Dornen | Dornen: 1d4 piercing (DEX DC 12) |
| hill | Felsvorspruenge | - |
| mountain | Enge Paesse, Steinschlaggefahr | Steinschlag: 2d6 bludgeoning (DEX DC 14) |
| swamp | Schnappende Ranken, Sinkender Morast, Giftpflanzen | Ranken: restrained (Attack +5), Gift: poisoned (CON DC 13) |
| desert | Treibsand | Treibsand: restrained (STR DC 12) |
| coast | Starke Stroemung | Stroemung: forced-movement 15ft |
| arctic | Glattes Eis, Tiefschnee | Unterkuehlung: 1 Erschoepfung/Stunde ohne Schutz |

### Environmental Pool (zufaellig)

| Terrain | Location-Features | Local-Features |
|---------|-------------------|----------------|
| grassland | Huegel, Steinkreis | Hohes Gras, Wildblumen |
| forest | Lichtung, Alte Ruine, Hoehle | Dichtes Gebuesch, Umgestuerzte Baeume, Kraeuterpflanzen |
| hill | Aussichtspunkt, Versteckte Hoehle | Felsbrocken, Gestruepp |
| mountain | Berghoehle, Alter Wachturm | Felsvorspruenge, Gelocker Gestein, Bergkraeuter |
| swamp | Versunkene Ruine, Trockene Insel | Sumpfloecher, Ranken, Giftpilze |
| desert | Oase, Sandstein-Formation | Duenen, Kakteen, Skelette |
| coast | Insel, Gestrandetes Wrack | Untiefen, Felsen, Seetang |
| arctic | Eishoehle, Gefrorener See | Schneewehen, Eiszapfen, Gefrorene Leichen |

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
  blockerHeight: 50,  // Feenbaeume
  defaultCrBudget: 15,
  threatLevel: { min: 0.25, max: 3 },  // Fey-Kreaturen: CR 0.25 bis 3
  nativeCreatures: ['pixie', 'dryad', 'blink-dog'] as EntityId<'creature'>[],
  features: ['fey-mist', 'dancing-lights', 'whispering-trees'] as EntityId<'feature'>[],
  environmentalPool: [
    { id: 'fairy-ring', type: 'location', chance: 0.10 },
    { id: 'ancient-shrine', type: 'location', chance: 0.05 },
    { id: 'glowing-mushrooms', type: 'local', chance: 0.15 },
    { id: 'thorny-brambles', type: 'local', chance: 0.12 }
  ],

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
