# SessionRunner (UI)

> **Architektur:** [Orchestration.md](../architecture/Orchestration.md)
> **Companion View:** [DetailView](DetailView.md) (rechtes Panel)

Die zentrale Spielansicht während einer D&D-Session. Zeigt die Karte und Quick-Controls für schnellen GM-Zugriff.

**Pfad:** `src/views/session-runner/`

---

## Übersicht

Der SessionRunner ist die Hauptansicht für den aktiven Spielbetrieb mit **schnellem Zugriff** zu häufig benötigten Controls:

| Bereich | Funktion |
|---------|----------|
| **Header** | Zeit, Quick-Advance, Weather-Status |
| **Quick-Controls** | Travel, Audio, Party-Status, Quests, Actions |
| **Map-Panel** | Karten-Anzeige mit Party-Token und Overlays |

Kontextbezogene Detail-Ansichten (Encounter, Combat, Shop) werden in der separaten [DetailView](DetailView.md) angezeigt.

---

## View ↔ SessionControl-Verbindung

Die View subscribet auf den reaktiven State des SessionControls:

```svelte
<script>
  import { sessionControl } from '$lib/session';

  // Automatische Subscription via $-Prefix
  $: state = $sessionControl.state;
  $: travel = state.travel;
  $: time = state.time;
  $: weather = state.weather;
</script>

<!-- Travel-Controls -->
{#if travel.status === 'idle'}
  <button on:click={() => sessionControl.startTravel(route)}>Start</button>
{:else if travel.status === 'traveling'}
  <button on:click={() => sessionControl.pauseTravel()}>Pause</button>
{/if}

<!-- Time Display -->
<span>{formatDateTime(time.currentDateTime)}</span>

<!-- Weather Display -->
<span>{weather?.description ?? 'Clear'}</span>
```

**Kein EventBus.** Die UI ruft Methoden direkt auf und liest State via Store-Subscription.

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
│  │                │  │                                                    │ │
│  │ ⚔️ ACTIONS     │  │                                                    │ │
│  │ ─────────────  │  │                                                    │ │
│  │ [🛏️ Rest]      │  │  [Overlays: ☐Weather ☑️Territory ☐Factions]         │ │
│  │                │  │                                                    │ │
│  └────────────────┘  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Panel-Beschreibungen

### Header

Kompakte Anzeige von Zeit und Wetter mit Quick-Controls.

| Element | Funktion | SessionControl-Aufruf |
|---------|----------|---------------------|
| `📅 15. Mirtul, 14:30` | Aktuelles Datum/Zeit | `state.time.currentDateTime` |
| `☀️ Clear` | Wetter-Status | `state.weather.description` |
| `⚙️` | Settings | - |

### Quick-Controls

#### Travel-Sektion

```svelte
<script>
  $: travel = $sessionControl.state.travel;
</script>

{#if travel.status === 'idle'}
  <button on:click={() => sessionControl.enterPlanningMode()}>Plan</button>
{:else if travel.status === 'planning'}
  <button on:click={() => sessionControl.startTravel(route)}>Start</button>
  <button on:click={() => sessionControl.cancelPlanning()}>Cancel</button>
{:else if travel.status === 'traveling'}
  <span>Traveling... {travel.progress.current}/{travel.progress.total}</span>
  <button on:click={() => sessionControl.pauseTravel()}>Pause</button>
{:else if travel.status === 'paused'}
  <button on:click={() => sessionControl.resumeTravel()}>Resume</button>
  <button on:click={() => sessionControl.cancelTravel()}>Stop</button>
{/if}
```

#### Audio-Sektion

| Element | Funktion | SessionControl-Aufruf |
|---------|----------|---------------------|
| Track-Name | Aktueller Track | `state.audio.currentMusic` |
| `[⏸]` | Play/Pause | `toggleAudio()` |
| `[⏭]` | Skip | `skipTrack()` |
| `[🔊]` | Volume | `setVolume(value)` |

#### Party-Sektion

| Element | Funktion | Daten |
|---------|----------|-------|
| Status | Anzahl PCs | `state.party.members.length` |
| Health | Health-Summary | computed |
| `[Manage →]` | Öffnet Party-Tab | navigiert zu DetailView |

