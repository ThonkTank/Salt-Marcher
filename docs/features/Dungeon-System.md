# Dungeon-System

> **Lies auch:** [Map-Feature](Map-Feature.md), [Combat-System](Combat-System.md)
> **Wird benoetigt von:** SessionRunner

Grid-basierte Dungeon Maps mit Fog of War, Lichtquellen und automatischen Triggern.

**Design-Philosophie:** Dungeon Maps sind ein integriertes, einheitliches Notiz-Tool fuer den GM mit Simulation von Sichtbarkeit, Sound und automatischen Triggern.

**Status:** MVP. Voller Feature-Scope inklusive Grid, Fog of War, Rooms, Lighting, Traps, Creature Tokens.

---

## Uebersicht

Das Dungeon-System bietet:

1. **Dungeon Map** - Grid-basierte Karte mit Raeumen, Tueren, Fallen
2. **Tile-Inhalte** - Fallen, Tueren, Gegner, POIs, Treasure auf der Map
3. **One-Click Notes** - Klick auf Tile zeigt DetailView
4. **Fog of War** - Was Characters sehen koennen
5. **Darkness** - Lichtquellen, Darkvision simuliert
6. **Sound Propagation** - Was Characters/NPCs hoeren koennen
7. **Auto-Trigger** - Fallen loesen aus wenn Spieler drueberlaufen

```
┌─────────────────────────────────────────────────────────────────┐
│  Dungeon Map                                                     │
├─────────────────────────────────────────────────────────────────┤
│  Grid-basierte Tiles                                             │
│  ├── Walls, Floors, Doors                                        │
│  ├── Rooms (Tile-Gruppierung)                                    │
│  └── Contents (Creatures, Traps, Treasure)                       │
├─────────────────────────────────────────────────────────────────┤
│  Simulation                                                      │
│  ├── Fog of War (Explored/Unexplored)                            │
│  ├── Lighting (Bright/Dim/Dark)                                  │
│  └── Sound Propagation (Alert NPCs)                              │
├─────────────────────────────────────────────────────────────────┤
│  Interaktion                                                     │
│  ├── Party bewegen → Trigger pruefen                             │
│  ├── Tile klicken → Details anzeigen                             │
│  └── Raum klicken → Inhaltsuebersicht                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schemas (Vorschlag)

### DungeonMap

```typescript
interface DungeonMap {
  id: EntityId<'dungeon'>;
  name: string;
  gridSize: { width: number; height: number };

  tiles: DungeonTile[][];     // 2D Grid
  rooms: DungeonRoom[];

  partyPosition: GridPosition;
}

interface GridPosition {
  x: number;
  y: number;
}
```

### DungeonTile

```typescript
interface DungeonTile {
  position: GridPosition;
  type: 'floor' | 'wall' | 'door' | 'secret-door';

  roomId?: string;            // Zugehoeriger Raum
  contents: DungeonTileContent[];

  lighting: 'bright' | 'dim' | 'dark';
  explored: boolean;          // Fog of War
}
```

### DungeonTileContent

```typescript
interface DungeonTileContent {
  type: 'trap' | 'creature' | 'treasure' | 'object' | 'poi';
  id: string;

  visible: boolean;           // Fuer versteckte Fallen etc.
  notes?: string;             // GM-Notizen

  // Typ-spezifische Felder
  // trap: { dc: number; damage: string; triggered: boolean }
  // creature: { creatureId: EntityId<'creature'>; count: number }
  // treasure: { contents: string; looted: boolean }
  // etc.
}
```

### DungeonRoom

```typescript
interface DungeonRoom {
  id: string;
  name: string;
  tiles: GridPosition[];      // Alle Tiles des Raums

  description: string;        // Read-aloud Text
  gmNotes?: string;

  // Aggregiert aus Tiles
  contents: DungeonTileContent[];
}
```

---

## Automatische Trigger

```
Party bewegt sich auf Tile
    │
    ├── Pruefe: Versteckte Falle?
    │   ├── Passive Perception >= Trap DC → "Falle entdeckt!"
    │   └── Passive Perception < Trap DC → Falle loest aus
    │
    ├── Pruefe: Tuer?
    │   └── UI-Prompt: "Tuer. Oeffnen?"
    │
    ├── Pruefe: Creature?
    │   └── Trigger Encounter-Generation
    │
    └── Update: Fog of War, Sichtbarkeit
