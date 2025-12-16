# Audio Feature

## Purpose

Audio playback and context-aware playlist auto-selection for session ambiance.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

```typescript
// Import from: src/features/audio
import type {
  AudioPlayer,
  PlaylistContext,
  AutoSelectionResult,
} from "src/features/audio";

import {
  createAudioPlayer,
  selectPlaylistForContext,
  extractAudioContext,
} from "src/features/audio";
```

## Dependencies

- **Obsidian API** - `App` for vault access to audio files
- **Services** - Playlist data from Library workmode

## Usage Example

```typescript
import { createAudioPlayer, selectPlaylistForContext } from "src/features/audio";

// Create player instance
const player = createAudioPlayer(app);

// Auto-select playlist based on context
const context = { terrain: "forest", weather: "rain", timeOfDay: "night" };
const playlist = selectPlaylistForContext(context, availablePlaylists);

// Play selected playlist
await player.play(playlist);
```

## Internal Structure

- `audio-player.ts` - Core playback functionality
- `auto-selection.ts` - Context-aware playlist matching
- `auto-selection-types.ts` - Selection algorithm types
- `context-extractor.ts` - Extract context from game state
- `types.ts` - Shared type definitions
