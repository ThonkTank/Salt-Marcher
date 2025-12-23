# SessionRunner

> **Lies auch:** [Application](../architecture/Application.md), [Data-Flow](../architecture/Data-Flow.md), [DetailView](DetailView.md)
> **Konsumiert:** Map, Travel, Time, Weather, Audio, Party, Quest

Die zentrale Spielansicht waehrend einer D&D-Session. Zeigt die Karte und Quick-Controls fuer schnellen GM-Zugriff.

**Pfad:** `src/application/session-runner/`

**Companion View:** [DetailView](DetailView.md) (rechtes Leaf) fuer kontextbezogene Details wie Encounter, Combat, Shop.

---

## Uebersicht

Der SessionRunner ist die Hauptansicht fuer den aktiven Spielbetrieb. Er fokussiert auf **schnellen Zugriff** zu haeufig benoetigten Controls:

| Bereich | Funktion |
|---------|----------|
| **Header** | Zeit, Quick-Advance, Weather-Status |
| **Quick-Controls** | Travel, Audio, Party-Status, Quests, Actions |
| **Map-Panel** | Karten-Anzeige mit Party-Token und Overlays |

Kontextbezogene Detail-Ansichten (Encounter, Combat, Shop, Quest-Details, Journal) werden in der separaten [DetailView](DetailView.md) angezeigt.

---

## Layout-Wireframe

### Vertikaler Split (Quick-Controls links, Map rechts)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30        │ ☀️ Clear    │ ⚙️      │
├───────────────────────┴─────────────────────────────┴─────────────┴─────────┤
│                                                                              │
│  ┌────────────────┐  ┌────────────────────────────────────────────────────┐ │
│  │ QUICK CONTROLS │  │                                                    │ │
│  ├────────────────┤  │                                                    │ │
│  │                │  │                                                    │ │
│  │ 🚶 TRAVEL      │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ Status: Idle   │  │                                                    │ │
│  │ Speed: 24 mi/d │  │                    MAP PANEL                       │ │
│  │ [Plan] [Start] │  │                  (maximiert)                       │ │
│  │                │  │                                                    │ │
│  │ 🎵 AUDIO       │  │              [Hex-Grid mit Party]                  │ │
│  │ ─────────────  │  │                                                    │ │
│  │ ♪ Tavern Night │  │                      🎯                            │ │
│  │ [⏸] [⏭] [🔊]  │  │                                                    │ │
│  │                │  │                                                    │ │
│  │ 👥 PARTY       │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ 4 PCs • All OK │  │                                                    │ │
│  │ [Manage →]     │  │                                                    │ │
│  │                │  │                                                    │ │
│  │ 📜 QUESTS      │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ [All ▼] 2 aktiv│  │                                                    │ │
│  │ ☐ Goblins (2/3)│  │                                                    │ │
│  │ [Details →]    │  │                                                    │ │
│  │                │  │                                                    │ │
│  │ ⚔️ ACTIONS     │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ [🛏️ Rest]      │  │  [Overlays: ☐Weather ☑️Territory ☐Factions ☐👁️]    │ │
│  │                │  │                                                    │ │
│  │                │  │                                                    │ │
│  └────────────────┘  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Collapsed Quick-Controls

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30        │ ☀️ Clear    │ ⚙️      │
├───────────────────────┴─────────────────────────────┴─────────────┴─────────┤
│                                                                              │
│  ┌────┐  ┌──────────────────────────────────────────────────────────────┐   │
│  │[🚶]│  │                                                              │   │
│  │[🎵]│  │                                                              │   │
│  │[👥]│  │                      MAP PANEL                               │   │
│  │[📜]│  │                   (Maximierte Ansicht)                       │   │
│  │[⚔️]│  │                                                              │   │
│  │    │  │                                                              │   │
│  └────┘  └──────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Panel-Beschreibungen

### Header

