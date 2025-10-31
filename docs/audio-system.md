# Audio System

**Status**: Phase 6.2 Complete ✅ | Phase 6.3+ In Progress

## Overview

The audio system provides context-aware background music and ambience for D&D sessions. Playlists automatically switch based on terrain, weather, time of day, faction presence, and current situation (combat, exploration, etc.).

## Architecture

### Phase 6.1: Playlist Entity ✅

**Goal**: Define playlist data structure and integrate with Library system

**Location**: `src/workmodes/library/playlists/`

**Components**:
- `types.ts` - Data types for playlists and tracks
- `constants.ts` - Preset tag vocabularies (16 terrain, 9 weather, 8 time, 12 faction, 15 situation)
- `serializer.ts` - Markdown serialization with YAML frontmatter
- `create-spec.ts` - CreateSpec with tag-based filtering fields
- Library integration via `src/workmodes/library/registry.ts`

### Phase 6.2: Playlist Manager UI ✅

**Goal**: Editor UI for managing tracks and configuring playback

**Status**: Complete - UI auto-generated from CreateSpec

**Implementation**:
- Library tab integration (`src/workmodes/library/view.ts` - added "playlists" mode)
- Track list editor (auto-generated from "list" field type in CreateSpec)
- Tag selection UI (auto-generated from "tokens" field type for all 5 tag categories)
- Playback controls (auto-generated from "checkbox" and "number-stepper" fields)
- Full CRUD operations through Library browse view (create/edit/delete/search/filter/sort)

**How It Works**:
The CreateSpec pattern (`src/workmodes/library/playlists/create-spec.ts`) declaratively defines all UI fields. The data-manager system automatically generates:
- Modal editor with all field types properly rendered
- Browse view with filtering and sorting
- CRUD handlers that use the serializer for persistence

### Phase 6.3: Audio Player Core ⏳

**Goal**: Audio playback engine with crossfade and volume control

**Components**:
- Track player service (play/pause/skip/stop)
- Crossfade transitions between tracks
- Volume control per track and global
- Shuffle and loop logic

### Phase 6.4: Auto-Selection System ⏳

**Goal**: Automatic playlist switching based on session context

**Components**:
- Context-based playlist filter (terrain/weather/time/faction/situation)
- Session Runner integration (auto-switch on context change)
- Quick-switch UI (manual override)
- E2E tests for filter logic and context updates

## Data Structure

### Playlist Entity

```typescript
interface PlaylistData {
  name: string;                    // Unique identifier
  display_name?: string;            // UI display name
  type: "ambience" | "music";      // Playlist category
  description?: string;             // Optional description

  // Tag-based filtering (auto-selection)
  terrain_tags?: Array<{ value: string }>;        // Forest, Mountain, etc.
  weather_tags?: Array<{ value: string }>;        // Clear, Rain, Storm, etc.
  time_of_day_tags?: Array<{ value: string }>;   // Dawn, Night, etc.
  faction_tags?: Array<{ value: string }>;        // Friendly, Hostile, Undead, etc.
  situation_tags?: Array<{ value: string }>;      // Combat, Exploration, etc.

  // Playback configuration
  shuffle?: boolean;               // Random track order
  loop?: boolean;                  // Loop playlist
  crossfade_duration?: number;     // Seconds (default: 2)
  default_volume?: number;         // 0.0 - 1.0 (default: 0.7)

  // Tracks
  tracks: AudioTrack[];
}

interface AudioTrack {
  name: string;                    // Track title
  source: string;                  // File path or URL
  duration?: number;               // Seconds (for display)
  volume?: number;                 // Track-specific volume (0.0 - 1.0)
}
```

### Storage Format

Playlists are stored as Markdown files with YAML frontmatter in `Playlists/` folder:

```yaml
---
name: forest-ambience
display_name: Mystical Forest
type: ambience
description: Ambient forest sounds for exploration
terrain_tags:
  - Forest
  - Jungle
weather_tags:
  - Clear
  - Cloudy
situation_tags:
  - Exploration
  - Rest
shuffle: false
loop: true
crossfade_duration: 3
default_volume: 0.6
tracks:
  - name: Birds Chirping
    source: audio/forest/birds.mp3
    duration: 180
    volume: 0.8
  - name: Wind Through Trees
    source: audio/forest/wind.mp3
    duration: 240
    volume: 0.5
smType: playlist
---

# Mystical Forest

Ambient forest sounds for calm exploration.
```

## Tag Vocabularies

### Terrain Tags (16 options)
- Forest, Mountain, Desert, Swamp, Coastal, Ocean, Arctic, Cave
- Underground, Urban, Ruins, Plains, Hills, Jungle, Volcanic

### Weather Tags (9 options)
- Clear, Cloudy, Rain, Storm, Snow, Fog, Wind, Hot, Cold

### Time of Day Tags (8 options)
- Dawn, Morning, Noon, Afternoon, Dusk, Evening, Night, Midnight

### Faction Tags (12 options)
- Friendly, Neutral, Hostile, Undead, Fey, Fiend, Celestial
- Elemental, Dragon, Giant, Humanoid, Beast

### Situation Tags (15 options)
- Exploration, Combat, Social, Stealth, Chase, Rest, Tension
- Mystery, Horror, Celebration, Travel, Dungeon, Boss, Victory, Defeat

## Auto-Selection Logic (Phase 6.4)

The auto-selection system filters playlists based on current session context:

1. **Context Source**: Session Runner tracks current hex (terrain, weather, time, present factions)
2. **Filter Logic**: Match playlists where ALL active context tags are present in playlist tags
3. **Priority**:
   - Exact multi-tag matches (e.g., "Forest + Rain + Combat") score highest
   - Partial matches fallback to broader playlists
   - Default playlists when no tags match
