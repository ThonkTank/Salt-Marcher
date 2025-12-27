# Terrain

> **Lies auch:** [Map](Map.md)
> **Wird benoetigt von:** Map-Feature, Weather, Travel

Single Source of Truth fuer Terrain-Definitionen und Custom Terrains.

**Design-Philosophie:** Terrains sind konfigurierbar, nicht hardcoded. User koennen eigene Terrains erstellen. Default-Terrains werden als Presets mitgeliefert.

---

## Uebersicht

TerrainDefinition beschreibt alle Eigenschaften eines Terrains:

```
TerrainDefinition
├── Bewegungs-Mechaniken (movementCost, Transport-Einschraenkungen)
├── Encounter-Modifikatoren
├── Features (Library-Referenzen fuer Encounter-Balance)
├── Wetter-Ranges (weatherRanges - Template fuer diesen Terrain-Typ)
├── Native Creatures (bidirektional sync)
└── Visuelle Darstellung (displayColor, icon)

OverworldTile (Instanz)
├── terrain: EntityId<'terrain'>
├── elevation?: number
└── climateModifiers?: TileClimateModifiers  ← Tile-spezifische Anpassungen
```

---

## Schema

### TerrainDefinition

```typescript
interface TerrainDefinition {
  id: EntityId<'terrain'>;
  name: string;                           // "Fungal Wastes"

  // Bewegungs-Mechaniken
  movementCost: number;                   // 1.0 = normal, 2.0 = difficult terrain

  // Transport-Einschraenkungen (Travel-System)
  requiresBoat?: boolean;                 // z.B. water
  blocksMounted?: boolean;                // z.B. forest, mountains
  blocksCarriage?: boolean;               // z.B. mountains, swamp

  // Encounter-System
  encounterModifier: number;              // Multiplikator fuer Encounter-Chance
  nativeCreatures: EntityId<'creature'>[]; // Kreaturen die hier heimisch sind
  features: EntityId<'feature'>[];        // Features fuer Encounter-Balance (z.B. difficult-terrain, half-cover)

  // Encounter-Schwierigkeit (Normalverteilung)
  threatLevel: number;                    // -2 bis +2: Verschiebt Peak der Difficulty-Kurve
  threatRange: number;                    // 0.5 bis 2.0: Breite/Streuung der Kurve

  // Encounter-Sichtweite (Basis-Wert in feet, wird mit Weather-Modifier multipliziert)
  encounterVisibility: number;            // z.B. 300ft plains, 60ft forest

  // Wetter-Ranges (fuer Wetter-Generierung)
  weatherRanges: TerrainWeatherRanges;

  // Visuelle Darstellung
  displayColor: string;                   // Hex-Farbe fuer Map-Rendering
  icon?: string;                          // Optional: Icon-Referenz

  // Metadaten
  description?: string;
}

interface TerrainWeatherRanges {
  temperature: WeatherRange;              // in Grad Celsius
  wind: WeatherRange;                     // in km/h
  precipChance: WeatherRange;             // 0-100 (Wahrscheinlichkeit fuer Niederschlag)
  precipIntensity: WeatherRange;          // 0-100 (Staerke des Niederschlags)
  fogChance: WeatherRange;                // 0-100 (Wahrscheinlichkeit fuer Nebel)
}

interface WeatherRange {
  min: number;                            // Minimum (z.B. extreme Kaelte)
  average: number;                        // Durchschnitt
  max: number;                            // Maximum (z.B. Hitzewelle)
}

// **Breaking Change:** `precipitation` wurde in `precipChance` und `precipIntensity` aufgeteilt.
// `fogChance` ist neu - Nebel ist jetzt ein separater Layer.
```

---

## TileClimateModifiers

**Scope-Klaerung:** Klima-Anpassungen erfolgen auf **Tile-Level**, nicht auf TerrainDefinition-Level.

```
TerrainDefinition.weatherRanges  = "Waelder sind generell so" (Template)
OverworldTile.climateModifiers   = "Dieses spezifische Tile ist anders" (Instanz)
```

### Schema

