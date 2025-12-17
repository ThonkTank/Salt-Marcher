# Map-Navigation

> **Lies auch:** [Map](Map.md), [POI](POI.md)
> **Wird benoetigt von:** Travel, Map-Feature

Navigation zwischen Maps via EntrancePOIs.

**Design-Philosophie:** Map-Navigation ist GM-gesteuert, nicht automatisch. EntrancePOIs verbinden Maps - der GM entscheidet wann die Party eine Sub-Map betritt.

> **Fuer das POI-System siehe:** [POI.md](POI.md)

---

## Uebersicht

```
Party steht auf Tile mit EntrancePOI
        │
        ▼
Tile Content Panel zeigt [Betreten]-Button
        │
        ▼
GM klickt [Betreten]
        │
        ▼
map:navigate-requested
        │
        ▼
Map-Feature laedt neue Map
        │
        ▼
Party spawnt am Ziel-Tile
        │
        ▼
Journal-Entry wird erstellt
```

**Wichtig:** Party kann ueber Tiles mit EntrancePOIs hinweg reisen ohne sie zu betreten. Der GM entscheidet aktiv.

---

## Navigation-Events

```typescript
// Request: GM will navigieren (via EntrancePOI)
'map:navigate-requested': {
  targetMapId: EntityId<'map'>;
  sourcePOIId?: EntityId<'poi'>;
}

// Success: Navigation abgeschlossen
'map:navigated': {
  previousMapId: EntityId<'map'>;
  newMapId: EntityId<'map'>;
  spawnPosition: HexCoordinate;
}

// Kein 'map:back-requested' - Navigation nur via Exit-POI
```

---

## Travel-State bei Map-Wechsel

Map-Wechsel nur moeglich wenn Travel **beendet oder abgebrochen**.

| Travel-State | Map-Navigation moeglich? |
|--------------|--------------------------|
| `idle` | Ja |
| `planning` | Ja (Route wird verworfen) |
| `traveling` | **Nein** - muss erst beendet/abgebrochen werden |
| `paused` | **Nein** - muss erst beendet/abgebrochen werden |

**UI-Hinweis:** "Betreten"-Button disabled mit Tooltip "Travel zuerst beenden".

---

## Spawn-Position Bestimmung

| Situation | Verhalten |
|-----------|-----------|
| `spawnPosition` im EntrancePOI definiert | Party spawnt dort |
| Bidirektionaler Link | Party spawnt am EntrancePOI-Tile der Target-Map |
| Kein `targetTile` | Party spawnt am `defaultSpawnPoint` der Map |
| Mehrere Eingaenge | GM waehlt aus Liste im Navigation-Dialog |

---

## Navigation via Exit-POI

**Entscheidung:** Keine Quick-Exit Buttons - Party muss physisch zum Exit navigieren.

### Warum Exit-POI statt "Zurueck"-Button?

| Aspekt | Exit-POI | Quick-Exit Button |
|--------|----------|-------------------|
| Immersion | Hoch - realistische Navigation | Niedrig - "Teleport" |
| GM-Kontrolle | Volle Kontrolle ueber Routing | Automatisch |
| Mehrere Ausgaenge | Natuerlich unterstuetzt | Komplex |
| Implementierung | Einfacher (ein Pattern) | Zusaetzliche Logik |

### Flow

```
Party im Dungeon
    │
    ├── Will zurueck zur Weltkarte
    │
    ├── Navigiert zum Exit-Tile (EntrancePOI mit linkedMapId)
    │
    ├── GM klickt [Verlassen]
    │
    └── Party spawnt auf verlinktem Tile der Ziel-Map
```

### Journal-Entries fuer Tracking

Journal-Entries tracken Map-Besuche - aber **nicht fuer automatische Rueck-Navigation**:

```typescript
// Automatisch erstellt bei Betreten einer Map
'worldevents:journal-added': {
  entry: {
    type: 'arrival',
    timestamp: currentTime,
    data: {
      mapId: targetMapId,
      poiId?: targetPOIId,
      previousMapId: sourceMapId,
      position: spawnPosition
    }
  },
  source: 'system'
}
```

**Nutzen:** GM sieht History in Almanac Timeline, aber Navigation erfolgt immer via Exit-POI.

---

## Position nach Rueckkehr

Party spawnt auf dem **Ziel-Tile des Exit-POI** - nicht automatisch am Ursprungs-Tile.

```
Party auf World-Map Tile (5,3)
    │
    ├── Betritt Dungeon via EntrancePOI (linkedMapId → Dungeon, spawnPosition → Exit-Tile)
    │
    ├── [Dungeon-Exploration]
    │
    └── Navigiert zum Exit-Tile im Dungeon
        │
        └── Exit-POI hat linkedMapId → World-Map, spawnPosition → (5,3)
            │
            └── Party spawnt auf (5,3)
```

**Bidirektionale Links:** Entrance und Exit verweisen aufeinander - "wohin als naechstes" hat immer eine eindeutige Antwort.

### Mehrere Ausgaenge

Wenn ein Dungeon mehrere Ausgaenge hat:
- Jeder Ausgang ist ein separater Exit-POI
- Jeder Exit-POI verlinkt zu einem anderen Tile auf der Ziel-Map
- Beispiel: Nordausgang → Tile (5,4), Suedausgang → Tile (5,2)

---

## Multi-POI-Tiles

Ein Tile kann mehrere EntrancePOIs haben (z.B. Kreuzung):
- Tile Content Panel zeigt alle EntrancePOIs als Liste
- GM waehlt den gewuenschten Eingang aus

---

## Bidirektionale Links

Fuer eine vollstaendige Verbindung zwischen Maps muessen **zwei EntrancePOIs** erstellt werden:
- Ein EntrancePOI auf der Quell-Map (z.B. Dungeon-Eingang auf Overworld)
- Ein EntrancePOI auf der Ziel-Map (z.B. Ausgang im Dungeon)
- Der GM legt beide explizit an
- Beide verweisen aufeinander via `linkedMapId` und `spawnPosition`

---

## Movement auf verschiedenen Map-Typen

| Map-Typ | Bewegungssystem |
|---------|-----------------|
| **Overworld** | Hex-basiertes Travel (Start → Waypoints → Ziel ueber Tiles) |
| **Town** | Strassen-basiertes Travel (Start → Waypoints → Ziel entlang Strassen/Pfade) |
| **Dungeon** | Grid-basiertes Movement (5-foot Tiles, Zeit basiert auf Geschwindigkeit) |

Jeder Map-Typ hat sein eigenes Bewegungssystem - Details in den jeweiligen Feature-Docs.

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| EntrancePOI-Schema | ✓ | |
| Tile Content Panel | ✓ | |
| Betreten-Button | ✓ | |
| History via Journal | ✓ | |
| Bidirektionale Links (zwei POIs) | ✓ | |
| Multi-POI-Tiles | | mittel |

---

*Siehe auch: [POI.md](POI.md) | [Map-Feature.md](../features/Map-Feature.md) | [Travel-System.md](../features/Travel-System.md)*