Kompakte Anzeige von Zeit und Wetter mit Quick-Controls.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30        │ ☀️ Clear    │ ⚙️      │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Funktion |
|---------|----------|
| `[≡]` | Menu (Quick-Controls ein/ausblenden) |
| `📅 15. Mirtul, 14:30` | Aktuelles Datum/Zeit (Klick → Jump-to-Date) |
| `☀️ Clear` | Wetter-Status (Klick → Weather-Details in DetailView) |
| `⚙️` | Settings |

### Quick-Controls (Sidebar links)

Kompakte Controls fuer haeufig benoetigte Aktionen.

```
┌────────────────┐
│ QUICK CONTROLS │
├────────────────┤
│                │
│ 🚶 TRAVEL      │
│ ─────────────  │
│ Status: Idle   │
│ Speed: 24 mi/d │
│ [Plan] [Start] │
│                │
│ 🎵 AUDIO       │
│ ─────────────  │
│ ♪ Tavern Night │
│ [⏸] [⏭] [🔊]  │
│                │
│ 👥 PARTY       │
│ ─────────────  │
│ 4 PCs • All OK │
│ [Manage →]     │
│                │
│ 📜 QUESTS      │
│ ─────────────  │
│ [All ▼] 2 aktiv│
│ ☐ Goblins (2/3)│
│ [Details →]    │
│                │
│ ⚔️ ACTIONS     │
│ ─────────────  │
│ [🛏️ Rest]      │
│                │
└────────────────┘
```

#### Travel-Sektion

| Element | Funktion |
|---------|----------|
| Status | `Idle`, `Planning`, `Traveling`, `Paused` |
| Speed | Aktuelle Reisegeschwindigkeit |
| `[🗺️ Plan]` | Toggle Travel-Modus (Waypoint-Planung auf Map ein/aus) |
| `[Start]` / `[Pause]` | Reise starten/pausieren |

Bei aktiver Reise:
```
│ 🚶 TRAVEL      │
│ ─────────────  │
│ Traveling...   │
│ 12.4 / 48 mi   │
│ ETA: 18:30     │
│ [Pause] [Stop] │
│                │
│ Anim: ━━━○━━━━ │
```

#### Animations-Geschwindigkeit Slider (Post-MVP)

| Element | Funktion |
|---------|----------|
| Slider | Steuert die Geschwindigkeit der Travel-Animation |
| Range | 0.5x bis 10x (Default: 1x) |
| Persistenz | Session-only (nicht persistiert) |

**Verhalten:**
- Aendert die `TRAVEL_LOOP_DELAY_MS` zur Laufzeit
- 1x = 1 Tick pro 100ms (Standard)
- 0.5x = 1 Tick pro 200ms (langsamer, fuer RP/Immersion)
- 10x = 1 Tick pro 10ms (schneller, fuer lange Strecken)
- Aenderung waehrend aktiver Reise hat sofortigen Effekt

#### Audio-Sektion

| Element | Funktion |
|---------|----------|
| Track-Name | Aktueller Music-Track |
| `[⏸]` | Play/Pause |
| `[⏭]` | Skip to next |
| `[🔊]` | Volume (Klick → Slider) |

#### Party-Sektion

| Element | Funktion |
|---------|----------|
| Status | Anzahl PCs, Health-Summary |
| `[Manage →]` | Oeffnet Party-Management (Modal oder DetailView) |

Health-Summary: `All OK`, `1 Wounded`, `2 Critical`, etc.

#### Quest-Sektion

| Element | Funktion |
|---------|----------|
| Status-Dropdown | Filtert nach `All`, `Active`, `Discovered`, `Completed`, `Failed` |
| Quest-Liste | Zeigt Quests basierend auf Filter |
| Objectives | Checkboxen zum Abhaken (Todo-Stil) |
| Quick-Actions | `[Activate]`, `[Complete]`, `[Fail]` je nach Quest-Status |
| `[Details →]` | Oeffnet Quest-Tab in DetailView (Post-MVP) |