```typescript
interface TileClimateModifiers {
  temperatureModifier?: number;     // Offset in °C (z.B. -5 fuer kalten Sumpf)
  humidityModifier?: number;        // Offset in % - beeinflusst fogChance + precipChance
  windExposure?: 'sheltered' | 'normal' | 'exposed';
}
```

**Alle Felder optional:** Nur ueberschriebene Werte werden gespeichert. Nicht-ueberschriebene Werte kommen aus dem Terrain-Template.

### windExposure Effekte

`windExposure` beeinflusst **drei Systeme**:

| windExposure | Wind | Audio-Reichweite | Scent-Reichweite |
|--------------|------|------------------|------------------|
| `sheltered` | -30% | x1.5 | x1.5 |
| `normal` | ±0% | x1.0 | x1.0 |
| `exposed` | +30% | x0.5 | x0.5 |

**Logik:**
- **Geschuetzte Bereiche** (Wald, Schlucht, Hoehle): weniger Wind, Schall/Geruch halten sich
- **Exponierte Bereiche** (Berggipfel, offene Ebene): mehr Wind, Schall/Geruch verstreuen schnell

### Verwendung in OverworldTile

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;
  elevation?: number;
  climateModifiers?: TileClimateModifiers;  // Optional - nur wenn vom GM ueberschrieben
}
```

→ Details zur Verwendung: [Map-Feature.md](../features/Map-Feature.md#overworldtile)

### Anwendungs-Reihenfolge

Tile-Modifiers werden **VOR** dem Area-Averaging angewendet:

```
Terrain-Basis → + Tile-Modifiers → Area-Averaging → + Time-Segment → Finales Wetter
```

Das bedeutet: Ein kalter Sumpf (Tile mit temperatureModifier: -5) beeinflusst auch das Wetter benachbarter Tiles.

→ Details: [Weather-System.md](../features/Weather-System.md#berechnungs-reihenfolge)

### Erstellung im Cartographer

Tile-Modifiers werden mit dem **Climate-Brush** im Cartographer erstellt:

1. Climate-Brush auswaehlen (🌡️)
2. Layer waehlen: Temp / Precip / Wind / Fog
3. Override-Wert einstellen
4. Tiles bemalen

→ Details: [Cartographer.md](../application/Cartographer.md#climate-brush)

---

## Default-Terrains

Mitgelieferte Terrain-Presets:

| Terrain | movementCost | encounterMod | threatLevel | threatRange | Transport | encounterVisibility |
|---------|--------------|--------------|:-----------:|:-----------:|-----------|---------------------|
| `road` | 1.0 | 0.5 | -1 | 0.7 | - | 1000ft |
| `plains` | 0.9 | 1.0 | 0 | 1.0 | - | 8000ft |
| `forest` | 0.6 | 1.2 | 0 | 1.2 | blocksMounted | 150ft |
| `hills` | 0.7 | 1.0 | 0 | 1.0 | - | 2500ft |
| `mountains` | 0.4 | 0.8 | +1 | 1.3 | blocksMounted, blocksCarriage | 10000ft |
| `swamp` | 0.5 | 1.5 | +1 | 1.5 | blocksMounted, blocksCarriage | 300ft |
| `desert` | 0.7 | 0.7 | 0 | 0.8 | - | 8000ft |
| `water` | 1.0 | 0.5 | -1 | 1.0 | requiresBoat | 5000ft |

**threatLevel/threatRange Interpretation:**
- **threatLevel**: -2 (sehr sicher) bis +2 (sehr gefaehrlich) - verschiebt Peak der Encounter-Difficulty
- **threatRange**: 0.5 (vorhersehbar) bis 2.0 (chaotisch) - Streuung der Difficulty-Verteilung
- Zusammen modellieren sie eine Normalverteilung fuer Encounter-Schwierigkeit

→ Details: [encounter/Balance.md](../features/encounter/Balance.md#terrain-threat-kurve)

**encounterVisibility Erklaerung:**

`encounterVisibility` ist die **Basis-Sichtweite fuer Kreatur-Erkennung** bei klarem Wetter. Die Werte sind realistisch fuer menschliche Sichtweiten: Auf einer Ebene kann man ca. 1.5 Meilen (~8000ft) weit sehen.

**Wichtig:** Dies ist NICHT die Overland-Visibility (Hex-basiert, fuer Fog-of-War). Das sind zwei verschiedene Systeme:

| System | Einheit | Zweck |
|--------|---------|-------|
| **encounterVisibility** | Feet | Wie weit kann die Party Kreaturen erkennen? |
| **Overland-Visibility** | Hexes | Welche Tiles sind auf der Map sichtbar? (Post-MVP) |

→ Overland-Visibility Details: [Map-Feature.md](../features/Map-Feature.md#visibility-system-post-mvp)

**Modifier (multiplikativ):**
- `weather.visibilityModifier`: 0.1 (dichter Nebel) bis 1.0 (klar)
- Encounter-Groessen-Modifier: Grosse Gruppen/Kreaturen sind weiter sichtbar

→ Groessen-Modifier Details: [encounter/Balance.md](../features/encounter/Balance.md#encounter-groessen-modifier)

**Features (Encounter-Balance + Hazards):**

| Terrain | Features | Hazards |
|---------|----------|---------|
| `road` | - | - |
| `plains` | - | - |
| `forest` | Dichtes Unterholz, Alte Baeume, Stolperwurzeln, Dichte Dornen | Dornen: 1d4 piercing (DEX DC 12) |
| `hills` | Felsvorspruenge | - |
| `mountains` | Enge Paesse, Steinschlaggefahr | Steinschlag: 2d6 bludgeoning (DEX DC 14) |
| `swamp` | Schnappende Ranken, Sinkender Morast, Giftpflanzen | Ranken: restrained (Attack +5), Gift: poisoned (CON DC 13) |
| `desert` | Treibsand | Treibsand: restrained (STR DC 12) |
| `water` | Starke Stroemung | Stroemung: forced-movement 15ft |

**Beispiele:**
- **Stolperwurzeln:** move-through trigger, prone condition, DEX DC 10
- **Dichte Dornen:** move-through trigger, 1d4 piercing, DEX DC 12
- **Schnappende Ranken:** enter trigger, restrained, Attack +5

→ Feature-Schema: [encounter/Context.md](../features/encounter/Context.md#feature-schema)

**Wetter-Ranges (Temperatur/Wind/Niederschlag/Nebel):**

| Terrain | Temperatur | Wind | Precip-Chance | Precip-Intensitaet | Fog-Chance |
|---------|------------|------|---------------|--------------------| -----------|
| `road` | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| `plains` | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| `forest` | 0/15/30 | 0/10/30 | 20/40/70 | 15/35/60 | 20/40/70 |
| `hills` | -10/10/30 | 10/30/50 | 15/35/65 | 15/35/60 | 10/25/50 |
| `mountains` | -20/0/20 | 20/50/100 | 20/50/80 | 20/50/80 | 10/30/60 |
| `swamp` | 5/20/35 | 0/10/30 | 40/60/90 | 20/40/70 | 30/50/80 |
| `desert` | 0/35/50 | 5/15/80 | 0/5/20 | 5/20/50 | 0/5/20 |
| `water` | 5/18/30 | 10/30/80 | 20/40/70 | 20/40/70 | 15/30/50 |

**Leseweise:** min / average / max

**Interpretation:**
- **Precip-Chance:** Wie oft es regnet/schneit
- **Precip-Intensitaet:** Wie stark es regnet (unabhaengig von Chance)
- **Fog-Chance:** Wahrscheinlichkeit fuer Nebel (kombinierbar mit Niederschlag)

→ Details zu Transport-Modi: [Travel-System.md](../features/Travel-System.md)

---

## Creature-Terrain Auto-Sync

### Bidirektionale Beziehung

Kreaturen und Terrains haben eine bidirektionale Beziehung:

```
creature.terrainAffinities[] ←→ terrain.nativeCreatures[]
```

### Warum beide Seiten?

| Feld | Nutzer | Zweck |
|------|--------|-------|
| `creature.terrainAffinities` | GM | "Wo lebt diese Kreatur?" - intuitive Zuordnung |
| `terrain.nativeCreatures` | System | Schnelles Lookup bei Encounter-Generierung |

### Auto-Sync Mechanismus

Das System synchronisiert automatisch bei Aenderungen:

```typescript
// Bei creature.terrainAffinities Aenderung:
function onCreatureTerrainChanged(
  creatureId: EntityId<'creature'>,
  oldAffinities: EntityId<'terrain'>[],
  newAffinities: EntityId<'terrain'>[]
) {
  // Entfernte Terrains: creature aus terrain.nativeCreatures loeschen
  const removed = oldAffinities.filter(t => !newAffinities.includes(t));
  for (const terrainId of removed) {
    terrain.nativeCreatures = terrain.nativeCreatures.filter(c => c !== creatureId);
  }

  // Neue Terrains: creature zu terrain.nativeCreatures hinzufuegen
  const added = newAffinities.filter(t => !oldAffinities.includes(t));
  for (const terrainId of added) {
    terrain.nativeCreatures.push(creatureId);
  }
}

