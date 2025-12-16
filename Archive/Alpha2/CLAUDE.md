# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salt Marcher is an **Obsidian plugin** for D&D campaign world simulation with hex map editing and encounter generation. Built with TypeScript targeting ES2022.

## Build & Development Commands

```bash
npm run dev            # Development build (runs presets generation first)
npm run build          # Production build (runs presets generation first)
npm run typecheck      # Type check (tsc --noEmit)
npm test               # Run tests in watch mode (vitest)
npx vitest run path/to/file.test.ts  # Single test file
npm run presets        # Generate creatures.json from References/rulebooks
```

**Note:** Current tests exist only in `Alpha1/` (archived legacy code). New tests should be added to `src/` following vitest conventions.

## Architecture

```
┌─────────────────────────────────────────┐
│           ADAPTERS/                     │  Obsidian Views, Storage, Stores
└─────────────────────────────────────────┘
                    ↕ callbacks + state
┌─────────────────────────────────────────┐
│          ORCHESTRATORS/                 │  Presenters: State + Event Dispatch
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│            SERVICES/                    │  Business Logic (Brush, Camera, Map)
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│             UTILS/                      │  Pure Functions
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       schemas/ + constants/             │  Types & Static Data
└─────────────────────────────────────────┘
```

### Modulare Plugin-Architektur (Monorepo)

Das SaltMarcher-Projekt ist ein **Monorepo** mit modularen Plugins:

```
SaltMarcher/
├── package.json              ← Workspaces: ["shared", "SaltMarcherCore", ...]
├── tsconfig.base.json        ← Gemeinsame TS-Config mit Path Aliases
├── esbuild.base.js           ← Gemeinsame Build-Logik
├── src/                      ← Legacy (Archiv bis Migration abgeschlossen)
├── shared/                   ← Plugin-übergreifender Code
│   ├── package.json          ← name: "@saltmarcher/shared"
│   ├── schemas/              ← Gemeinsame Types
│   ├── constants/            ← Gemeinsame Konstanten
│   ├── utils/                ← Pure Functions
│   └── base/                 ← Base Classes (BasePresenter, BaseService)
├── SaltMarcherCore/          ← Kern-Plugin (standalone)
│   ├── package.json          ← dependencies: "@saltmarcher/shared"
│   ├── tsconfig.json         ← extends: "../tsconfig.base.json"
│   ├── esbuild.config.js     ← Plugin-spezifischer Entry Point
│   ├── manifest.json         ← Obsidian Plugin Manifest
│   └── src/                  ← Plugin-Code (5-Layer-Architektur)
└── PluginB/                  ← Erweiterungs-Plugins...
```

**Abhängigkeits-Hierarchie:**
```
┌─────────────────────────────────────────┐
│           SaltMarcherCore               │  Standalone, exponiert Public API
│    (SessionRunner, Extension Points)    │
└─────────────────────────────────────────┘
          ↑              ↑              ↑
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ PluginB  │   │ PluginC  │   │ PluginD  │  Erweitern SMCore via API
   └──────────┘   └──────────┘   └──────────┘
          ↑              ↑              ↑
┌─────────────────────────────────────────┐
│              shared/                    │  Gemeinsame Types & Utils
└─────────────────────────────────────────┘
```

