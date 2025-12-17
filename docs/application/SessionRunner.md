# SessionRunner

> **Lies auch:** [Application](../architecture/Application.md), [Data-Flow](../architecture/Data-Flow.md), [DetailView](DetailView.md)
> **Konsumiert:** Map, Travel, Time, Weather, Audio, Party

Die zentrale Spielansicht waehrend einer D&D-Session. Zeigt die Karte und Quick-Controls fuer schnellen GM-Zugriff.

**Pfad:** `src/application/session-runner/`

**Companion View:** [DetailView](DetailView.md) (rechtes Leaf) fuer kontextbezogene Details wie Encounter, Combat, Shop.

---

## Uebersicht

Der SessionRunner ist die Hauptansicht fuer den aktiven Spielbetrieb. Er fokussiert auf **schnellen Zugriff** zu haeufig benoetigten Controls:

| Bereich | Funktion |
|---------|----------|
| **Header** | Zeit, Quick-Advance, Weather-Status |
| **Quick-Controls** | Travel, Audio, Party-Status, Actions |
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
│  │ ⚔️ ACTIONS     │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ [🎲 Encounter] │  │  [Overlays: ☐Weather ☑️Territory ☐Factions]        │ │
│  │ [📍 Teleport]  │  │                                                    │ │
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
│  │[⚔️]│  │                   (Maximierte Ansicht)                       │   │
│  │    │  │                                                              │   │
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
│ ⚔️ ACTIONS     │
│ ─────────────  │
│ [🎲 Encounter] │
│ [📍 Teleport]  │
│                │
└────────────────┘
```

#### Travel-Sektion

| Element | Funktion |
|---------|----------|
| Status | `Idle`, `Planning`, `Traveling`, `Paused` |
| Speed | Aktuelle Reisegeschwindigkeit |
| `[Plan]` | Startet Route-Planung auf Map |
| `[Start]` / `[Pause]` | Reise starten/pausieren |

Bei aktiver Reise:
```
│ 🚶 TRAVEL      │
│ ─────────────  │
│ Traveling...   │
│ 12.4 / 48 mi   │
│ ETA: 18:30     │
│ [Pause] [Stop] │
```

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

#### Actions-Sektion

| Element | Funktion |
|---------|----------|
| `[🎲 Encounter]` | Generiert Encounter (oeffnet DetailView) |
| `[📍 Teleport]` | Teleport-Modus (Klick auf Map) |

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
│  [Overlays: ☐Weather ☑️Territory ☐Factions] [🔍+] [🔍-]        │
└────────────────────────────────────────────────────────────────┘
```

**Interaktionen:**

| Aktion | Effekt |
|--------|--------|
| Klick auf Tile | Zeigt Location-Info in DetailView |
| Rechtsklick | Kontext-Menu (Set Waypoint, Teleport, Info) |
| Drag | Pan |
| Scroll | Zoom |
| Doppelklick auf POI | Oeffnet Location-Tab in DetailView |

---

## Interaktions-Flows

### Flow: Reise starten

```
User klickt [Plan] in Quick-Controls
    │
    ▼
Map-Panel wechselt in Planning-Mode
    │ (Waypoints per Klick setzen)
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

### Flow: Encounter generieren (manuell)

```
User klickt [🎲 Encounter] in Quick-Controls
    │
    ▼
ViewModel: eventBus.publish('encounter:generate-requested')
    │
    ▼
Encounter-Feature generiert basierend auf:
    ├── Aktuelle Location (Terrain, EncounterZone)
    ├── Aktives Wetter
    ├── Fraktions-Praesenz
    └── Zeit (Tag/Nacht)
    │
    ▼
encounter:generated Event
    │
    ▼
DetailView oeffnet automatisch Encounter-Tab
    │
    ▼
User sieht Preview in DetailView
    │
    ▼
User klickt [Start Combat] in DetailView
    │
    ▼
combat:started Event → DetailView wechselt zu Combat-Tab
```

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
| Quick-Controls Sidebar | ✓ | | Travel, Audio, Party, Actions |
| Header (Time, Weather) | ✓ | | Kompakte Info-Anzeige |
| Travel-Sektion | ✓ | | Plan/Start/Pause |
| Audio-Sektion | ✓ | | Play/Pause/Skip |
| Party-Sektion | ✓ | | Status + Manage-Link |
| Actions-Sektion | ✓ | | Encounter-Button |
| Collapsed Quick-Controls | | mittel | Responsive UI |

---

*Siehe auch: [DetailView.md](DetailView.md) | [Application.md](../architecture/Application.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md)*