#### Actions-Sektion

| Element | Funktion | SessionControl-Aufruf |
|---------|----------|---------------------|
| `[🛏️ Rest]` | Short/Long Rest starten | `startRest(type)` |

---

## Map-Panel

Zeigt die aktive Karte mit Party-Position.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                                       │
│    ⬡ 🌲 🌲 ⛰️ ⛰️ 🌲 🌲 ⬡                                      │
│     ⬡ 🌲 🏠 🌲 🌲 🌲 ⬡ ⬡          🎯 = Party Position         │
│    ⬡ 🌲 🌲 🎯 🌲 🌲 ⬡ ⬡          🏠 = Location (POI)         │
│     ⬡ 🌊 🌊 🌲 🌲 ⬡ ⬡ ⬡                                       │
│    ⬡ ⬡ 🌊 🌊 🌲 ⬡ ⬡ ⬡                                        │
│                                                                │
│  [Overlays: ☐Weather ☑️Territory ☐Factions] [🔍+] [🔍-]        │
└────────────────────────────────────────────────────────────────┘
```

### Map-Interaktionen

| Aktion | Effekt | SessionControl-Aufruf |
|--------|--------|---------------------|
| **Kamera** | | |
| Mittlere Maustaste (halten) | Pan | `updateCamera(offset)` |
| Scroll | Zoom | `updateCamera(zoom)` |
| **Travel-Modus** | | |
| Linksklick auf Tile | Waypoint setzen | `addWaypoint(coord)` |
| Rechtsklick auf Waypoint | Löschen | `removeWaypoint(index)` |
| **Normal-Modus** | | |
| Linksklick auf Tile | Tile auswählen | `selectTile(coord)` |
| Doppelklick auf POI | POI-Details | navigiert zu DetailView |

---

## Interaktions-Flows

### Flow: Reise starten

```
User klickt [Plan]
    ↓
sessionControl.enterPlanningMode()
    ↓
state.travel.status = 'planning'
    ↓
Map zeigt Route-Overlay
    ↓
User setzt Waypoints (Klicks auf Map)
    ↓
User klickt [Start]
    ↓
sessionControl.startTravel(route)
    ↓
state.travel.status = 'traveling'
    ↓
SessionControl führt Travel-Loop aus:
    - Position aktualisieren
    - Zeit voranschreiten
    - Wetter neu berechnen
    - Encounter-Checks
    ↓
Bei Encounter:
    - state.travel.status = 'paused'
    - state.encounter.status = 'preview'
    - DetailView zeigt Encounter
```

### Flow: Rast starten

```
User klickt [Rest]
    ↓
Modal: Short/Long Rest wählen
    ↓
User bestätigt
    ↓
sessionControl.startRest(type)
    ↓
state.rest.status = 'resting'
    ↓
SessionControl führt Rest-Loop aus:
    - Pro Stunde: Encounter-Check
    - Bei Encounter: rest pausiert
    ↓
Rest abgeschlossen:
    - state.rest.status = 'idle'
    - HP-Recovery, etc.
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion | SessionControl-Aufruf |
|----------|--------|---------------------|
| `Space` | Travel Start/Pause | `toggleTravel()` |
| `Escape` | Cancel | `cancelCurrentAction()` |
| `+`/`-` | Zoom | `updateCamera(zoom)` |
| `Arrow Keys` | Pan | `updateCamera(offset)` |

---

## Priorität

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| Map-Panel mit Party-Token | ✓ | |
| Quick-Controls Sidebar | ✓ | |
| Header (Time, Weather) | ✓ | |
| Travel-Sektion | ✓ | |
| Audio-Sektion | ✓ | |
| Party-Sektion | ✓ | |
| Quest-Sektion | ✓ | |
| Actions-Sektion | ✓ | |
| Collapsed Quick-Controls | | mittel |
| Visibility-Toggle | | mittel |
| Animations-Geschwindigkeit | | niedrig |

---

*Siehe auch: [Orchestration](../architecture/Orchestration.md) | [DetailView](DetailView.md)*