**shared/ Struktur** (vereinfacht, keine 5-Layer):
- **schemas/** - Gemeinsame Types (AxialCoord, TileData, etc.)
- **constants/** - Gemeinsame Konstanten (Terrain, D&D-Regeln)
- **utils/** - Pure Functions (Hex-Math, etc.)
- **base/** - Abstrakte Base Classes (BasePresenter, BaseService)

**Plugin-Kommunikation:**
- SMCore exponiert Public API via Obsidian Plugin System
- Erweiterungs-Plugins registrieren sich bei SMCore: `app.plugins.plugins['salt-marcher-core'].api`
- Plugins kommunizieren **nur** über SMCore, nie direkt miteinander

**Regeln:**
- Jedes Plugin implementiert die 5-Layer-Architektur in `src/`
- Plugins importieren aus `@shared/*` (Path Alias)
- Erweiterungs-Plugins hängen von SMCore ab, SMCore ist standalone
- Unabhängige Versionierung pro Plugin

**Path Aliases** (tsconfig.base.json):
```json
{ "paths": { "@shared/*": ["./shared/*"] } }
```

**Layer Responsibilities:**
- **Adapters** - External interfaces: Obsidian Views (extend `ItemView`), Storage, Stores
- **Orchestrators** - UI logic, state management (called "Presenters" in architecture docs)
- **Services** - Business logic; stateful services extend `BaseService` with subscription pattern
- **Utils** - Pure functions with no side effects
- **schemas/** - TypeScript types by domain; **constants/** - static data

**Dependency Rule:** Dependencies point downward only. Lower layers never import from upper layers.

**DRY Principle:** Always reuse or expand existing services, utilities, or adapters before creating new code.

## Source Structure (`src/`)

| Directory | Purpose |
|-----------|---------|
| `main.ts` | Plugin registration, view registration, commands |
| `schemas/` | TypeScript types (geometry, map, character, combat, encounter, travel, calendar, weather) |
| `constants/` | Static data (terrain types, D&D rules, hex geometry, XP thresholds) |
| `utils/` | Pure functions (hex math, brush geometry, render, encounter, calendar) |
| `orchestrators/` | State management - extend `BasePresenter` |
| `services/` | Business logic - stateful services extend `BaseService` |
| `adapters/` | Obsidian views (extend `ItemView`), stores, shared UI components |
| `generated/` | Auto-generated files from `npm run presets` - **do not edit** |

## Presenter Pattern (Orchestrators)

Unidirectional data flow between View and Presenter:

```
┌─────────────┐    callbacks    ┌──────────────┐
│    View     │ ──────────────▶ │  Presenter   │
│  (Adapter)  │                 │(Orchestrator)│
│             │ ◀────────────── │              │
└─────────────┘   state + hint  └──────────────┘
```

**Base Classes:**
- `BasePresenter<State, Callbacks>` - `setOnRender()`, `updateView()`, `getCallbacks()`, `initialize()`, `destroy()`
- `BaseService<State>` - `subscribe()`, `notify()`, `getState()`

**Connection Flow:**
1. View creates Presenter: `this.presenter = new CartographerPresenter()`
2. View subscribes: `presenter.setOnRender((state) => this.render(state))`
3. View gets callbacks: `this.callbacks = presenter.getCallbacks()`
4. User events → callbacks → Presenter updates state → `updateView(state)` triggers render

**RenderHint System:** Efficient partial updates:
```typescript
type RenderHint =
  | { type: 'full' }                             // Full redraw
  | { type: 'camera' }                           // Pan/zoom only
  | { type: 'tiles'; changedTiles: CoordKey[] }  // Specific tiles
  | { type: 'colors' }                           // Tile colors changed
  | { type: 'brush' }                            // Brush indicator moved
  | { type: 'toolpanel' };                       // Tool panel UI only
```

## Main Views

Three Obsidian views registered in `main.ts`:
- **Cartographer** (`orchestrators/cartographer.ts` ↔ `adapters/cartographer/`) - Hex map editor with brush tools, pan/zoom, undo/redo
- **Library** (`orchestrators/library.ts` ↔ `adapters/library/`) - Creature/entity browser
- **Traveler** (`orchestrators/traveler.ts` ↔ `adapters/traveler/`) - Travel/route planning with tokens

## Hex Coordinate System

Uses **pointy-top** hexagonal grid with axial coordinates (q, r). Key functions in `utils/hex/geometry.ts`:

```typescript
coordToKey({ q: 1, r: -1 })     // "1,-1" - serialize for Map keys
keyToCoord("1,-1")              // { q: 1, r: -1 } - deserialize
axialDistance(a, b)             // Hex distance between two coords
neighbors(coord)                // All 6 adjacent hexes
coordsInRadius(center, r)       // All hexes within radius
axialToPixel(coord, size)       // Convert to pixel position
pixelToAxial(x, y, size)        // Convert pixel to nearest hex
```

**Tile State:** Tiles stored in `Map<CoordKey, TileData>` where `CoordKey` is `"q,r"` string.

## Key Services

Services in `src/services/` organized by domain:

| Service | Location | Purpose |
|---------|----------|---------|
| `CameraService` | `services/camera/` | Pan/zoom state, extends `BaseService` |
| `UndoService` | `services/map/undo-service.ts` | Undo/redo stack with tile snapshots |
| `applyBrush` | `services/map/` | Calculates and applies brush operations |
| `IncrementalRenderer` | `services/map/incremental-renderer.ts` | SVG tile rendering with partial updates |
| `CalendarService` | `services/calendar/` | Date/time management |
| `WeatherService` | `services/weather/` | Weather generation |

## Type System

All types in `schemas/` re-exported via `schemas/index.ts`:
- `AxialCoord`, `CoordKey`, `Point` - Geometry primitives
- `TileData` - Single hex tile state
- `MapData`, `MapMetadata` - Map container
- `TerrainType` - Terrain classification
- `CameraState`, `BrushConfig` - UI state types

## Generated Data

`npm run presets` parses D&D creature markdown from `References/rulebooks/` into `src/generated/creatures.json`. Runs automatically before dev/build.

## TypeScript Configuration

- Target: ES2022, Module: ESNext, Strict mode enabled
- `noEmit: true` - Type checking only (esbuild handles bundling)
- `verbatimModuleSyntax: true` - Explicit `type` imports required

## Key Documentation

| File | Content |
|------|---------|
| `docs/ArchitectureGoals.md` | Complete layer architecture, service definitions |
| `docs/core/eco-math.md` | Food Unit (FU) system for ecosystem simulation |
| `docs/core/weather.md` | Three-layer weather system (static → phenomena → current) |
| `docs/core/climate-math.md` | Climate zone calculation and grouping |
| `docs/services/ecosystem-solver.md` | Ecology equilibrium solver algorithm |

## Repository Notes

- `Alpha1/` - Archived legacy code, stored for reference only
- `References/rulebooks/` - Source markdown for creature data (parsed by `npm run presets`)
