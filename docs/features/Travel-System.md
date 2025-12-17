# Travel-System

> **Lies auch:** [Map-Feature](Map-Feature.md), [Time-System](Time-System.md), [Weather-System](Weather-System.md)
> **Wird benoetigt von:** SessionRunner

Detaillierte Spezifikation des Reisesystems.

---

## Scope: Hex-Overland

Das Travel-Feature ist **spezifisch fuer Hex-Overland-Maps** (Weltreisen):

| Map-Typ | Movement-Modus | Zeit-Einheit | Travel-Feature? |
|---------|---------------|--------------|-----------------|
| **Hex (Overland)** | Route mit Animation | Stunden (4h-Segmente) | **Ja** |
| **Town** | POI-Navigation | Minuten pro Aktivitaet | Nein |
| **Dungeon Exploration** | Raum-zu-Raum | 10-Minuten-Runden | Nein |
| **Dungeon Combat** | Grid (5ft) | Runden (6 Sekunden) | Nein |

**Town/Dungeon nutzen direktes Zeit-Vorrücken** via `time:advance-requested`, nicht das Travel-Feature.

---

## State-Machine

```
idle → planning → traveling ↔ paused → arrived
```

---

## Speed-Berechnung

### Basis-Formel

```
Effektive Geschwindigkeit = Basis-Speed × Terrain-Faktor × Weather-Faktor × Pfad-Multiplikator
```

