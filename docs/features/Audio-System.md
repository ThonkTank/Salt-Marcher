# Audio-System

> **Lies auch:** [Time-System](Time-System.md), [Weather-System](Weather-System.md)
> **Wird benoetigt von:** SessionRunner

Kontextbasierte Hintergrundmusik und Umgebungsgeraeusche.

**Design-Philosophie:** Audio unterstuetzt die Atmosphaere automatisch basierend auf dem aktuellen Kontext (Location, Wetter, Tageszeit, Combat-Status). Songs werden dynamisch ueber Mood-Tags ausgewaehlt - keine Playlists noetig.

---

## Uebersicht

Das Audio-System bietet:

1. **2 Audio Layer** - Music und Ambience separat steuerbar
2. **Track-basiertes System** - Jeder Track hat Mood-Tags fuer automatische Auswahl
3. **Mood-Matching** - Automatische Track-Auswahl basierend auf Kontext
4. **Crossfade** - Sanfte Uebergaenge zwischen Tracks

```
┌─────────────────────────────────────────────────────────────────┐
│  Audio Panel (SessionRunner)                                     │
│  - Play/Pause/Skip                                               │
│  - Volume pro Layer                                              │
│  - Crossfade Toggle                                              │
├─────────────────────────────────────────────────────────────────┤
│  Audio Feature                                                   │
│  - MoodContext → Track Selection via Tags                        │
│  - Playback Control                                              │
├─────────────────────────────────────────────────────────────────┤
│  2 Audio Layer                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │   Music Layer       │  │   Ambience Layer    │               │
│  │   (Hintergrund-     │  │   (Umgebungs-       │               │
│  │    musik)           │  │    geraeusche)      │               │
│  └─────────────────────┘  └─────────────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  HTML5 Audio API                                                 │
│  Files aus Vault: SaltMarcher/audio/                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Audio Layers

| Layer | Zweck | Beispiele |
|-------|-------|-----------|
| **Music** | Hintergrundmusik | Tavern Theme, Battle Music, Exploration |
| **Ambience** | Umgebungsgeraeusche | Regen, Wind, Wald, Stadt, Dungeon Drip |

### Warum 2 Layer?

- **Unabhaengige Kontrolle** - Ambience kann lauter/leiser als Musik sein
- **Gleichzeitige Wiedergabe** - "Tavern Music" + "Regen draussen"
- **Separates Matching** - Ambience wechselt mit Wetter, Musik mit Stimmung

---

## Schemas

### Track (Audio-Entity)

Jeder Track ist eine eigenstaendige Entity mit Mood-Tags:

```typescript
interface Track {
  id: EntityId<'track'>;
  title: string;
  filename: string;            // Relativer Pfad in Vault
  layer: 'music' | 'ambience';
  duration?: number;           // In Sekunden (auto-detected)

  // Mood-Tags fuer automatische Auswahl
  tags: {
    locations?: string[];      // "tavern", "forest", "dungeon", "town"
    weather?: string[];        // "rain", "storm", "clear", "snow"
    timeOfDay?: string[];      // "day", "night", "dawn", "dusk"
    mood?: string[];           // "tense", "relaxed", "combat", "mystery"
  };

  // Optional: Looping fuer Ambience
  loop?: boolean;              // Default: false fuer Music, true fuer Ambience

  // Session-State (nicht persistiert)
  lastPlayedAt?: number;       // Unix-Timestamp, fuer LRP Tiebreaker
}
```

> **Kein Playlist-Konzept:** Tracks werden direkt ueber ihre Tags ausgewaehlt. Die dynamische Selektion ersetzt statische Playlists.

### MoodContext

```typescript
interface MoodContext {
  location: LocationType;      // "tavern", "wilderness", "dungeon", "town"
  weather: WeatherType;        // Aus Weather-System
  timeOfDay: TimeSegment;      // "day", "night", "dawn", "dusk"
  combatState: 'idle' | 'active';
}

type LocationType =
  | 'wilderness'
  | 'forest'
  | 'mountain'
  | 'desert'
  | 'swamp'
  | 'coast'
  | 'town'
  | 'tavern'
  | 'dungeon'
  | 'cave';