Quest-Anzeige bei aktiver Quest:
```
│ 📜 QUESTS                    │
│ ─────────────────────────────│
│ [Status: All ▼]              │
│                              │
│ "Goblin-Hoehle saeubern"     │
│   ☐ Goblins toeten (3/5)     │
│   ☑ Anfuehrer finden         │
│   XP Pool: 360 | ⏰ 3 Tage   │
│   [Complete] [Fail]          │
│                              │
│ "Haendler eskortieren"       │
│   Status: Discovered         │
│   [Activate]                 │
```

#### Actions-Sektion

| Element | Funktion |
|---------|----------|
| `[🛏️ Rest]` | Short/Long Rest (oeffnet Rest-Modal) |

**Rest-Modal:**

```
┌─────────────────────────────┐
│ 🛏️ REST                     │
├─────────────────────────────┤
│ ○ Short Rest (1 Stunde)     │
│   → HD ausgeben, Features   │
│                             │
│ ○ Long Rest (8 Stunden)     │
│   → Volle HP, Spell-Slots   │
│                             │
│ [Abbrechen]     [Bestätigen]│
└─────────────────────────────┘
```

- Short Rest: 1h Zeit vorrücken, HD-Ausgabe ermöglichen
- Long Rest: 8h Zeit vorrücken, HP-Recovery, XP-Budget-Reset

**Gritty Realism (Optional):**

In den Optionen kann der GM "Gritty Realism" aktivieren:

| Modus | Short Rest | Long Rest |
|-------|------------|-----------|
| Normal | 1 Stunde | 8 Stunden |
| Gritty Realism | 1 Tag (24h) | 1 Woche (7 Tage) |

Bei Gritty Realism werden die Encounter-Checks entsprechend angepasst (1x pro Tag statt 1x pro Stunde).

**Encounter-Check während Rest:**
- Jede Stunde: Encounter-Check (wie Travel)
- Bei Encounter: Rest pausiert, Encounter wird gespielt
- Nach Resolution: GM-Modal bietet "Fortsetzen" oder "Neustarten"

**Encounter-Generierung:** Erfolgt über DetailView → Encounter-Tab → `[🎲 Generate]` Button.

### Map-Panel

Das zentrale Element - zeigt die aktive Karte mit Party-Position.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                                       │
│    ⬡ 🌲 🌲 ⛰️ ⛰️ 🌲 🌲 ⬡                                      │
│     ⬡ 🌲 🏠 🌲 🌲 🌲 ⬡ ⬡          🎯 = Party Position         │
│    ⬡ 🌲 🌲 🎯 🌲 🌲 ⬡ ⬡          🏠 = Location (POI)         │
│     ⬡ 🌊 🌊 🌲 🌲 ⬡ ⬡ ⬡          ⛰️ = Mountain                │
│    ⬡ ⬡ 🌊 🌊 🌲 ⬡ ⬡ ⬡                                        │
│     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                                         │
│                                                                │
│  [Overlays: ☐Weather ☑️Territory ☐Factions ☐👁️] [🔍+] [🔍-]   │
└────────────────────────────────────────────────────────────────┘
```

**Interaktionen:**

| Aktion | Effekt |
|--------|--------|
| **Kamera-Steuerung** | |
| Mittlere Maustaste (halten) | Karte verschieben (Pan) |
| Mittlere Maustaste (scrollen) | Zoom In/Out |
| **Im Travel-Modus (aktiv)** | |
| Linksklick auf Tile | Waypoint setzen |
| Linksklick + Halten | Waypoint/Party-Token verschieben |
| Linksklick auf Route | Neuen Waypoint zwischen bestehenden einfuegen |
| Rechtsklick auf Waypoint | Waypoint loeschen |
| **Ohne Travel-Modus** | |
| Linksklick auf Tile | Zeigt Location-Info in DetailView |
| Doppelklick auf POI | Oeffnet Location-Tab in DetailView |

**Routen-Anzeige im Travel-Modus:**

Zwischen gesetzten Waypoints wird eine Route als Linie angezeigt:
- Route verbindet Party-Token → Waypoint 1 → Waypoint 2 → ... → Ziel
- Route aktualisiert sich dynamisch beim Verschieben von Waypoints/Token
- Klick auf die Route fuegt einen neuen Waypoint an dieser Stelle ein

### Visibility-Toggle (Post-MVP)

Toggle-Button fuer Sichtweiten-Overlay im Overlays-Bereich:

| Element | Beschreibung |
|---------|--------------|
| Icon | 👁️ (Auge) |
| Tooltip | "Sichtweite anzeigen" |
| State | Session-only (nicht persistiert) |

**Overlay-Verhalten:**
- Nicht-sichtbare Tiles: Halbtransparentes graues Overlay
- Sichtbare Tiles: Kein Overlay (normal sichtbar)
- Sichtbare POIs: Hervorgehoben (Glow-Effekt oder Umrandung)
- Nachtleuchtende POIs: Bei Nacht mit Lichtschein-Effekt

**Design-Prinzip:** Sichtbare POIs werden hervorgehoben, statt nicht-sichtbare extra abzudunkeln (die liegen bereits unter dem grauen Overlay).

**Invalidierung:** Overlay wird neu berechnet bei:
- Party bewegt sich
- Zeit aendert sich (Segment-Wechsel)
- Wetter aendert sich

→ **Visibility-System:** [Map-Feature.md](../features/Map-Feature.md#visibility-system)

---

## Interaktions-Flows

### Flow: Reise starten

```
User klickt [🗺️ Plan] in Quick-Controls
    │
    ▼
