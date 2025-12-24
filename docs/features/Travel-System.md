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
idle → planning → traveling ↔ paused → idle (on completion)
```

> **Note:** Nach Reise-Abschluss wird direkt auf `idle` zurueckgesetzt.
> Das `travel:completed` Event signalisiert die Ankunft.

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

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1 | ✅ | Travel | features | State-Machine: idle → planning → traveling ↔ paused → idle | hoch | Ja | - | Travel-System.md#state-machine, Events-Catalog.md#travel | travel-store.ts:setPlanning/setTraveling/setPaused/setResumed/setIdle |
| 3 | ✅ | Travel | features | Speed-Berechnung: Basis-Speed × Terrain-Faktor × Weather-Faktor | hoch | Ja | - | Travel-System.md#speed-berechnung, Character-System.md#travel-system | types.ts:calculateHexTraversalTime, travel-service.ts:getBaseSpeed |
| 5 | ✅ | Travel | features | Terrain-Faktoren aus TerrainDefinition.movementCost lesen | hoch | Ja | #3, #1700 | Travel-System.md#terrain-faktoren, Terrain.md#verwendung-in-anderen-features, Map-Feature.md#overworld-rendering | travel-service.ts:calculateSegmentTime (via mapFeature.getMovementCost) |
| 7 | ✅ | Travel | features | Zeit-Integration via time:advance-requested | hoch | Ja | #1, #908 | Travel-System.md#tagesreise-berechnung, Time-System.md#zeit-operationen, Events-Catalog.md#time | travel-service.ts:publishTimeAdvance |
| 9 | ✅ | Travel | features | Encounter-Checks pro Stunde (12.5% Basis-Chance) | hoch | Ja | #1, #7, #215 | Travel-System.md#encounter-checks-waehrend-reisen, Encounter-System.md#aktivierungs-flow, Map-Feature.md#overworld-tiles | travel-service.ts:checkForEncounter, encounter-chance.ts:calculateEncounterChance/rollEncounter |
| 11 | ✅ | Travel | features | Pause/Resume Funktionalität | hoch | Ja | #1 | Travel-System.md#state-machine, Events-Catalog.md#travel | travel-service.ts:pauseTravelInternal/resumeTravelInternal, travel-store.ts:setPaused/setResumed |
| 12 | ✅ | Travel | features | Event-Flow: travel:plan-requested → route-planned → start-requested → started → position-changed → completed | hoch | Ja | #1, #2 | Travel-System.md#event-flow, Events-Catalog.md#travel, SessionRunner.md#travel-integration | travel-service.ts:publishRoutePlanned/publishTravelStarted/publishPositionChanged/publishTravelCompleted/publishStateChanged |
| 14 | ⬜ | Travel | features | validateTransportAvailable(): Prüfe activeTransport in party.availableTransports bei plan-requested + Fehler-Event | hoch | Ja | #4 | Travel-System.md#transport-mode-invarianten, Character-System.md#character-schema | travel-service.ts:validateTransportAvailable [neu], party-service.ts:setActiveTransport [ändern] |
| 16 | 📋 | Travel | features | travel:failed Event bei Transport-Invarianten-Verletzung publizieren | hoch | Ja | #15 | Travel-System.md#transport-mode-invarianten, Error-Handling.md, Events-Catalog.md#travel | travel-service.ts:publishTravelFailed [neu], setupEventHandlers [ändern] |
| 18 | ⛔ | Travel | features | Travel: Pfad-Barrieren-Validierung implementieren (blocksMovement prüfen, requiresTransport gegen Party-Transport validieren) | mittel | Nein | #17, #1811, #1812 | Travel-System.md#pfad-modifikation-post-mvp, Path.md#pathmovement, Path.md#travel-system | travel-service.ts:getPathMultiplier [ändern], validateTraversable [ändern] |
| 20 | ⛔ | Travel | features | consumeRations(): Automatischer Rationen-Abzug bei Long Rest während Reise (1 pro Character) | mittel | Nein | #7, #605, #608 | Travel-System.md#tagesreise-berechnung, Inventory-System.md#rationen, Character-System.md#character-schema | party-service.ts:consumeRations [neu], travel-service.ts:processNextTravelTick [ändern] |
| 2 | ✅ | Travel | features | planRouteInternal(): Greedy-Pathfinding mit Waypoint-Support + Route-Validierung | hoch | Ja | #1 | Travel-System.md#event-flow, Map.md#hex-coordinate-system | travel-service.ts:planRouteInternal/planRouteWithWaypointsInternal/findPathGreedy/buildRoute |
| 4 | ✅ | Travel | features | Transport-Modi: foot, mounted, carriage, boat mit Terrain-Restriktionen | hoch | Ja | #3 | Travel-System.md#transport-modi | schemas/party.ts:TRANSPORT_BASE_SPEEDS, travel-service.ts:validateTraversable |
| 6 | ✅ | Travel | features | Weather-Faktoren anwenden (clear, rain, storm, etc.) | hoch | Ja | #3, #110 | Travel-System.md#weather-faktoren, Weather-System.md#travel-integration | travel-service.ts:getWeatherSpeedFactor |
| 8 | ✅ | Travel | features | processNextTravelTick(): Animierte Position-Updates + travel:position-changed Events | hoch | Ja | #2 | Travel-System.md#event-flow, SessionRunner.md#travel-integration | travel-service.ts:processNextTravelTick, travel-store.ts:advanceMinutesElapsed |
| 10 | ✅ | Travel | features | Population-Modifikator für Encounter-Chance | hoch | Ja | #9 | Travel-System.md#population-modifikator | encounter-chance.ts:getPopulationFactor, travel-service.ts:getPopulationAt |
| 13 | ✅ | Travel | features | Position-Ownership: Party als Single Source of Truth | hoch | Ja | - | Travel-System.md#position-ownership | party-service.ts:setPosition (aufgerufen von travel-service.ts) |
| 15 | ⛔ | Travel | features | planRouteInternal(): Validierung für Terrain-Restriktionen + Transport-Invariante (#14) mit travel:failed Event | hoch | Ja | #14 | Travel-System.md#validation-zeitpunkte | travel-service.ts:validateTraversable, planRouteInternal [ändern] |
| 17 | ⬜ | Travel | features | Travel: PathDefinition-Integration in Speed-Berechnung (calculateSegmentTime mit Path-Multiplikatoren erweitern) | mittel | Nein | #3, #5, #1811 | Travel-System.md#pfad-modifikation-post-mvp, Path.md#pathmovement | travel-service.ts:getPathMultiplier [neu], calculateSegmentTime [ändern] |
| 19 | ⛔ | Travel | features | Travel: PathDirectionality-Support für Fluss-Strömung (forwardSpeedModifier/backwardSpeedModifier in Speed-Berechnung) | niedrig | Nein | #17, #18, #1806 | Travel-System.md#pfad-modifikation-post-mvp | travel-service.ts:getPathMultiplier [ändern] |
| 21 | ⛔ | Travel | features | checkForcedMarch(): 10h/Tag + CON-Save DC 10+1 pro extra Stunde → Erschöpfung | niedrig | Nein | #7, #20 | Travel-System.md#standard-reisestunden | party-service.ts:addExhaustion [neu], travel-service.ts:checkForcedMarch [neu] |
| 3159 | ⬜ | Travel | features | calculateTilePopulation(): Summe(Faction.presence × memberCount / Territory-Größe) für Encounter-Chance | mittel | --deps | #10, #1409 | Travel-System.md#population-berechnung, Faction.md#praesenz-vorberechnung | - |