```

---

## Track-Organisation

### File-Struktur im Vault

```
Vault/
└── SaltMarcher/
    └── audio/
        ├── music/
        │   ├── jolly-tavern-01.mp3
        │   ├── jolly-tavern-02.mp3
        │   ├── battle-drums-01.mp3
        │   ├── forest-exploration.mp3
        │   └── sad-bard.mp3
        └── ambience/
            ├── birds-chirping.mp3
            ├── wind-through-leaves.mp3
            ├── heavy-rain.mp3
            └── dungeon-drip.mp3
```

### Track-Erstellung

```
GM klickt "Track hinzufuegen" in Library
    │
    ├── Datei-Auswahl Dialog (OS-native)
    │   └── File wird kopiert nach: Vault/SaltMarcher/audio/{layer}/
    │
    ├── Formular: Title, Layer, Tags
    │
    └── Track-Entity wird erstellt
```

---

## Mood-Matching

### Automatische Track-Auswahl

Je mehr Tags uebereinstimmen, desto wahrscheinlicher wird der Track ausgewaehlt:

```typescript
function selectTrack(
  context: MoodContext,
  layer: 'music' | 'ambience'
): Track | null {
  const candidates = tracks.filter(t => t.layer === layer);
  return findBestMatch(candidates, context);
}

function findBestMatch(
  candidates: Track[],
  context: MoodContext
): Track | null {
  // Score jeden Track basierend auf Tag-Matches
  const scored = candidates.map(track => ({
    track,
    score: calculateMatchScore(track, context)
  }));

  // Beste Tracks mit Score > 0
  scored.sort((a, b) => b.score - a.score);

  // Top-Matches innerhalb 80% des Bestscore
  const topMatches = scored.filter(s => s.score > 0 && s.score >= scored[0]?.score * 0.8);
  if (topMatches.length === 0) return null;

  // Least-Recently-Played Tiebreaker (statt Random)
  // Waehlt den Track der am laengsten nicht gespielt wurde
  topMatches.sort((a, b) =>
    (a.track.lastPlayedAt ?? 0) - (b.track.lastPlayedAt ?? 0)
  );
  return topMatches[0].track;
}

function calculateMatchScore(
  track: Track,
  context: MoodContext
): number {
  let score = 0;

  // Combat hat hoechste Prioritaet
  if (context.combatState === 'active') {
    if (track.tags.mood?.includes('combat')) {
      score += 100;
    } else {
      return 0;  // Nur Combat-Tracks waehrend Combat
    }
  }

  // Location-Match (+30)
  if (track.tags.locations?.includes(context.location)) {
    score += 30;
  }

  // Weather-Match (+20, besonders fuer Ambience)
  if (track.tags.weather?.includes(context.weather)) {
    score += 20;
  }

  // TimeOfDay-Match (+10)
  if (track.tags.timeOfDay?.includes(context.timeOfDay)) {
    score += 10;
  }

  return score;
}
```

### Context-Updates

```
time:state-changed → Update timeOfDay
environment:weather-changed → Update weather
party:position-changed → Update location
combat:started → combatState = 'active'
combat:completed → combatState = 'idle'
```

---

## Playback

### HTML5 Audio

```typescript
interface AudioLayer {
  layer: 'music' | 'ambience';
  element: HTMLAudioElement;
  currentTrack?: Track;
  volume: number;              // 0-1
}

