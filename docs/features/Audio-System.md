# Audio-System

> **Verantwortlichkeit:** Kontextbasierte Hintergrundmusik und Umgebungsgeraeusche
> **Schema:** [track.md](../data/track.md)
>
> **Verwandte Dokumente:**
> - [Time-System.md](Time-System.md) - Tageszeit-Context
> - [Weather.md](../services/Weather.md) - Wetter-Ambience
> - [Travel-System.md](Travel-System.md) - Reise-Musik
> - [Events-Catalog.md](../architecture/Events-Catalog.md) - audio:* Events
>
> **Wird benoetigt von:** SessionControl

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
  weather: WeatherType;        // Aus Weather-Service
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


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