// Bei terrain.nativeCreatures Aenderung: Analog umgekehrt
```

### Vorteile

- **GM-Workflow:** Nur eine Stelle editieren
- **Keine Inkonsistenzen:** System garantiert Synchronitaet
- **Performance:** Encounter-System hat direkten Zugriff auf Creature-Liste

---

## Custom Terrains (MVP)

User koennen eigene Terrains erstellen:

### Beispiel: Magischer Wald

```json
{
  "id": "user-fey-forest",
  "name": "Feenwald",
  "movementCost": 0.7,
  "encounterModifier": 1.5,
  "encounterVisibility": 45,
  "nativeCreatures": ["pixie", "dryad", "blink-dog"],
  "features": ["fey-mist", "dancing-lights", "whispering-trees"],
  "weatherRanges": {
    "temperature": { "min": 5, "average": 18, "max": 28 },
    "wind": { "min": 0, "average": 5, "max": 15 },
    "precipChance": { "min": 30, "average": 50, "max": 80 },
    "precipIntensity": { "min": 20, "average": 40, "max": 60 },
    "fogChance": { "min": 25, "average": 45, "max": 75 }
  },
  "displayColor": "#7B68EE",
  "icon": "sparkles",
  "description": "Ein von Feenmagie durchdrungener Wald mit ungewoehnlichem Wetter."
}
```

**Passende Features fuer den Feenwald:**

```json
{
  "id": "fey-mist",
  "name": "Feennebel",
  "modifiers": [
    { "target": "no-special-sense", "value": -0.20 },
    { "target": "trueSight", "value": 0.15 }
  ],
  "hazard": {
    "trigger": "end-turn",
    "effect": {
      "type": "condition",
      "condition": "charmed",
      "duration": "until-saved"
    },
    "save": {
      "ability": "wis",
      "dc": 13,
      "onSuccess": "negate"
    }
  },
  "description": "Magischer Nebel verwirrt den Geist und kann Kreaturen verzaubern."
}
```

### Verwendung auf Map

Tiles referenzieren TerrainDefinition via ID:

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;    // z.B. "user-fey-forest"
  elevation?: number;
  // ...
}
```