Travel-Modus wird aktiviert (Toggle)
    │
    ▼
Map-Panel zeigt Route-Overlay
    │
    ├── Linksklick auf Tile: Waypoint setzen
    ├── Linksklick + Halten: Waypoint/Party-Token verschieben
    ├── Linksklick auf Route: Waypoint einfuegen
    ├── Rechtsklick auf Waypoint: Waypoint loeschen
    └── Route wird zwischen Waypoints angezeigt
    │
    ▼
User klickt [Start] in Quick-Controls
    │
    ▼
ViewModel: eventBus.publish('travel:start-requested')
    │
    ▼
Travel-Feature startet Animation
    │
    ├── Time-Feature: Zeit wird vorgerueckt
    ├── Weather-Feature: Wetter aktualisiert (Header)
    └── Quick-Controls: Travel-Status aktualisiert
    │
    ▼
Bei Encounter-Check erfolgreich:
    │
    ▼
Travel pausiert → encounter:generated Event
    │
    ▼
DetailView oeffnet automatisch Encounter-Tab
```

### Flow: Rast starten

```
User klickt [Rest] in Quick-Controls
    │
    ▼
Rest-Modal oeffnet: Short/Long Rest waehlen
    │
    ▼
User waehlt Rest-Typ und bestaetigt
    │
    ▼
ViewModel: eventBus.publish('rest:short-rest-requested' oder 'rest:long-rest-requested')
    │
    ▼
Rest-Feature startet Stunden-Loop:
    │
    ├── Pro Stunde: Encounter-Check (wie Travel)
    │   │
    │   ├── Kein Encounter → Zeit +1h → naechste Stunde
    │   │
    │   └── Encounter! → rest:paused Event
    │       │
    │       ▼
    │       DetailView zeigt Encounter-Tab
    │       │
    │       ▼
    │       Nach Encounter-Resolution:
    │       │
    │       ▼
    │       GM-Modal: "Rast fortsetzen?" / "Rast neustarten?"
    │           │
    │           ├── Fortsetzen → rest:resume-requested
    │           └── Neustarten → rest:restart-requested
    │
    ▼
Alle Stunden abgeschlossen
    │
    ▼
rest:*-completed Event
    │
    ▼
