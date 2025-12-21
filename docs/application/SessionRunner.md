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
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30 │ ⏮ ▶ ⏭ │ ☀️ Clear    │ ⚙️  │
├───────────────────────┴──────────────────────┴─────────┴─────────────┴──────┤
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
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30 │ ⏮ ▶ ⏭ │ ☀️ Clear    │ ⚙️  │
├───────────────────────┴──────────────────────┴─────────┴─────────────┴──────┤
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
│  [≡] SessionRunner    │ 📅 15. Mirtul, 14:30 │ ⏮ ▶ ⏭ │ ☀️ Clear    │ ⚙️  │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Funktion |
|---------|----------|
| `[≡]` | Menu (Quick-Controls ein/ausblenden) |
| `📅 15. Mirtul, 14:30` | Aktuelles Datum/Zeit (Klick → Jump-to-Date) |
| `⏮ ▶ ⏭` | Time-Advance (-1h, Play/Pause, +1h) |
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


### Flow: Zeit manuell aendern

```
User klickt ⏭ im Header
    │
    ▼
ViewModel: eventBus.publish('time:advance-requested', { hours: 1 })
    │
    ▼
Time-Feature rueckt Zeit vor
    │
    ├── Weather-Feature: Wetter-Update
    ├── Audio-Feature: Track-Wechsel (falls Mood-Change)
    └── Header: Zeit + Weather aktualisiert
```

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

*Siehe auch: [DetailView.md](DetailView.md) | [Application.md](../architecture/Application.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md)*