---

## Verwendung in anderen Features

### Travel-System

Travel liest `terrain.movementCost` fuer Speed-Berechnung:

```typescript
function calculateEffectiveSpeed(baseSpeed: number, terrain: TerrainDefinition): number {
  return baseSpeed * terrain.movementCost;
}
```

→ Details: [Travel-System.md](../features/Travel-System.md)

### Weather-System

Weather nutzt `terrain.weatherRanges` fuer Generierung:

```typescript
function generateTileWeather(terrain: TerrainDefinition): WeatherParams {
  return {
    temperature: generateFromRange(terrain.weatherRanges.temperature),
    wind: generateFromRange(terrain.weatherRanges.wind),
    precipChance: generateFromRange(terrain.weatherRanges.precipChance),
    precipIntensity: generateFromRange(terrain.weatherRanges.precipIntensity),
    fogChance: generateFromRange(terrain.weatherRanges.fogChance)
  };
}
```

→ Details: [Weather-System.md](../features/Weather-System.md)

### Encounter-System

Encounter nutzt `terrain.nativeCreatures` fuer schnelles Filtering:

```typescript
function getEligibleCreatures(terrainId: EntityId<'terrain'>): CreatureDefinition[] {
  const terrain = entityRegistry.get('terrain', terrainId);
  return terrain.nativeCreatures.map(id => entityRegistry.get('creature', id));
}
```