function playTrack(layer: AudioLayer, track: Track): void {
  const filePath = `${vault.basePath}/SaltMarcher/audio/${track.filename}`;

  layer.element.src = filePath;
  layer.element.volume = layer.volume;
  layer.element.loop = track.loop ?? (layer.layer === 'ambience');
  layer.element.play();
}
```

### Track-Ende Handling

```typescript
// Wenn Track endet (und nicht looped)
audioElement.addEventListener('ended', () => {
  // Naechsten passenden Track auswaehlen
  const nextTrack = selectTrack(currentContext, layer);
  if (nextTrack) {
    crossfade(layer, nextTrack);
  }
});
```

### Crossfade

```typescript
async function crossfade(
  layer: AudioLayer,
  newTrack: Track,
  durationMs: number = 3000
): Promise<void> {
  const steps = 30;
  const stepDuration = durationMs / steps;
  const volumeStep = layer.volume / steps;

  // Fade Out aktueller Track
  for (let i = 0; i < steps; i++) {
    layer.element.volume = Math.max(0, layer.volume - (volumeStep * i));
    await sleep(stepDuration);
  }

  // Wechsel zum neuen Track
  playTrack(layer, newTrack);

  // Fade In neuer Track
  layer.element.volume = 0;
  for (let i = 0; i < steps; i++) {
    layer.element.volume = Math.min(layer.volume, volumeStep * i);
    await sleep(stepDuration);
  }
}
```

---

## GM-Interface

### Audio Panel (SessionRunner)

```
┌─────────────────────────────────────────────────────────────────┐
│  Audio                                                           │
├─────────────────────────────────────────────────────────────────┤
│  Music                                                           │
│  ▶ "Jolly Tavern 02"                                            │
│  ████████░░░░░░░░░░░░░░░░░  2:34 / 4:12                        │
│  [◀] [▶/❚❚] [▶▶]            Vol: ████████░░ 70%                 │
├─────────────────────────────────────────────────────────────────┤
│  Ambience                                                        │
│  ▶ "Heavy Rain Loop"                                             │
│  (looping)                                                       │
│  [▶/❚❚]                     Vol: █████░░░░░ 50%                 │
├─────────────────────────────────────────────────────────────────┤
│  Settings                                                        │
│  ☑ Auto-Switch on Context                                       │
│  ☑ Crossfade (3s)                                               │
├─────────────────────────────────────────────────────────────────┤
│  [Manual Override ▼]                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Manual Override

Wenn Auto-Switch deaktiviert oder GM manuell eingreift:

```
┌─────────────────────────────────────────────────────────────────┐
│  Track waehlen: Music                                            │
├─────────────────────────────────────────────────────────────────┤
│  Empfohlen (basierend auf Context):                              │
│  • Jolly Tavern 01  [tavern, relaxed]                           │
│  • Jolly Tavern 02  [tavern, relaxed]                           │
│  • Sad Bard         [tavern, melancholy]                        │
│                                                                  │
│  Alle Music Tracks:                                              │
│  • Battle Drums 01  [combat]                                    │
│  • Forest Exploration [wilderness, day]                         │
│  • Mystery Theme    [dungeon, mystery]                          │
│  • ...                                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Track-Editor (Library)

```
┌─────────────────────────────────────────────────────────────────┐
│  Track bearbeiten: Jolly Tavern 02                               │
├─────────────────────────────────────────────────────────────────┤
│  Title:    [Jolly Tavern 02      ]                              │
│  Layer:    [Music ▼]                                            │
│  File:     music/jolly-tavern-02.mp3                            │
├─────────────────────────────────────────────────────────────────┤
│  Tags:                                                           │
│  Locations: [tavern] [+]                                        │
│  Mood:      [relaxed] [+]                                       │
│  Time:      [evening] [night] [+]                               │
│  Weather:   [+]                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ☐ Loop                                                          │
├─────────────────────────────────────────────────────────────────┤
│  [Speichern] [Abbrechen]                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Events

