# Glossary

> **Lies auch:** [Data.md](Data.md), [Features.md](Features.md), [Application.md](Application.md), [EventBus.md](EventBus.md)
> **Wird benoetigt von:** Bei Begriffsfragen

Zentrale Begriffsdefinitionen fuer SaltMarcher.

---

## Architektur-Begriffe

### Layer

| Begriff | Definition |
|---------|------------|
| **Core Layer** | Gemeinsame Grundlagen: Typen, Schemas, Events, Utils. Keine Abhaengigkeiten zu anderen Layern. Pfad: `src/core/` |
| **Feature Layer** | Business Logic und State. Jedes Feature ist eigenstaendig mit State-Machine und StoragePort. Pfad: `src/features/` |
| **Infrastructure Layer** | Adapter fuer externe Systeme (Vault, Audio). Implementiert Feature-StoragePorts. Pfad: `src/infrastructure/` |
| **Application Layer** | UI-Komponenten, ViewModels, Rendering. Pfad: `src/application/` |

**Dependency-Regel:** Obere Layer duerfen untere importieren, nie umgekehrt.

```
Application     → Features → Core
                     ↓
               Infrastructure
```

---

### Entity-System

| Begriff | Definition |
|---------|------------|
| **Entity** | Persistierte Daten-Einheit mit eindeutiger ID. Beispiele: Creature, Item, NPC, Faction |
| **EntityId<T>** | Typsichere ID mit Branded Type. `EntityId<'creature'>` kann nicht mit `EntityId<'item'>` verwechselt werden |
| **EntityType** | Union aller unterstuetzten Entity-Typen (15 MVP): `'creature' \| 'character' \| 'npc' \| 'faction' \| 'item' \| 'culture' \| 'map' \| 'poi' \| 'terrain' \| 'quest' \| 'encounter' \| 'shop' \| 'calendar' \| 'journal' \| 'worldevent' \| 'track'` |
| **EntityRegistry** | Generisches Feature fuer CRUD-Operationen auf allen Entity-Typen. Single Source of Truth fuer persistente Entities |

**Beispiel:**
```typescript
type CreatureId = EntityId<'creature'>;  // Branded Type
const creature = entityRegistry.get('creature', creatureId);  // Type-safe Query
```

---

### Feature-Typen

| Begriff | Definition |
|---------|------------|
| **Primary Feature** | Feature mit State-Machine, reagiert auf `*-requested` Commands. Beispiele: Map, Travel, Combat, TimeTracker |
| **Reactive Feature** | Feature ohne eigene Commands, reagiert auf Events anderer Features. State ist abgeleitet oder generiert. Beispiel: Environment |
| **Hybrid Feature** | Primaer reaktiv, aber mit optionalen Steuer-Commands. Beispiel: Audio |

---

### Kommunikation

| Begriff | Definition |
|---------|------------|
| **EventBus** | Zentrales Event-System fuer Cross-Feature-Kommunikation. Typisierte Events mit `correlationId` fuer Workflow-Tracking |
| **DomainEvent** | Typisiertes Event mit `type`, `payload`, `correlationId`, `timestamp`, `source` |
| **StoragePort** | Interface das ein Feature definiert fuer Persistenz. Infrastructure-Adapter implementieren diese Ports |
| **correlationId** | UUID die zusammengehoerige Events verknuepft. Wird bei Event-Reaktionen uebernommen |

**Event-Pattern:**
```typescript
// Request (ViewModel → Feature)
eventBus.publish('travel:start-requested', { routeId });

// Response (Feature → ViewModel)
eventBus.publish('travel:started', { ... });
eventBus.publish('travel:start-failed', { error }); // Bei Fehler
```

---

### MVVM Pattern

| Begriff | Definition |
|---------|------------|
| **View** | Obsidian ItemView Container. Enthaelt Panels, delegiert an ViewModel |
| **ViewModel** | State-Management und Koordination. 1:1 Beziehung zur View |
| **Panel** | UI-Bereich innerhalb einer View. Spricht nur mit ViewModel, nicht direkt mit Features |
| **ToolView** | Komplette Editor-Ansicht (Cartographer, Almanac, Library). Besteht aus View + ViewModel + Panels |
| **RenderHint** | Optimierungs-Signal vom ViewModel (`'full'`, `'tiles'`, `'camera'`, etc.) |

---

### Type-System

| Begriff | Definition |
|---------|------------|
| **Branded Type** | TypeScript-Typ mit Runtime-Tag fuer Type-Safety. Verhindert Verwechslung von IDs |
| **Result<T, E>** | Union-Typ fuer fehlbare Operationen: `Ok<T> \| Err<E>`. Kein `throw`, explizite Fehlerbehandlung |
| **Option<T>** | Union-Typ fuer optionale Werte: `Some<T> \| None`. Ersetzt `null \| undefined` |
| **Zod Schema** | Runtime-Validierung mit Type-Inferenz. Schema definiert Struktur, Type wird daraus abgeleitet |
| **Timestamp** | Branded `number` fuer Unix-Millisekunden |

---

## Domain-Begriffe

### Map-System

