# Schema: PathDefinition

> **Produziert von:** [Cartographer](../views/Cartographer.md) (Path-Tool)
> **Konsumiert von:** [Travel](../features/Travel-System.md) (Speed-Modifikation via Multiplikatoren), [Encounter](../services/encounter/Encounter.md) (Creature-Pool-Erweiterung)

Lineare Kartenelemente: Strassen, Fluesse, Schluchten, Klippen. Verbinden Hex-Zentren und modifizieren Bewegung als Multiplikatoren auf Terrain-Werte.

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'path'> | Eindeutige ID | Required |
| mapId | EntityId<'map'> | Zugehoerige Map | Required |
| pathType | PathType | Pfad-Kategorie | Required |
| name | string | Anzeigename | Optional |
| waypoints | HexCoordinate[] | Geometrie | Required, min. 2 Punkte |
| movement | PathMovement | Bewegungs-Modifikatoren | Required |
| directional | PathDirectionality | Richtungsabhaengig | Optional |
| encounterModifier | PathEncounterModifier | Encounter-Anpassungen | Optional |
| environmentModifier | PathEnvironmentModifier | Umgebungs-Anpassungen | Optional |
| displayStyle | PathDisplayStyle | Visuelle Darstellung | Required |
| description | string | Beschreibung | Optional |
| gmNotes | string | GM-Notizen | Optional |

## Sub-Schemas

### PathType

```typescript
type PathType = 'road' | 'river' | 'ravine' | 'cliff' | 'trail';
```

| Typ | Bedeutung | Typische Verwendung |
|-----|-----------|---------------------|
| `road` | Strasse | Beschleunigt Reisen |
| `trail` | Pfad | Leichte Beschleunigung |
| `river` | Fluss | Erfordert Boot, Wasser-Kreaturen |
| `ravine` | Schlucht | Dim light, windgeschuetzt |
| `cliff` | Klippe | Barriere oder Umweg |

### PathMovement

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| defaultModifier | number | Multiplikator (1.3 = 30% schneller) |
| transportModifiers | Record<TransportMode, number>? | Transport-spezifische Werte |
| blocksMovement | boolean? | Komplett unpassierbar |
| requiresTransport | TransportMode[]? | Erforderliche Transport-Modi |

### PathDirectionality

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| enabled | boolean | Richtungsabhaengig aktiv |
| forwardSpeedModifier | number | Flussabwaerts-Multiplikator |
| backwardSpeedModifier | number | Flussaufwaerts-Multiplikator |

### PathEncounterModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| creaturePool | EntityId<'creature'>[]? | Zusaetzliche Kreaturen |
| chanceModifier | number? | Encounter-Chance-Multiplikator |

### PathEnvironmentModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| lightingOverride | 'bright' \| 'dim' \| 'dark'? | Licht-Override |
| weatherModifier | Partial<ClimateProfile>? | Wetter-Anpassung |

### PathDisplayStyle

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| color | string | Linienfarbe (Hex) |
| width | number | Linienbreite (Pixel) |
| pattern | 'solid' \| 'dashed' \| 'dotted' | Linienmuster |
| icon | string? | Icon am Start/Ende |

## Invarianten

- `waypoints` muss mindestens 2 Koordinaten enthalten
- `waypoints` bilden eine durchgehende Linie zwischen Hex-Zentren
- Pfad-Multiplikatoren werden auf Terrain-Werte angewendet, nicht ersetzt
- `blocksMovement: true` verhindert jegliche Passage
- `requiresTransport` erzwingt spezifischen Transport-Modus

## Beispiel

```typescript
const tradeRoad: PathDefinition = {
  id: 'trade-road-001' as EntityId<'path'>,
  mapId: 'overworld' as EntityId<'map'>,
  pathType: 'road',
  name: 'Alte Handelsstrasse',
  waypoints: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: -1 },
    { q: 4, r: -1 }
  ],
  movement: {
    defaultModifier: 1.3
  },
  encounterModifier: {
    creaturePool: ['bandit' as EntityId<'creature'>],
    chanceModifier: 1.2
  },
  displayStyle: {
    color: '#8B4513',
    width: 3,
    pattern: 'solid'
  },
  description: 'Eine gut erhaltene Handelsroute zwischen den Staedten.'
};
```