```typescript
// Requests
'audio:play-requested': { layer?: 'music' | 'ambiance' | 'all' }
'audio:pause-requested': {}
'audio:resume-requested': {}
'audio:skip-requested': { layer: 'music' | 'ambiance' }
'audio:set-volume-requested': { layer: 'music' | 'ambiance'; volume: number }
'audio:override-track-requested': { layer: 'music' | 'ambiance'; trackId: string }

// State-Changes
'audio:state-changed': { state: AudioState }
'audio:volume-changed': { layer: 'music' | 'ambiance'; volume: number }

// Lifecycle
'audio:track-changed': {
  layer: 'music' | 'ambiance';
  previousTrack?: string;
  newTrack: string;
  reason: 'context-change' | 'track-ended' | 'user-skip' | 'user-override';
}
'audio:paused': { layer: 'music' | 'ambiance' | 'all' }
'audio:resumed': { layer: 'music' | 'ambiance' | 'all' }

// Context-Update (triggert potentiellen Track-Wechsel)
'audio:context-changed': { context: MoodContext }
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Settings

| Setting | Typ | Default | Beschreibung |
|---------|-----|---------|--------------|
| Music Volume | 0-100 | 70 | Lautstaerke Music Layer |
| Ambience Volume | 0-100 | 50 | Lautstaerke Ambience Layer |
| Crossfade | boolean | true | Sanfte Uebergaenge |
| Crossfade Duration | seconds | 3 | Dauer der Ueberblendung |
| Auto-Switch on Context | boolean | true | Automatischer Track-Wechsel |

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| 2 Audio Layer | ✓ | | Music + Ambience |
| Basic Playback | ✓ | | HTML5 Audio |
| Track Entity mit Tags | ✓ | | Ersetzt Playlists |
| Volume Control | ✓ | | Pro Layer |
| Manual Override | ✓ | | Track direkt waehlen |
| Mood-Matching (Basic) | ✓ | | Location + Combat |
| Crossfade | ✓ | | Sanfte Uebergaenge |
| Auto-Switch | | mittel | Bei Context-Aenderung |
| Weather-Matching | | niedrig | Ambience + Wetter |

---

*Siehe auch: [Weather-System.md](Weather-System.md) | [Travel-System.md](Travel-System.md) | [Events-Catalog.md](../architecture/Events-Catalog.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1100 | ⬜ | Audio | features | AudioLayer Interface: music + ambience mit HTMLAudioElement | hoch | Ja | - | Audio-System.md#audio-layers, Audio-System.md#playback, Audio-System.md#schemas | [neu] src/features/audio/types.ts:AudioLayer |
| 1101 | ⬜ | Audio | core | Track Entity Schema: id, title, filename, layer, tags, loop | hoch | Ja | #2801 | Audio-System.md#schemas, EntityRegistry.md, Core.md#schemas | [neu] src/core/schemas/track.ts |
| 1102 | ⬜ | Audio | features | MoodContext Interface: location, weather, timeOfDay, combatState | hoch | Ja | - | Audio-System.md#schemas, Audio-System.md#mood-context, Features.md#audio-hybrid-feature | [neu] src/features/audio/types.ts:MoodContext, src/features/audio/types.ts:LocationType |
| 1103 | ⛔ | Audio | features | Basic Playback implementieren: playTrack() mit HTML5 Audio API für beide Layer | hoch | Ja | #1100, #1101, #3117 | Audio-System.md#html5-audio, Audio-System.md#playback | [neu] src/features/audio/playback.ts:playTrack() |
| 1104 | ⛔ | Audio | features | Volume Control implementieren: setVolume() pro Layer (0-100) | hoch | Ja | #1100 | Audio-System.md#gm-interface, Audio-System.md#settings | [neu] src/features/audio/playback.ts:setVolume() |
| 1105 | ⛔ | Audio | features | Track-Ende Handler implementieren: Nächsten Track auswählen bei ended-Event | hoch | Ja | #1103, #1108 | Audio-System.md#track-ende-handling | [neu] src/features/audio/playback.ts:handleTrackEnded(), [ändern] src/features/audio/playback.ts:playTrack() |
| 1106 | ⛔ | Audio | features | Crossfade implementieren: crossfade() mit konfigurierbarer Dauer (fade-out, track-switch, fade-in) | hoch | Ja | #1103, #1104, #3119 | Audio-System.md#crossfade | [neu] src/features/audio/playback.ts:crossfade() |
| 1107 | ⛔ | Audio | features | Mood-Matching Score-Berechnung implementieren: calculateMatchScore() für Location + Combat + Weather + Time | hoch | Ja | #1101, #1102 | Audio-System.md#automatische-track-auswahl, Audio-System.md#mood-matching | [neu] src/features/audio/mood-matching.ts:calculateMatchScore() |
| 1108 | ⛔ | Audio | features | Track-Selektion implementieren: selectTrack() mit Beste Match aus Kandidaten (80%-Threshold + LRP Tiebreaker) | hoch | Ja | #1102, #1107 | Audio-System.md#mood-matching, Audio-System.md#automatische-track-auswahl, Features.md#audio-hybrid-feature | [neu] src/features/audio/mood-matching.ts:selectTrack(), src/features/audio/mood-matching.ts:findBestMatch() |
| 1109 | ⛔ | Audio | features | Manual Override implementieren: Track direkt wählen (umgeht Mood-Matching) | hoch | Ja | #1103, #1108 | Audio-System.md#gm-interface, Audio-System.md#manual-override, Events-Catalog.md#audio | [neu] src/features/audio/orchestrator.ts:overrideTrack() |
| 1110 | ⛔ | Audio | features | Audio Event Handler Setup implementieren: play/pause/skip/volume/override-requested Handler registrieren | hoch | Ja | #1100, #1102, #1103 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#gm-interface | [neu] src/features/audio/orchestrator.ts:setupEventHandlers(), [neu] src/features/audio/types.ts:AudioState |
| 1111 | ⛔ | Audio | features | audio:state-changed Event publizieren implementieren: Nach jeder State-Änderung | hoch | Ja | #1110 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#gm-interface | [neu] src/features/audio/orchestrator.ts:publishStateChanged() |
| 1112 | ⛔ | Audio | features | audio:track-changed Event publizieren implementieren: Mit reason (context-change/track-ended/user-skip/user-override) | hoch | Ja | #1110 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#context-updates | [neu] src/features/audio/orchestrator.ts:publishTrackChanged() |
| 1113 | ⛔ | Audio | features | Auto-Switch on Context implementieren: Automatischer Track-Wechsel bei Context-Änderung (wenn enabled) | mittel | Nein | #1108, #909, #110, #12, #322, #324, #3119 | Audio-System.md#context-updates, Audio-System.md#automatic-track-auswahl, Features.md#audio-hybrid-feature | [neu] src/features/audio/orchestrator.ts:handleContextChange(), [ändern] src/features/audio/orchestrator.ts:setupEventHandlers() |
| 1114 | ⛔ | Audio | features | Weather-Matching implementieren: Ambience-Track anpassen bei weather-changed Event | niedrig | Nein | #909, #1107, #1108, #1113 | Audio-System.md#context-updates, Weather-System.md#event-flow, Events-Catalog.md#environment, Time-System.md#consumer | [ändern] src/features/audio/mood-matching.ts:calculateMatchScore(), [ändern] src/features/audio/orchestrator.ts:handleContextChange() |
| 1115 | ⛔ | Audio | features | audio:context-changed Event Handler implementieren: MoodContext-Update verarbeiten | mittel | Nein | #110, #1102, #1108, #1113 | Audio-System.md#context-updates, Weather-System.md#event-flow, Events-Catalog.md#environment | [neu] src/features/audio/orchestrator.ts:handleAudioContextChanged(), [ändern] src/features/audio/orchestrator.ts:setupEventHandlers() |
| 1119 | ⛔ | Audio | - | audio:pause-requested Event Handler implementieren: Playback pausieren | hoch | Ja | #1103 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#gm-interface | [neu] src/features/audio/orchestrator.ts:handlePauseRequested() |
| 1120 | ⛔ | Audio | features | audio:resume-requested Event Handler implementieren: Playback fortsetzen | hoch | Ja | #1103 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#gm-interface | [neu] src/features/audio/orchestrator.ts:handleResumeRequested() |
| 1121 | ⛔ | Audio | features | audio:skip-requested Event Handler implementieren: Zum nächsten passenden Track springen | hoch | Ja | #1103, #1108 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#gm-interface | [neu] src/features/audio/orchestrator.ts:handleSkipRequested() |
| 3040 | ⬜ | Audio | features | audio:set-volume-requested Event Handler implementieren: Volume Control (0-100) | hoch | -d | #1104, #1110 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#settings | [neu] src/features/audio/orchestrator.ts:handleSetVolumeRequested() |
| 3041 | ⬜ | Audio | features | audio:override-track-requested Event Handler implementieren: Manual Override für Track-Auswahl | hoch | -d | #1109, #1110 | Audio-System.md#events, Events-Catalog.md#audio, Audio-System.md#manual-override | [neu] src/features/audio/orchestrator.ts:handleOverrideTrackRequested() |
| 3042 | ⬜ | Audio | features | party:position-changed Event Handler implementieren: Location-Update in MoodContext | mittel | Nein | #1102, #12 | Audio-System.md#context-updates, Events-Catalog.md#party | [neu] src/features/audio/orchestrator.ts:handlePartyPositionChanged() |
| 3043 | ⬜ | Audio | features | combat:started Event Handler implementieren: combatState='active' in MoodContext setzen | mittel | Nein | #1102, #322 | Audio-System.md#context-updates, Events-Catalog.md#combat | [neu] src/features/audio/orchestrator.ts:handleCombatStarted() |
| 3044 | ⬜ | Audio | features | combat:completed Event Handler implementieren: combatState='idle' in MoodContext setzen | mittel | Nein | #1102, #324 | Audio-System.md#context-updates, Events-Catalog.md#combat | [neu] src/features/audio/orchestrator.ts:handleCombatCompleted() |
| 3045 | ⬜ | Audio | features | Least-Recently-Played Tiebreaker implementieren: Track.lastPlayedAt für Tie-Breaking bei gleichen Scores nutzen | hoch | -d | #1108, #1101 | Audio-System.md#mood-matching, Audio-System.md#automatische-track-auswahl | [ändern] src/features/audio/mood-matching.ts:findBestMatch(), [ändern] src/features/audio/playback.ts:playTrack() |
| 3046 | ⬜ | Audio | application | Audio Settings UI implementieren: Music Volume, Ambience Volume, Crossfade Toggle, Crossfade Duration, Auto-Switch on Context | hoch | -d | #1104, #1106, #1113, #3116, #3119 | Audio-System.md#settings, Audio-System.md#gm-interface | [neu] src/application/session-runner/AudioSettingsPanel.svelte |
| 3047 | ⬜ | Audio | application | Track-Editor UI in Library implementieren: Title, Layer, Tags (locations, mood, time, weather), Loop Toggle | mittel | Nein | #1101, #3056, #3120 | Audio-System.md#track-editor-library, Library.md | [neu] src/application/library/TrackEditor.svelte |
| 3048 | ⬜ | Audio | application | Audio Panel in SessionRunner implementieren: Play/Pause/Skip Buttons, Volume Slider, Progress Bar, Manual Override Dropdown | hoch | -d | #1103, #1104, #1119, #1120, #1121, #3116 | Audio-System.md#audio-panel-sessionrunner, SessionRunner.md#audio-sektion | [neu] src/application/session-runner/AudioPanel.svelte |
| 3054 | ⬜ | Audio | infrastructure | Track File Upload implementieren: Datei-Dialog, Copy nach Vault/SaltMarcher/audio/{layer}/, Auto-Detect Duration | mittel | Nein | #1101, #3056 | Audio-System.md#track-erstellung, Audio-System.md#file-struktur-im-vault | [neu] src/infrastructure/vault/audio-file-handler.ts:uploadAudioFile(), [neu] src/infrastructure/vault/audio-duration-detector.ts:detectDuration() |
| 3055 | ⬜ | Audio | features | audio:play-requested Event Handler implementieren: start/resume playback für layer | hoch | -d | #1103, #1110 | Audio-System.md#events, Events-Catalog.md#audio | [neu] src/features/audio/orchestrator.ts:handlePlayRequested() |
| 3056 | ⬜ | Audio | features | Track CRUD implementieren: createTrack, updateTrack, deleteTrack, getTrack, getAllTracks | hoch | -d | #1101, #3117 | Audio-System.md#schemas, EntityRegistry.md | [neu] src/features/audio/track-service.ts:createTrack(), updateTrack(), deleteTrack(), getTrack(), getAllTracks() |
| 3057 | ⬜ | Audio | features | audio:paused Event publizieren implementieren (lifecycle event) | hoch | -d | #1119, #1110 | Audio-System.md#events, Events-Catalog.md#audio | [ändern] src/features/audio/orchestrator.ts:handlePauseRequested() |
| 3058 | ⬜ | Audio | features | audio:resumed Event publizieren implementieren (lifecycle event) | hoch | -d | #1120, #1110 | Audio-System.md#events, Events-Catalog.md#audio | [ändern] src/features/audio/orchestrator.ts:handleResumeRequested() |
| 3059 | ⬜ | Audio | features | audio:volume-changed Event publizieren implementieren (state-change event) | hoch | -d | #1104, #1110 | Audio-System.md#events, Events-Catalog.md#audio | [ändern] src/features/audio/orchestrator.ts:handleSetVolumeRequested() |
| 3068 | ⬜ | Audio | application | Manual Override Track Selection UI implementieren: Empfohlene Tracks (basierend auf Context) + Alle verfügbaren Tracks anzeigen | mittel | Nein | #1108, #1109, #3116, #3121 | Audio-System.md#manual-override, Audio-System.md#gm-interface | [neu] src/application/session-runner/TrackSelectionModal.svelte |
| 3185 | ⬜ | Audio | - | time:state-changed Event Handler implementieren: timeOfDay-Update in MoodContext | mittel | Nein | #110, #1102 | Audio-System.md#context-updates, Time-System.md#events, Events-Catalog.md#time | [neu] src/features/audio/orchestrator.ts:handleTimeStateChanged() |
| 3186 | ⬜ | Audio | - | AudioState Interface implementieren: playbackState, currentTracks, volumes, settings | hoch | --deps | - | Audio-System.md#events, Audio-System.md#gm-interface | [neu] src/features/audio/types.ts:AudioState |
| 3187 | ⬜ | Audio | - | Audio Feature Orchestrator implementieren: createAudioOrchestrator() Factory mit Event-Setup und State-Management | hoch | --deps | #1100, #1102, #1103, #1110, #3186, #3189 | Audio-System.md#events, Features.md#audio-hybrid-feature | [neu] src/features/audio/orchestrator.ts:createAudioOrchestrator() |
| 3188 | ⬜ | Audio | - | Loop-Handling implementieren: Ambience-Tracks automatisch loopen, Music-Tracks nicht | hoch | --deps | - | Audio-System.md#playback, Audio-System.md#schemas | [ändern] src/features/audio/playback.ts:playTrack() |
| 3189 | ⬜ | Audio | - | Audio StoragePort Interface definieren: loadTrack, saveTrack, deleteTrack, getAllTracks | hoch | --spec | - | - | [neu] src/features/audio/ports.ts:AudioStoragePort |
| 3190 | ⬜ | Audio | - | Audio VaultAdapter implementieren: Track-Files aus Vault/SaltMarcher/audio/ laden | hoch | --spec | - | - | [neu] src/infrastructure/vault/audio-vault-adapter.ts |
| 3197 | ⬜ | Audio | - | Audio Settings Schema definieren: musicVolume, ambienceVolume, crossfadeEnabled, crossfadeDuration, autoSwitch | hoch | --spec | - | - | [neu] src/features/audio/types.ts:AudioSettings |
| 3198 | ⬜ | Audio | - | getTracksForLayer Query-Funktion implementieren: Filtere Tracks nach Layer (music/ambience) | hoch | --deps | - | Audio-System.md#track-organisation, Audio-System.md#gm-interface | [neu] src/features/audio/track-service.ts:getTracksForLayer() |
| 3199 | ⬜ | Audio | - | getRecommendedTracks Query-Funktion implementieren: Sortiere Tracks nach Context-Score für Manual Override UI | mittel | Nein | #1107, #1108 | Audio-System.md#manual-override | [neu] src/features/audio/mood-matching.ts:getRecommendedTracks() |