```

---

## Simulation

### Sicht (Line of Sight)

```
┌───┬───┬───┬───┬───┐
│ ░ │ ░ │ . │ . │ . │
├───┼───┼───┼───┼───┤
│ ░ │ ░ │ . │ P │ . │   P = Party
├───┼───┼───┼───┼───┤   . = Sichtbar
│ ░ │ ░ │ # │ . │ . │   # = Wand (blockiert Sicht)
├───┼───┼───┼───┼───┤   ░ = Unexplored (Fog of War)
│ ░ │ ░ │ # │ . │ . │
├───┼───┼───┼───┼───┤
│ ░ │ ░ │ ░ │ ░ │ ░ │
└───┴───┴───┴───┴───┘
```

### Licht

| Quelle | Radius (Bright) | Radius (Dim) |
|--------|-----------------|--------------|
| Torch | 20 ft | 40 ft |
| Lantern | 30 ft | 60 ft |
| Light Cantrip | 20 ft | 40 ft |
| Darkvision | - | 60 ft (Dim only) |

### Sound

```
Sound-Event: Kampf in Raum A
    │
    ├── Raum A: Creatures hoeren es (100%)
    │
    ├── Angrenzende Raeume: Durch Tueren gedaempft
    │   └── Offene Tuer: 80% hoerbar
    │   └── Geschlossene Tuer: 30% hoerbar
    │
    └── Entfernte Raeume: Nicht hoerbar