### Sichtweite bei Encounter-Generierung

Die `encounterVisibility` bestimmt die Basis-Distanz bei Encounter-Entdeckung. Der Wert wird mit Weather- und Time-Modifiern multipliziert:

```typescript
function calculateInitialDistance(
  terrain: TerrainDefinition,
  weather: WeatherState,
  timeSegment: TimeSegment,
  encounterType: EncounterType
): number {
  // Basis: Terrain-Sichtweite (z.B. 300ft plains, 60ft forest)
  const terrainBase = terrain.encounterVisibility;

  // Weather-Modifier (0.1-1.0, aus Weather-System)
  const weatherModifier = weather.visibilityModifier;

  // Tageszeit-Modifier (optional, aus Time-System)
  const timeModifier = getTimeVisibilityModifier(timeSegment);

  // Effektive Sichtweite
  const effectiveRange = terrainBase * weatherModifier * timeModifier;

  // Typ-basierte Modifikation
  switch (encounterType) {
    case 'combat':
      // Combat beginnt oft naeher (Ambush, Patrouille)
      return Math.floor(effectiveRange * randomBetween(0.3, 0.8));
    case 'social':
      // Social meist auf "Gespraechsdistanz"
      return Math.floor(effectiveRange * randomBetween(0.5, 1.0));
    case 'passing':
      // Passing meist weiter weg
      return Math.floor(effectiveRange * randomBetween(0.7, 1.0));
    case 'trace':
      // Trace = Party stolpert drueber
      return randomBetween(10, 30);
    default:
      return effectiveRange;
  }
}
```

**Konsolidierung:** Dieses System nutzt den prozentualen `visibilityModifier` aus dem Weather-System (Map-Feature.md Referenz), statt eines binaeren `clear`/`obscured` Checks.

→ Details: [encounter/Encounter.md](../features/encounter/Encounter.md) | [Weather-System.md](../features/Weather-System.md)

---

## Storage

### Phase 1: Plugin-Bundled Presets (MVP)

Basis-Terrains werden im Plugin gebundelt und zur Build-Zeit importiert:

```
presets/
└── terrains/
    └── base-terrains.json      # 8 Basis-Terrains (road, plains, etc.)
```

**Implementation:** `src/infrastructure/vault/terrain-registry.ts` laedt JSON via esbuild Import.

### Phase 2: User Custom Terrains (Post-MVP)

User-erstellte Terrains werden im Vault gespeichert:

```
Vault/SaltMarcher/data/
└── terrain/
    └── fey-forest.json         # User-erstellte Custom-Terrains
```

Bundled Presets und User Terrains werden zur Laufzeit gemerged.
User-Terrains koennen Bundled-Terrains ueberschreiben (gleiche ID).

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| TerrainDefinition Schema | ✓ | | Kern-Entity |
| movementCost | ✓ | | Travel-Integration |
| encounterModifier | ✓ | | Encounter-Integration |
| nativeCreatures | ✓ | | Encounter-Matching |
| Auto-Sync mit Creatures | ✓ | | Bidirektionale Konsistenz |
| weatherRanges | ✓ | | Weather-Generierung |
| TileClimateModifiers | ✓ | | Tile-Level Klima-Anpassungen |
| Custom Terrains | ✓ | | User-erstellte Terrains |
| Default-Terrain Presets | ✓ | | Mitgelieferte Basis-Terrains |
| Terrain-Icons | | niedrig | Visuelle Verbesserung |

---

*Siehe auch: [Creature.md](Creature.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md) | [EntityRegistry.md](../architecture/EntityRegistry.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