Rest-Completed-Modal (GM gibt HP manuell ein)
```

### Flow: Encounter generieren (manuell)

**Hinweis:** Die manuelle Encounter-Generierung erfolgt ueber DetailView → Encounter-Tab → Generate-Button.

→ Siehe [DetailView.md#encounter-tab](DetailView.md#encounter-tab)


### Flow: Location-Details anzeigen

```
User klickt auf Tile in Map-Panel
    │
    ▼
ViewModel: selectedTile = clickedTile
    │
    ▼
eventBus.publish('ui:tile-selected', { coordinate })
    │
    ▼
DetailView oeffnet Location-Tab (falls nicht bereits offen)
    │
    ▼
Location-Tab zeigt Tile-Details:
    ├── Terrain, Elevation
    ├── POIs auf diesem Tile
    ├── Fraktions-Praesenz
    └── NPCs (falls bekannt)
```

---

## State-Synchronisation

### ViewModel-State

```typescript
interface SessionRunnerState {
  // Map
  activeMapId: EntityId<'map'> | null;
  camera: CameraState;
  overlays: OverlaySettings;

  // Travel
  travelState: TravelState;           // idle | planning | traveling | paused
  currentRoute: Route | null;
  partyPosition: HexCoordinate;

  // Time
  currentTimestamp: Timestamp;
  daySegment: DaySegment;

  // Weather
  currentWeather: WeatherSummary;     // Kompakt fuer Header

  // Audio
  currentMusic: Track | null;
  currentAmbience: Track | null;
  audioMode: 'auto' | 'manual';

  // Party (kompakt)
  partySize: number;
  partyHealthSummary: HealthSummary;