4. **Transitions**: Crossfade to new playlist when context changes (configurable delay)

Example:
```
Context: Forest hex, Rain weather, Combat situation
Matches:
  1. "Forest Combat" playlist (2 tags match)
  2. "Rain Ambience" playlist (1 tag match)
  3. "General Combat" playlist (1 tag match)
Selected: "Forest Combat" (highest score)
```

## CreateSpec Integration

Playlists use the standard CreateSpec pattern for declarative field definitions:

**Location**: `src/workmodes/library/playlists/create-spec.ts`

**Auto-generated features**:
- Library browse view with filter/sort
- Modal editor with validation
- CRUD operations (create/read/update/delete)
- Frontmatter serialization

**Field Types Used**:
- `text` - Name, display name, description
- `select` - Playlist type (ambience/music)
- `multiselect` - All 5 tag types (terrain/weather/time/faction/situation)
- `number` - Crossfade duration, default volume
- `checkbox` - Shuffle, loop
- `repeating` - Track list (name, source, duration, volume)

See [storage-formats.md](./storage-formats.md) for CreateSpec pattern details.

## Usage Workflows

### Creating a Playlist (Phase 6.2)

1. Open Library → Playlists tab
2. Click "Create Playlist"
3. Fill in basic info (name, type, description)
4. Add tags for auto-selection (multi-select)
5. Configure playback (shuffle, loop, crossfade, volume)
6. Add tracks (name, source path, optional duration/volume)
7. Save → Creates `Playlists/{name}.md`

### Manual Playback (Phase 6.3)

1. Session Runner → Audio panel
2. Click playlist from filtered list
3. Player shows current track, progress, controls
4. Play/Pause/Skip/Stop buttons
5. Volume slider (per-track and global)
6. Shuffle/Loop toggles

### Automatic Switching (Phase 6.4)

1. Session Runner loads current hex context
2. Auto-selection filters matching playlists
3. Crossfades to new playlist on context change
4. Quick-switch dropdown for manual override
5. Status indicator shows current playlist + context

## Testing

**Test Suite**: `devkit/testing/unit/library/playlists/playlist-serializer.test.ts`

**Coverage** (17 tests):
- Minimal playlists (name, type, tracks only)
- Display names and descriptions
- All 5 tag types (terrain, weather, time, faction, situation)
- Playback settings (shuffle, loop, crossfade, volume)
- Track serialization (name, source, duration, volume)
- Duration formatting (seconds → MM:SS)
- Volume display (0.0-1.0 → percentage)
- Round-trip serialization (data → markdown → data)

**Test Status**: ✅ All 17 tests pass (99.5% overall: 432/434)

Run tests:
```bash
npm test playlists                    # Playlist tests only
npm run test:all                      # All tests
./devkit test watch                   # Auto-run on file changes
```

## File Locations

```
src/workmodes/library/playlists/
├── types.ts                          # Data types
├── constants.ts                      # Tag vocabularies
├── serializer.ts                     # Markdown serialization
├── create-spec.ts                    # CreateSpec definition
└── index.ts                          # Barrel export

devkit/testing/unit/library/playlists/
└── playlist-serializer.test.ts       # 20 serialization tests

Playlists/                            # User playlists (not in repo)
├── {playlist-name}.md                # Individual playlists
└── Library.md                        # Auto-generated index
```

## Integration Points

### Library System
- **Registry**: `src/workmodes/library/registry.ts` → `playlistSpec`
- **Data Source**: `src/workmodes/library/storage/data-sources.ts` → `PlaylistEntryMeta`
- **Browse View**: Auto-generated from CreateSpec
- **Filters**: Type, tags (terrain/weather/time/faction/situation)
- **Sorts**: Name, display name, type

### Session Runner (Phase 6.4)
- **Context Provider**: Current hex terrain, weather, time, present factions, situation
- **Auto-Selection**: Filter playlists by context tags
- **UI Integration**: Audio panel with player controls and playlist list
- **State Management**: Current playlist, track, playback state

### Preset System
- **Sample Playlists**: `Presets/Playlists/` (bundled with plugin)
- **Import**: Auto-import on plugin load (if `Playlists/` folder missing)
- **User Override**: Users can modify/delete imported playlists

## Future Enhancements

### Phase 6.5+ (Potential)
- **Streaming Support**: YouTube, Spotify, external URLs
- **Volume Automation**: Dynamic volume based on situation (combat louder, rest quieter)
- **Fade Curves**: Customizable fade shapes (linear, exponential, S-curve)
- **Track Scheduling**: Time-based track selection (dawn tracks at dawn)
- **Mood Presets**: Quick-switch between pre-configured moods
- **Audio Analysis**: Auto-detect track BPM, energy, mood from file metadata
- **Playlist Chaining**: Sequence multiple playlists (intro → loop → outro)
- **Context Hooks**: Custom logic for playlist selection (e.g., boss music on HP < 50%)

## Known Issues

- Playlist sample file uses old schema format (needs migration to new serializer format)
- No playback engine yet (Phase 6.3)
- No auto-selection logic yet (Phase 6.4)

## Related Documentation

- [storage-formats.md](./storage-formats.md) - CreateSpec pattern, serialization
- [TAGS.md](./TAGS.md) - Tag vocabularies across all entity types
- [TESTING.md](./TESTING.md) - Testing philosophy and tools
- [PRESETS.md](./PRESETS.md) - Preset bundling and import system