**Hinweis:** Der Pfad-Multiplikator ist ein Post-MVP Feature. Siehe [Pfad-Modifikation](#pfad-modifikation-post-mvp) weiter unten.

### Transport-Modi

| Modus | Basis-Speed (Meilen/Stunde) | Terrain-Restriktionen |
|-------|----------------------------|----------------------|
| `foot` | 3 | Keine |
| `mounted` | 6 | Kein dichter Wald, kein Sumpf |
| `carriage` | 4 | Nur Strassen |
| `boat` | 4 | Nur Wasser |

### Terrain-Faktoren

Terrain-Faktoren werden aus `TerrainDefinition.movementCost` gelesen:

```typescript
function getTerrainFactor(tile: OverworldTile): number {
  const terrain = entityRegistry.get('terrain', tile.terrain);
  return terrain.movementCost;  // z.B. 0.6 fuer Forest
}
```

**Default-Werte der mitgelieferten Terrains:**

| Terrain | movementCost | Anmerkung |
|---------|--------------|-----------|
| `road` | 1.0 | Standard |
| `plains` | 0.9 | Leicht verlangsamt |
| `forest` | 0.6 | Dichtes Unterholz |
| `hills` | 0.7 | Hoehenunterschiede |
| `mountains` | 0.4 | Sehr langsam, nur zu Fuss |
| `swamp` | 0.5 | Schwierig, nur zu Fuss |
| `desert` | 0.7 | Hitze, Sand |
| `water` | 1.0 | Nur mit Boot |

→ Custom Terrains koennen eigene movementCost-Werte definieren. Siehe [Terrain.md](../domain/Terrain.md)

### Weather-Faktoren

| Bedingung | Faktor |
|-----------|--------|
| `clear` | 1.0 |
| `rain` | 0.9 |
| `heavy_rain` | 0.7 |
| `storm` | 0.5 |
| `snow` | 0.7 |
| `blizzard` | 0.3 |
| `fog` | 0.8 |

### Pfad-Modifikation (Post-MVP)

Pfade (Strassen, Fluesse, etc.) modifizieren die Geschwindigkeit wenn die Bewegung **entlang** des Pfades verlaeuft:

```typescript
function getPathMultiplier(
  fromTile: OverworldTile,
  toTile: OverworldTile,
  transport: TransportMode
): number {
  // Suche Pfad der beide Tiles verbindet
  const pathInfo = fromTile.paths.find(p =>
    p.connections.to?.equals(toTile.coordinate)
  );

  if (!pathInfo) return 1.0;  // Kein Pfad = kein Modifier

  const path = getPath(pathInfo.pathId);

  // Barrieren pruefen
  if (path.movement.blocksMovement) {
    throw new TravelError('PATH_BLOCKED');
  }
  if (path.movement.requiresTransport &&
      !path.movement.requiresTransport.includes(transport)) {
    throw new TravelError('TRANSPORT_REQUIRED');
  }

  // Multiplikator bestimmen (transport-spezifisch oder default)
  return path.movement.transportModifiers?.[transport]
    ?? path.movement.defaultModifier;
}
```

**Wichtig:** Der Pfad-Multiplikator gilt nur wenn die Bewegung **entlang** des Pfades verlaeuft, nicht quer dazu.

**Beispiele:**

| Situation | Terrain | Pfad | Multiplikator |
|-----------|---------|------|---------------|
| Strasse durch Sumpf (entlang) | 0.5 | 1.3 | 1.3 |
| Strasse durch Sumpf (quer) | 0.5 | - | 1.0 |
| Fluss mit Boot | 1.0 | 1.5 (boat) | 1.5 |
| Fluss ohne Boot | 1.0 | blocked | Fehler |
| Klippe | - | blocked | Fehler |

> Details: [Path.md](../domain/Path.md)

---

## Tagesreise-Berechnung

### Standard-Reisestunden

- **Normal:** 8 Stunden/Tag
- **Forced March:** 10 Stunden/Tag (Erschoepfungsrisiko)

### Beispiel

Party zu Fuss auf Waldweg bei leichtem Regen:
```
3 mph × 0.6 (Wald) × 0.9 (Regen) = 1.62 mph
8 Stunden × 1.62 mph = 12.96 Meilen/Tag
```

---

## Encounter-Checks waehrend Reisen

### Roll-Frequenz

**Am Anfang jeder vollen Stunde** wird geprueft, ob ein Encounter erscheint.

### Basis-Wahrscheinlichkeit

| Bedingung | Chance/Stunde | ~Encounter alle |
|-----------|---------------|-----------------|
| Wildnis (Standard) | 12.5% | 8 Stunden |

### Population-Modifikator

Die Encounter-Chance wird durch die **Tile-Population** modifiziert:

```
Effektive Chance = Basis-Chance × Population-Faktor
```

| Population | Faktor | ~Encounter alle |
|------------|--------|-----------------|
| Verlassen (0) | ×0.25 | 32h |
| Duenn (25) | ×0.5 | 16h |
| Normal (50) | ×1.0 | 8h |
| Dicht (75) | ×1.5 | 5h |
| Ueberfuellt (100) | ×2.0 | 4h |

### Population-Berechnung

Population ist **kein manueller Wert**, sondern wird abgeleitet:

**MVP:**
```
Tile-Population = Σ (Fraktion.Praesenz × Fraktion.memberCount / Territory-Groesse)
```

**Post-MVP:**
```
Tile-Population = Anzahl NPCs/Kreaturen die diesem Tile zugewiesen sind
```

### Was beeinflusst WAS, nicht OB

Terrain, Wetter und Tageszeit beeinflussen die **Kreatur-Auswahl**, nicht die Encounter-Chance:

| Faktor | Beeinflusst Chance? | Beeinflusst Auswahl? |
|--------|---------------------|----------------------|
| Terrain | Nein | Ja (Filter) |
| Wetter | Nein | Ja (Gewichtung) |
| Tageszeit | Nein | Ja (Filter) |
| Population | **Ja** | Nein |

→ Details zur Kreatur-Auswahl: [Encounter-System.md](Encounter-System.md#kreatur-auswahl)

---

## Event-Flow

```
travel:plan-requested
    │
    ▼
Travel Feature berechnet Route
    │
    ├── travel:route-planned (Route, ETA)
    │
    ▼
travel:start-requested
    │
    ▼
Travel Feature startet Animation
    │
    ├── travel:started
    │
    ├── Loop: travel:position-changed (Position, Progress)
    │   │
    │   ├── Encounter-Check am Stundenanfang (12.5% Basis)
    │   │   └── Bei Encounter: travel:paused + encounter:generate-requested
    │   │
    │   └── time:advance-requested (verstrichene Zeit)
    │
    └── travel:completed
```

---

## Position-Ownership

- **Party** ist Single Source of Truth fuer Position
- **Travel** steuert Animation und requested Position-Updates
- Event-Flow: `travel:moved` → Party subscribt → `party:position-changed`

---

## Transport-Mode Invarianten

### Ownership

| State | Owner | Beschreibung |
|-------|-------|--------------|
| `party.availableTransports` | Party Feature | Was die Party besitzt (Pferde, Boot) |
| `travel.activeTransport` | Travel Feature | Was aktuell genutzt wird |

### Invariante

```typescript
// INVARIANT: activeTransport muss in Party.availableTransports enthalten sein
assert(party.availableTransports.includes(travel.activeTransport));
```

### Validation-Zeitpunkte

| Zeitpunkt | Aktion |
|-----------|--------|
| `travel:plan-requested` | Pruefe ob `transport` in `party.availableTransports` |
| `party:transport-changed` | Pruefe ob aktiver Transport noch verfuegbar |
| Travel Feature init | Fallback auf 'foot' wenn activeTransport ungueltig |

### Fehlerbehandlung

```typescript
'travel:failed': {
  reason: 'no_transport';
  details: 'Horse not available in party';
}
```

### Beispiel

```
Party hat: ['foot', 'mounted']
Travel plant Route mit: 'carriage'

→ travel:failed { reason: 'no_transport', details: 'Carriage not available' }
```

---

## Dungeon-Exploration (Nicht Travel-Feature)

Dungeon-Exploration nutzt **nicht** das Travel-Feature, sondern manuelles Zeit-Tracking:

### 10-Minuten-Runden

| Aktion | Zeit |
|--------|------|
| Raum durchsuchen | 10 Min |
| Tuer/Falle untersuchen | 10 Min |
| Short Rest | 1 Stunde (6 Runden) |
| Zurueck zum Dungeon-Eingang | Variable |

### Tracking-Ressourcen

| Ressource | Verbrauch | Event |
|-----------|-----------|-------|
| Fackel | 1 Stunde (6 Runden) | `time:state-changed` → Countdown |
| Rationen | 1 pro Long Rest | Automatisch bei Rest |
| Spell-Slots | Manuell | Character-Sheet |

### Zeit-Management

```typescript
// GM clickt "10 Minuten vergangen"
eventBus.publish({
  type: 'time:advance-requested',
  payload: {
    duration: { minutes: 10 },
    reason: 'dungeon_exploration'
  }
});

// Consumer (z.B. Fackel-Timer) reagieren auf time:state-changed
```

→ **Details:** [Dungeon-System.md](Dungeon-System.md)

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Route-Planung | ✓ | | Waypoints + Pathfinding |
| Speed-Berechnung | ✓ | | Terrain x Weather x Encumbrance |
| Zeit-Integration | ✓ | | time:advance-requested |
| Animierte Reise | ✓ | | Token-Bewegung |
| Encounter-Checks | ✓ | | Pro Stunde (am Stundenanfang) |
| Pause/Resume | ✓ | | State-Machine |
| **Pfad-Integration** | | ✓ | Direktionsabhaengiger Speed |
| **Pfad-Barrieren** | | ✓ | blocksMovement, requiresTransport |
| **Pfad-Stroemung** | | mittel | Flussabwaerts schneller |
| Resource-Tracking (Rationen) | | mittel | Character-Integration |
| Dungeon-Exploration | | niedrig | Separates System |

---

*Siehe auch: [Map.md](../domain/Map.md) | [Path.md](../domain/Path.md) | [Inventory-System.md](Inventory-System.md) (Encumbrance) | [Weather-System.md](Weather-System.md) | [Encounter-System.md](Encounter-System.md)*