| Begriff | Definition |
|---------|------------|
| **Map** | Container fuer ortsgebundene Daten. Drei Typen: Overworld, Town, Dungeon |
| **OverworldMap** | Hex-basierte Weltkarte mit Terrain, POIs, EncounterZones |
| **TownMap** | Strassen-basierte Stadtkarte ohne Tiles. Buildings, Streets, NPCs |
| **DungeonMap** | Grid-basierte Karte mit 5-foot Tiles. Walls, Floors, Traps, Tokens |
| **Tile** | Einzelne Zelle auf einer Map. OverworldTile (Hex) oder DungeonTile (Grid) |

---

### Koordinaten

| Begriff | Definition |
|---------|------------|
| **HexCoordinate** | Axiale Hex-Koordinate mit `q` und `r`. Verwendet fuer OverworldMap |
| **GridCoordinate** | 3D-Grid-Koordinate mit `x`, `y`, `z` (Level). Verwendet fuer DungeonMap |
| **Point** | 2D-Pixel-Koordinate fuer Town-Rendering und UI |

---

### POIs & Navigation

| Begriff | Definition |
|---------|------------|
| **POI** | Point of Interest auf einer Map. Unified System fuer Eingaenge, Fallen, Schaetze, Landmarken, Objekte |
| **EntrancePOI** | POI-Typ mit `linkedMapId` fuer Map-Navigation (Dungeon-Eingang, Portal, Ausgang) |
| **Navigation** | Wechsel zwischen Maps via EntrancePOIs. GM-gesteuert, nicht automatisch |

---

### Kreaturen & NPCs

| Begriff | Definition |
|---------|------------|
| **CreatureDefinition** | Template/Statblock. Persistiert in EntityRegistry. "Goblin, CR 1/4, 7 HP" |
| **Creature** | Runtime-Instanz in Encounter. Nicht persistiert. "Goblin #1, aktuell 5 HP" |
| **NPC** | Benannte persistente Kreatur-Instanz mit Persoenlichkeit. "Griknak der Hinkende" |

**Lebenszyklus:**
```
CreatureDefinition (Template) → Creature (Runtime) → NPC (falls benannt/persistiert)
```

---

### Encounter

| Begriff | Definition |
|---------|------------|
| **EncounterDefinition** | Vordefiniertes Encounter-Template mit CreatureSlots |
| **EncounterInstance** | Konkretes Encounter zur Laufzeit mit aufgeloesten NPCs |
| **CreatureSlot** | Platzhalter in Definition. Wird bei Trigger zu konkreten Kreaturen aufgeloest |
| **Lead-NPC** | Hauptansprechpartner eines Encounters. Wird immer persistiert |

---

### Zeit & Kalender

| Begriff | Definition |
|---------|------------|
| **GameDateTime** | In-Game-Datum und Uhrzeit im aktiven Kalendersystem |
| **CalendarDefinition** | Kalender-Konfiguration (Monate, Tage, Feiertage). Gregorian, Harptos, Custom |
| **TimeSegment** | Tagesabschnitt: `dawn`, `morning`, `midday`, `afternoon`, `dusk`, `night` |
| **WorldEvent** | Geplantes Kalender-Event (Feste, Mondzyklen). Vom GM erstellt. Einmalige werden nach Trigger geloescht, wiederkehrende bleiben |
| **JournalEntry** | Log-Eintrag (arrival, combat, encounter, rest, quest_progress, death, worldevent, note). System oder manuell erstellt |

---

### Items & Inventar

| Begriff | Definition |
|---------|------------|
| **Item** | Gegenstand mit physischen Eigenschaften (Gewicht, Wert) und Tags fuer Kategorisierung |
| **ItemCategory** | Hauptkategorie: `weapon`, `armor`, `consumable`, `gear`, `treasure` |
| **Tags** | Freie Schlagworte fuer Loot-Matching: `martial`, `tribal`, `arcane`, etc. |
| **Rarity** | Seltenheitsstufe: `common`, `uncommon`, `rare`, `very-rare`, `legendary` |

---

### Party & Travel

| Begriff | Definition |
|---------|------------|
| **Party** | Spielergruppe mit Position, Members, Inventar |
| **Party.position** | Single Source of Truth fuer Party-Position. Nur Hex-Koordinate, keine Animation |
| **Travel** | Reise-Workflow mit Route, Animation, Encounter-Checks |
| **TransportMode** | Fortbewegungsart: `foot`, `mounted`, `carriage`, `boat` |

---

### Fraktionen

| Begriff | Definition |
|---------|------------|
| **Faction** | Gruppierung mit Territory, Kultur, Beziehungen zu anderen Factions |
| **Faction-Hierarchie** | Parent-Child-Beziehung. Child erbt Kultur-Attribute vom Parent |
| **Presence** | Einfluss einer Faction auf einem Tile. Bestimmt Encounter-Wahrscheinlichkeit |
| **Culture** | Kultur-Definition in Faction: Namens-Patterns, Persoenlichkeiten, Quirks |

---

## Abkuerzungen

| Abkuerzung | Bedeutung |
|------------|-----------|
| **CRUD** | Create, Read, Update, Delete - Basis-Operationen auf Entities |
| **MVVM** | Model-View-ViewModel - UI-Architektur-Pattern |
| **POI** | Point of Interest - Unified Entity fuer Tile-Content (Eingaenge, Fallen, Schaetze, etc.) |
| **CR** | Challenge Rating - D&D Schwierigkeitsgrad fuer Kreaturen |
| **XP** | Experience Points - Erfahrungspunkte |
| **GM** | Game Master - Spielleiter |

---