  // UI
  quickControlsCollapsed: boolean;
  selectedTile: HexCoordinate | null;
}
```

**Hinweis:** Encounter- und Combat-State werden in [DetailView](DetailView.md) verwaltet.

### Event-Subscriptions

```typescript
// SessionRunner-ViewModel subscribed auf:
const subscriptions = [
  'travel:state-changed',
  'travel:position-changed',
  'time:state-changed',
  'weather:state-changed',
  'audio:track-changed',
  'map:loaded',
  'party:state-changed'
];
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Space` | Travel: Start/Pause |
| `Escape` | Cancel aktuelle Aktion |
| `T` | Travel-Sektion fokussieren |
| `E` | Encounter generieren (oeffnet DetailView) |
| `1-6` | Time-Segment springen |
| `+`/`-` | Zoom In/Out |
| `Arrow Keys` | Pan Map |
| `[` / `]` | Quick-Controls ein/ausblenden |

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Map-Panel mit Party-Token | ✓ | | Kern-Ansicht |
| Quick-Controls Sidebar | ✓ | | Travel, Audio, Party, Quests, Actions |
| Header (Time, Weather) | ✓ | | Kompakte Info-Anzeige |
| Travel-Sektion | ✓ | | Plan/Start/Pause |
| Audio-Sektion | ✓ | | Play/Pause/Skip |
| Party-Sektion | ✓ | | Status + Manage-Link |
| Quest-Sektion | ✓ | | Status-Filter, Objectives, Quick-Actions |
| Actions-Sektion | ✓ | | Rest-Button (Short/Long Rest, Gritty Realism Option) |
| Collapsed Quick-Controls | | mittel | Responsive UI |
| **Visibility-Toggle** | | mittel | Sichtweiten-Overlay |
| **Animations-Geschwindigkeit** | | niedrig | Slider fuer Travel-Animation |

---

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 955 | ⛔ | Application | Rest-Button in SessionRunner Actions-Sektion | hoch | Ja | #951, b1, b2 | SessionRunner.md#actions-sektion, Time-System.md#resting | src/application/session-runner/panels/sidebar.ts [ändern] |
| 956 | ⛔ | Application | Rest-Start-Modal (Short/Long wählen, Gritty Realism Option) | hoch | Ja | #955 | SessionRunner.md#actions-sektion, Time-System.md#rest-typen | src/application/session-runner/modals/rest-modal.ts [neu] |
| 957 | ⛔ | Application | Rest-Resolution-Modal (Fortsetzen/Neustarten nach Encounter) | hoch | Ja | #954 | SessionRunner.md#actions-sektion, Time-System.md#encounter-unterbrechung | src/application/session-runner/modals/rest-resolution-modal.ts [neu] |
| 958 | ⛔ | Application | Rest-Completed-Modal (Info + manuelle HP-Eingabe für GM) | hoch | Ja | #954 | SessionRunner.md#actions-sektion, Time-System.md#rest-abschluss, Character-System.md | src/application/session-runner/modals/rest-completed-modal.ts [neu] |
| 2300 | ✅ | Application/SessionRunner | SessionRunner View Component (Hauptcontainer) | hoch | Ja | - | SessionRunner.md#uebersicht, Application.md#mvvm-pattern | src/application/session-runner/view.ts:SessionRunnerView, view.ts:createSessionRunnerViewFactory() |
| 2301 | ✅ | Application/SessionRunner | SessionRunner ViewModel mit State-Management | hoch | Ja | #2300 | SessionRunner.md#viewmodel-state, Application.md#mvvm-pattern, Data-Flow.md | src/application/session-runner/viewmodel.ts:createSessionRunnerViewModel(), viewmodel.ts:SessionRunnerViewModel, types.ts:RenderState |
| 2302 | ✅ | Application/SessionRunner | Header Component (Zeit, Weather) | hoch | Ja | #2300 | SessionRunner.md#header, Time-System.md, Weather-System.md | src/application/session-runner/panels/header.ts:createHeaderPanel(), types.ts:HeaderState |
| 2303 | ✅ | Application/SessionRunner | Quick-Controls Sidebar Container | hoch | Ja | #2300 | SessionRunner.md#quick-controls-sidebar-links, Application.md | src/application/session-runner/panels/sidebar.ts:createSidebarPanel(), types.ts:SidebarState |
| 2304 | ✅ | Application/SessionRunner | Travel Section Component (Status, Speed, Plan/Start/Pause) | hoch | Ja | #2303, #1 | SessionRunner.md#travel-sektion, Travel-System.md#state-machine | src/application/session-runner/panels/sidebar.ts:updateTravelSection(), types.ts:TravelSectionState |
| 2305 | ✅ | Application/SessionRunner | Travel Animation Display (Progress Bar, ETA) | hoch | Ja | #2304, #8 | SessionRunner.md#travel-sektion, Travel-System.md | src/application/session-runner/panels/sidebar.ts:etaDisplay, map-canvas.ts:renderPartyToken(), types.ts:TokenAnimationState, types.ts:ETAInfo |
| 2306 | ⛔ | Application/SessionRunner | Audio Section Component (Track-Name, Play/Pause/Skip/Volume) | hoch | Ja | #1100, #1110, #1111, #1500, #2303 | SessionRunner.md#audio-sektion, Audio-System.md | src/application/session-runner/panels/sidebar.ts:audioSection [ändern] |
| 2307 | ✅ | Application/SessionRunner | Party Section Component (Party-Size, Health-Summary, Manage-Button) | hoch | Ja | - | SessionRunner.md#party-sektion, Character-System.md | src/application/session-runner/panels/sidebar.ts:partySection [ändern] |
| 2308 | ✅ | Application/SessionRunner | Actions Section Component (nur Rest-Button, Encounter/Teleport entfernt) | hoch | Ja | - | SessionRunner.md#actions-sektion, Time-System.md#resting | src/application/session-runner/panels/sidebar.ts:actionsSection [ändern], sidebar.ts:updateActionsSection() [ändern], types.ts:ActionsSectionState [ändern] |
| 2309 | ✅ | Application/SessionRunner | Map Panel Component (Hauptansicht mit Hex-Grid und Party-Token) | hoch | Ja | #2300 | SessionRunner.md#map-panel, Map-Feature.md | src/application/session-runner/panels/map-canvas.ts:createMapCanvas(), map-canvas.ts:renderFrame() |
| 2310 | ⬜ | Application/SessionRunner | Map Overlays Controls (Weather, Territory, Factions, Visibility) | hoch | Ja | #2309, #1300, #1400 | SessionRunner.md#map-panel, Weather-System.md, Map-Feature.md | src/application/session-runner/panels/map-canvas.ts:renderFrame() [ändern], types.ts:RenderState [ändern - overlaySettings hinzufügen] |
| 2311 | ✅ | Application/SessionRunner | Camera Controls (Pan mit MMB, Zoom mit Scroll) | hoch | Ja | #2309 | SessionRunner.md#map-panel, Map-Feature.md | src/application/session-runner/panels/map-canvas.ts:onMouseMove(), map-canvas.ts:onWheel(), viewmodel.ts:onPan(), viewmodel.ts:onZoom() |
| 2312 | ✅ | Application/SessionRunner | Travel-Modus Interaktionen (Waypoint setzen/verschieben/löschen) | hoch | Ja | #2309, #2 | SessionRunner.md#map-panel, Travel-System.md | src/application/session-runner/viewmodel.ts:onTileClick(), viewmodel.ts:addWaypoint(), viewmodel.ts:clearWaypoints(), sidebar.ts:planBtn |
| 2313 | ✅ | Application/SessionRunner | Route-Anzeige im Travel-Modus (Linie zwischen Waypoints) | hoch | Ja | #2312 | SessionRunner.md#map-panel, Travel-System.md | src/application/session-runner/panels/map-canvas.ts:renderRoute(), map-canvas.ts:drawRouteLine(), map-canvas.ts:drawWaypointMarkers() |
| 2314 | ✅ | Application/SessionRunner | Tile-Klick Handler (Location-Info in DetailView) | hoch | Ja | #2309 | SessionRunner.md#map-panel, DetailView.md#location-tab, Map-Feature.md | src/application/session-runner/viewmodel.ts:onTileClick(), types.ts:RenderState.selectedTile |
| 2315 | ✅ | Application/SessionRunner | Event Subscriptions: travel:state-changed | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Travel-System.md#events, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L443-475 |
| 2316 | ✅ | Application/SessionRunner | Event Subscriptions: travel:position-changed | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Travel-System.md#events, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L370-408 |
| 2317 | ✅ | Application/SessionRunner | Event Subscriptions: time:state-changed | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Time-System.md#events, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L359-368 |
| 2318 | ✅ | Application/SessionRunner | Event Subscriptions: weather:state-changed | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Weather-System.md#weather-events, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L410-419 |
| 2319 | ⛔ | Application/SessionRunner | Event Subscriptions: audio:track-changed | hoch | Ja | #1112, #1500, #2301 | SessionRunner.md#event-subscriptions, Audio-System.md, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() [ändern - audio subscription hinzufügen] |
| 2320 | ✅ | Application/SessionRunner | Event Subscriptions: map:loaded | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Map-Feature.md, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L316-324 |
| 2321 | ✅ | Application/SessionRunner | Event Subscriptions: party:state-changed | hoch | Ja | #2301 | SessionRunner.md#event-subscriptions, Character-System.md, Data-Flow.md | src/application/session-runner/viewmodel.ts:setupEventHandlers() L347-356 |
| 2323 | ⬜ | Application/SessionRunner | Jump-to-Date Dialog (Klick auf Zeit im Header) | mittel | Nein | #2302, #900 | SessionRunner.md#header, Time-System.md#zeit-operationen | [neu] src/application/session-runner/dialogs/JumpToDateDialog.ts, header.ts:dateTimeEl [ändern - onClick Handler] |
| 2324 | ✅ | Application/SessionRunner | Weather-Status Display im Header (Klick → DetailView Weather-Tab) | hoch | Ja | #2302, #1300 | SessionRunner.md#header, Weather-System.md, DetailView.md | src/application/session-runner/panels/header.ts:weatherEl, header.ts:updateHeader() |
| 2325 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: Space (Travel Start/Pause) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, Travel-System.md#state-machine | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2326 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: T (Travel-Sektion fokussieren) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, SessionRunner.md#travel-sektion | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2327 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: E (Encounter generieren) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, DetailView.md#encounter-tab | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2328 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: 1-6 (Time-Segment springen) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, Time-System.md#time-segment-berechnung | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2329 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: +/- (Zoom In/Out) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, SessionRunner.md#map-panel | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2330 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: Arrow Keys (Pan Map) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, SessionRunner.md#map-panel | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2331 | ⬜ | Application/SessionRunner | Keyboard Shortcuts: [ / ] (Quick-Controls ein/ausblenden) | mittel | Nein | #2301 | SessionRunner.md#keyboard-shortcuts, SessionRunner.md#collapsed-quick-controls | src/application/session-runner/view.ts:onOpen() [ändern - Keyboard Listener], viewmodel.ts [ändern - handleKeyboard()] |
| 2332 | ⬜ | Application/SessionRunner | Collapsed Quick-Controls Modus (Icon-only Sidebar) | mittel | Nein | #2303 | SessionRunner.md#collapsed-quick-controls, Application.md | src/application/session-runner/panels/sidebar.ts:createSidebarPanel() [ändern - Icon-Modus], types.ts:RenderState.sidebarCollapsed |
| 2333 | ⛔ | Application/SessionRunner | Visibility-Toggle im Overlays-Bereich (Sichtweiten-Overlay) | mittel | Nein | #2310, #1000 | SessionRunner.md#visibility-toggle-post-mvp, Map-Feature.md#visibility-system, Time-System.md#sichtweiten-einfluss-post-mvp | src/application/session-runner/panels/map-canvas.ts:renderFrame() [ändern - Visibility Layer], types.ts:RenderState [ändern - overlaySettings.visibility] |
| 2334 | ⬜ | Application/SessionRunner | Animations-Geschwindigkeit Slider (0.5x - 10x) | niedrig | Nein | #2304 | SessionRunner.md#animations-geschwindigkeit-slider-post-mvp, Travel-System.md | src/application/session-runner/panels/sidebar.ts:travelSection [ändern - Speed Slider] |
| 2335 | ✅ | Application/SessionRunner | Travel-Plan-Button Toggle (Aktiviert/Deaktiviert Travel-Modus) | hoch | Ja | #2304 | SessionRunner.md#travel-sektion, Travel-System.md#state-machine | src/application/session-runner/panels/sidebar.ts:planBtn, viewmodel.ts:toggleTravelMode(), types.ts:RenderState.travelMode |
| 2338 | 🔶 | Application/SessionRunner | Party-Manage-Button (Öffnet Party-Management Modal/DetailView) | mittel | Nein | #2307 | SessionRunner.md#party-sektion, Character-System.md | src/application/session-runner/panels/sidebar.ts:partySection [ändern - Manage Button], [neu] src/application/session-runner/modals/PartyManagementModal.ts |
| 2339 | ✅ | Application/SessionRunner | Health-Summary Berechnung (All OK, X Wounded, X Critical) | hoch | Ja | - | SessionRunner.md#party-sektion, Character-System.md | src/application/session-runner/viewmodel.ts:syncFromFeatures() [ändern - Health Summary], types.ts:SidebarState [ändern - Party Section mit Health] |
| 2340 | ⛔ | Application/SessionRunner | Audio Volume Slider (Klick auf 🔊 im Audio-Section) | mittel | Nein | #1104, #1500, #2306 | SessionRunner.md#audio-sektion, Audio-System.md | src/application/session-runner/panels/sidebar.ts:audioSection [ändern - Volume Control] |

---

*Siehe auch: [DetailView.md](DetailView.md) | [Application.md](../architecture/Application.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md)*