```

---

## GM-Interface

### Map-Ansicht

```
┌─────────────────────────────────────────────────────────┐
│  Goblin Cave - Level 1                                   │
├─────────────────────────────────────────────────────────┤
│  ┌───┬───┬───┬───┬───┬───┬───┬───┐                      │
│  │ # │ # │ # │ # │ # │ # │ # │ # │                      │
│  ├───┼───┼───┼───┼───┼───┼───┼───┤                      │
│  │ # │ . │ . │ D │ ░ │ ░ │ ░ │ # │  P = Party          │
│  ├───┼───┼───┼───┼───┼───┼───┼───┤  . = Explored       │
│  │ # │ . │ P │ . │ ░ │ ░ │ ░ │ # │  ░ = Unexplored     │
│  ├───┼───┼───┼───┼───┼───┼───┼───┤  D = Door           │
│  │ # │ . │ . │ . │ ░ │ ░ │ ░ │ # │  T = Trap           │
│  ├───┼───┼───┼───┼───┼───┼───┼───┤  G = Goblin         │
│  │ # │ # │ # │ # │ # │ # │ # │ # │                      │
│  └───┴───┴───┴───┴───┴───┴───┴───┘                      │
├─────────────────────────────────────────────────────────┤
│  Raum: Entry Hall                                        │
│  "Ein feuchter Tunnel fuehrt in die Dunkelheit..."      │
├─────────────────────────────────────────────────────────┤
│  [GM View] [Player View] [Edit Mode]                    │
└─────────────────────────────────────────────────────────┘
```

### Tile-Detail (Click)

```
┌─────────────────────────────────────────────────────────┐
│  Tile (3, 4) - Entry Hall                                │
├─────────────────────────────────────────────────────────┤
│  Inhalt:                                                 │
│  • Versteckte Falle (DC 14, 2d6 piercing)               │
│  • Truhe (locked, DC 12)                                │
├─────────────────────────────────────────────────────────┤
│  GM-Notizen:                                             │
│  "Falle ist mit Truhe verbunden"                        │
├─────────────────────────────────────────────────────────┤
│  [Falle triggern] [Truhe oeffnen] [Edit]                │
└─────────────────────────────────────────────────────────┘
```

---

## Design-Entscheidungen

### Map-Erstellung

**Entscheidung:** Cartographer mit Dungeon-Modus

Dungeon-Maps werden im Cartographer erstellt (kein separates Tool):

- `MapType: 'dungeon'` aktiviert Dungeon-Modus im Cartographer
- Grid-basiertes Rendering (5-foot Tiles statt Hex)
- Spezielle Tool-Palette: Wall-Tool, Door-Tool, Trap-Tool, Token-Placer
- Vorhandene Infrastruktur wird wiederverwendet (Tile-Repository, Undo, Rendering)

→ Tool-Wireframes: [Cartographer.md](../application/Cartographer.md#dungeon-tools)

### Raum-Definition

**Entscheidung:** GM definiert Raeume beim Malen

- GM legt Raumgrenzen beim Zeichnen fest
- Nachtraegliche Anpassung mit speziellem Pinsel moeglich
- Raeume dienen als Container fuer Content (Traps, Loot, Encounters)
- Kein automatisches Flood-Fill - GM hat volle Kontrolle

### Combat-Grid Integration

**Entscheidung:** Gleiches 5-foot Grid

- Standard 5-foot Tiles fuer Dungeons und Interior Maps
- Tokens fuer Spieler und Monster platzierbar
- Ermoeglicht Licht-, Sound- und Sichtlinien-Modellierung
- Dungeon-Grid wird direkt zum Combat-Grid

### Sound-Propagation

**Entscheidung:** Visualisierung via Overlay (keine NPC-AI)

- Overlay zeigt GM was Spieler von ihrer Umgebung hoeren koennen
- Eventuelle Integration mit Audio-System (sehr niedrige Prioritaet)
- Keine automatische NPC-Alarmierung - GM entscheidet immer
- Fokus auf Information fuer den GM, nicht Automatisierung

### Lichtquellen-Tracking

**Entscheidung:** Inventory + Time Integration

- Character-Inventar zeigt verfuegbare Lichtquellen (Reichweite, Brenndauer)
- GM gibt an welche aktuell genutzt werden
- Overlay visualisiert Lichtreichweite (dunkle Bereiche abgedunkelt)
- Time-System trackt wann Lichtquellen ausgehen

### Multi-Level Navigation

**Entscheidung:** 3D-Grid

- Ermoeglicht ungewoehnliche Verbindungen zwischen Ebenen
- Nicht-ebener Untergrund: Balkone, angehobene Sektionen, Tunnel mit Schraege
- Komplexer zu implementieren, aber mehr Flexibilitaet
- Treppen, Leitern, Schaechte als spezielle Tiles

### Geheime Bereiche

**Entscheidung:** Automatischer Passive Perception Check + GM Override

- Fallen und Geheimnisse werden automatisch mit Passive Perception verglichen
- GM erhaelt Popup wenn Spieler etwas entdecken
- GM kann jederzeit auf Secret klicken und als "entdeckt" markieren
- Kombination aus Automatisierung und GM-Kontrolle

### Dungeon-Encounters

**Entscheidung:** Kreaturen als Tokens

- Kreaturen existieren als Tokens auf der Dungeon Map
- GM klickt Token → startet Encounter oder fuegt zu aktivem Encounter hinzu
- Alle Encounters vorplatziert (keine Random-Wandering-Monster)
- Passt zum Dungeon als "vorbereitetes" Gebiet

### Zeit-Tracking

**Entscheidung:** Integration mit Time-Feature

- Basiert auf Charakter-Geschwindigkeit (5-foot tiles pro 6 Sekunden)
- Bewegung durch Dungeon aktualisiert Zeit automatisch
- Encounter-Runden: Jede Runde = 6 Sekunden
- Konsistent mit Travel-System und Combat-System

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Grid-basierte Map | ✓ | | 5-foot Tiles |
| Fog of War | ✓ | | Explored/Unexplored |
| Raum-Definitionen | ✓ | | GM definiert Raeume |
| Tile-Contents | ✓ | | Creatures, Traps, Treasure |
| Basic Lighting | ✓ | | Bright/Dim/Dark |
| Trap-Trigger | ✓ | | Passive Perception Checks |
| Creature Tokens | ✓ | | Monster-Platzierung |
| Sound-Propagation | | niedrig | Visualisierung |
| Multi-Level (3D) | | niedrig | Z-Koordinate |

---

*Siehe auch: [Cartographer.md](../application/Cartographer.md) (Map-Editor) | [Travel-System.md](Travel-System.md) (fuer Overworld-Navigation) | [Combat-System.md](Combat-System.md) | [Encounter-System.md](Encounter-System.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1000 | ⛔ | Dungeon | features | Automatische Trap-Detection: Passive Perception gegen Trap DC prüfen, Secret-Discovered Event bei Erfolg | hoch | Ja | #3084, #810, #500, #1210 | Dungeon-System.md#automatische-trigger, Character-System.md#character-schema, Map-Feature.md#dungeonmap | src/features/dungeon/trap-detection.ts:checkTrapDetection() [neu] |
| 1002 | ⛔ | Dungeon | features | Tür-Prompt bei Bewegung ("Tür. Öffnen?") | hoch | Ja | #3084, #808 | Dungeon-System.md#automatische-trigger, Map-Feature.md#dungeontile | src/features/dungeon/movement-triggers.ts:checkDoorPrompt() [neu] |
| 1004 | ⛔ | Dungeon | features | Fog of War Update bei Party-Bewegung | hoch | Ja | #3084, #812, #1025 | Dungeon-System.md#simulation, Map-Feature.md#dungeontile | src/features/dungeon/fog-of-war.ts:updateFogOfWar() [neu] |
| 1005 | ⛔ | Dungeon | features | Secret-Door Detection: Passive Perception Check gegen DC, automatisch bei Party-Bewegung | hoch | Ja | #3084, #808, #500, #1210 | Dungeon-System.md#geheime-bereiche, Character-System.md#character-schema, Map-Feature.md#dungeontile | src/features/dungeon/secret-detection.ts:checkSecretDoorDetection() [neu] |
| 1007 | ⛔ | Dungeon | features | GM-Override: Secret als entdeckt markieren | hoch | Ja | #1005 | Dungeon-System.md#geheime-bereiche | src/features/dungeon/dungeon-service.ts:markSecretAsDiscovered() [neu] |
| 1008 | ⛔ | Dungeon | features | Monster-Tokens auf Grid platzieren: Token-Placement-System für vorplatzierte Encounters | hoch | Ja | #811 | Dungeon-System.md#dungeon-encounters, Cartographer.md#token-placer-dungeon, Encounter-System.md#creatureslot-varianten | src/features/dungeon/tokens.ts:placeToken() [neu] |
| 1010 | ⛔ | Dungeon | features | Token zu aktivem Encounter hinzufügen | hoch | Ja | #1009, #217 | Dungeon-System.md#dungeon-encounters, Encounter-System.md#state-machine, Combat-System.md#combat-flow | src/features/dungeon/dungeon-service.ts:addCreaturesToEncounter() [neu] |
| 1011 | ⛔ | Dungeon | features | Lichtquellen-Konstanten definieren: LIGHT_SOURCE_RADII mit Torch/Lantern/Light/Darkvision | hoch | Ja | #808 | Dungeon-System.md#licht, Dungeon-System.md#lichtquellen-tracking, Character-System.md#sinne-post-mvp | src/features/dungeon/lighting.ts:LIGHT_SOURCE_RADII [neu] |
| 1013 | ⛔ | Dungeon | features | Character-Inventar Lichtquellen-Tracking (Reichweite, Brenndauer) | hoch | Ja | #1011, #600, #612 | Dungeon-System.md#lichtquellen-tracking, Inventory-System.md#inventoryslot, Time-System.md#zeit-operationen | src/features/inventory/types.ts:LightSource [neu], src/features/dungeon/dungeon-service.ts:getActiveLightSources() [neu] |
| 1015 | ⬜ | Dungeon | features | Bewegungs-Zeit basierend auf Character-Speed (5-foot Tiles / 6 Sekunden) | hoch | Ja | #806, #504 | Dungeon-System.md#zeit-tracking, Character-System.md#travel-system, Time-System.md#advance-zeit-voranschreiten | src/features/dungeon/movement.ts:calculateMovementTime() [neu] |
| 1017 | ⛔ | Dungeon | features | GM View Toggle (sieht alles) | hoch | Ja | #812 | Dungeon-System.md#gm-interface, Cartographer.md#layer-control | src/features/dungeon/dungeon-service.ts:setViewMode() [neu], src/features/dungeon/types.ts:ViewMode [neu] |
| 1018 | ⛔ | Dungeon | features | Player View Toggle (nur Explored sichtbar) | hoch | Ja | #812, #1017 | Dungeon-System.md#gm-interface, Dungeon-System.md#fog-of-war, Cartographer.md#layer-control | src/features/dungeon/dungeon-service.ts:setViewMode() [neu] |
| 1020 | ⬜ | Dungeon | features | GM-definierte Raum-Grenzen: Room-Boundary-Tool im Cartographer für Dungeon-Mode | hoch | Ja | #809 | Dungeon-System.md#raum-definition, Map-Feature.md#dungeonroom, Cartographer.md#dungeon-tools | src/features/dungeon/rooms.ts:defineRoom() [neu] |
| 1022 | ⬜ | Dungeon | application | Raum-Klick zeigt Inhaltsübersicht | hoch | Ja | #809 | Dungeon-System.md#gm-interface, Map-Feature.md#dungeonroom | src/features/dungeon/rooms.ts:getRoomSummary() [neu], src/application/views/RoomSummaryView.svelte [neu] |
| 1024 | ⛔ | Dungeon | application | DetailView zeigt Fallen, Truhen, GM-Notizen | hoch | Ja | #1023 | Dungeon-System.md#gm-interface, Map-Feature.md#dungeontilecontent, DetailView.md | src/application/views/TileDetailView.svelte [neu] |
| 1026 | ⛔ | Dungeon | features | Wand-Blockierung für Sichtlinien | hoch | Ja | #1025 | Dungeon-System.md#sicht-line-of-sight, Map-Feature.md#dungeontile | src/features/dungeon/line-of-sight.ts:isBlockedByWall() [neu] |
| 1030 | ⬜ | Dungeon | features | Sound-Propagation Overlay (was Spieler hören können) | niedrig | Nein | #809 | Dungeon-System.md#sound, Dungeon-System.md#sound-propagation | src/features/dungeon/sound-propagation.ts:calculateSoundPropagation() [neu] |
| 1032 | ⛔ | Dungeon | infrastructure | Raum-zu-Raum Sound-Visualisierung | niedrig | Nein | #1030 | Dungeon-System.md#sound, Map-Feature.md#dungeonroom | src/features/dungeon/sound-propagation.ts:visualizeSoundReach() [neu] |
| 1036 | ⛔ | Dungeon | core | Treppen/Leitern/Schächte als spezielle DungeonTile Types: stairs, ladder, shaft | niedrig | Nein | #1035, #808 | Dungeon-System.md#multi-level-navigation, Map-Feature.md#dungeontile, Map-Feature.md#gridcoordinate | src/core/schemas/map.ts:dungeonTileSchema [ändern - type erweitern], src/features/dungeon/3d-grid.ts:LEVEL_TRANSITION_TILES [neu] |
| 1001 | ⛔ | Dungeon | features | Trap-Auslösung bei Bewegung (Passive Perception < Trap DC) | hoch | Ja | #1000 | Dungeon-System.md#automatische-trigger | src/features/dungeon/trap-detection.ts:triggerTrap() [neu] |
| 1003 | ⛔ | Dungeon | features | Creature-Encounter-Trigger bei Token-Kontakt | hoch | Ja | #3084, #811, #215, #217 | Dungeon-System.md#automatische-trigger | src/features/dungeon/movement-triggers.ts:checkTokenContact() [neu], src/features/dungeon/dungeon-service.ts:publishEncounterGenerateRequested() [neu] |
| 1006 | ⛔ | Dungeon | application | GM-Popup bei Secret-Entdeckung | hoch | Ja | #1005 | Dungeon-System.md#geheime-bereiche | src/features/dungeon/dungeon-service.ts:publishSecretDiscovered() [neu] |
| 1009 | ⛔ | Dungeon | features | Encounter-Start bei Token-Klick | hoch | Ja | #1008, #217 | Dungeon-System.md#dungeon-encounters | src/features/dungeon/tokens.ts:handleTokenClick() [neu], src/features/dungeon/dungeon-service.ts:publishEncounterStartRequested() [neu] |
| 1012 | ⛔ | Dungeon | features | Lighting Calculation: calculateLighting() für Bright/Dim/Dark Bereiche | hoch | Ja | #1011, #812 | Dungeon-System.md#lichtquellen-tracking | src/features/dungeon/lighting.ts:calculateLighting() [neu] |
| 1014 | ⛔ | Dungeon | features | Time-System Integration: Lichtquellen-Brenndauer tracken | mittel | Ja | #1013, #907 | Dungeon-System.md#lichtquellen-tracking | src/features/dungeon/dungeon-service.ts:handleTimeAdvance() [neu] (Event-Handler für time:advance-requested) |
| 1016 | ⛔ | Dungeon | features | Time-System Update bei Dungeon-Bewegung | hoch | Ja | #1015, #907, #3084 | Dungeon-System.md#zeit-tracking | src/features/dungeon/movement.ts:updateTimeAfterMovement() [neu] (publiziert time:advance-requested) |
| 1019 | ⬜ | Dungeon | features | Edit Mode Toggle | hoch | Ja | #806 | Dungeon-System.md#map-ansicht | src/features/dungeon/dungeon-service.ts:setEditMode() [neu] |
| 1021 | ⛔ | Dungeon | features | Raum-Pinsel für nachträgliche Anpassung | hoch | Ja | #1020 | Dungeon-System.md#raum-definition | src/features/dungeon/rooms.ts:updateRoomBoundary() [neu] |
| 1023 | ⛔ | Dungeon | application | Tile-Klick zeigt DetailView mit Inhalt | hoch | Ja | #808 | Dungeon-System.md#tile-detail-click | src/features/dungeon/dungeon-service.ts:getTileContents() [neu], src/application/views/TileDetailView.svelte [neu] |
| 1025 | ⛔ | Dungeon | features | Line of Sight Berechnung | hoch | Ja | #808 | Dungeon-System.md#sicht-line-of-sight | src/features/dungeon/line-of-sight.ts:calculateLineOfSight() [neu] |
| 1031 | ⛔ | Dungeon | features | Tür-Dämpfung (offen: 80%, geschlossen: 30%) | niedrig | Nein | #1030 | Dungeon-System.md#sound | src/features/dungeon/sound-propagation.ts:DOOR_DAMPENING_FACTORS [neu] |
| 1035 | ⬜ | Dungeon | features | 3D-Grid Navigation (Balkone, Tunnel-Schrägen) | niedrig | Nein | #807 | Dungeon-System.md#multi-level-navigation | src/features/dungeon/3d-grid.ts:calculate3DPath() [neu] |
| 1037 | ⛔ | Dungeon | features | Level-Wechsel bei Stair-Tile-Kontakt | niedrig | Nein | #1036 | Dungeon-System.md#multi-level-navigation | src/features/dungeon/movement-triggers.ts:handleLevelTransition() [neu] |
| 3049 | ⬜ | Dungeon | core | DungeonTileContent Schema implementieren (type, id, visible, notes, typ-spezifische Felder) | hoch | --layer | #808 | Dungeon-System.md#dungeontilecontent, Map-Feature.md#dungeontile | - |
| 3050 | ⬜ | Dungeon | - | Party Position Tracking auf DungeonMap (partyPosition: GridPosition) | hoch | --layer | #806, #807 | Dungeon-System.md#dungeonmap, Map-Feature.md#dungeonmap | - |
| 3051 | ⬜ | Dungeon | features | Door State Tracking (open/closed) für Sound-Propagation | mittel | Nein | #808 | Dungeon-System.md#sound, Dungeon-System.md#dungeontile | - |
| 3052 | ⛔ | Dungeon | features | Treasure-Content auf Tiles (items, locked, lockDC, looted) | hoch | --layer | #3049, #808, #1600 | Dungeon-System.md#dungeontilecontent, Dungeon-System.md#tile-detail-click | - |
| 3053 | ⬜ | Dungeon | features | Room Contents Aggregation: Aggregiere alle Tile-Contents eines Raums | mittel | --layer | #809, #808 | Dungeon-System.md#dungeonroom | - |
| 3081 | ⬜ | Dungeon | application | Trap Trigger Button in TileDetailView (manueller Auslöser) | mittel | --layer | #1024, #810 | Dungeon-System.md#tile-detail-click | - |
| 3083 | ⬜ | Dungeon | application | Treasure Open Button in TileDetailView (Unlock/Open Action) | mittel | --layer | #1024 | Dungeon-System.md#tile-detail-click | - |
| 3084 | ⬜ | Dungeon | - | Party Movement Handler: Bewege Party auf Grid, triggere Movement-Checks | hoch | --layer | #806, #807 | Dungeon-System.md#automatische-trigger, Map-Feature.md#dungeonmap | - |
| 3085 | ⬜ | Dungeon | application | Read-aloud Text Display bei Room-Enter | mittel | --layer | #809, #1022 | Dungeon-System.md#dungeonroom | - |
| 3086 | ⬜ | Dungeon | - | Cartographer Dungeon-Mode Toggle (MapType: 'dungeon' aktiviert Grid-Rendering) | hoch | --layer | #806 | Dungeon-System.md#map-erstellung, Cartographer.md#dungeon-tools | - |
| 3103 | ⬜ | Dungeon | infrastructure | Lighting Overlay Rendering: renderLightingOverlay() visualisiert Dunkelheit | hoch | --layer | #1012, #812 | Dungeon-System.md#lichtquellen-tracking | - |
