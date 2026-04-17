Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: UI composition, interactions, and user-visible states for the
dungeon map feature.

# Dungeon Map UI Model

## Basic Map Surface

### Main Map Canvas

The map canvas is the primary visual surface.

Visible elements:

- grid with orientation-friendly line strengths
- traversable floor tiles
- walls and boundaries
- door markers
- stair markers
- adjacent-floor onion-slice overlays

Core interactions:

- pan via keyboard and drag
- zoom via wheel and keyboard shortcuts
- nudge the active floor
- click selectable objects to inspect them

### Map List

The map list presents map objects in a sorted list.

Core interactions:

- filter by text and object type
- select an object from the list
- synchronize list selection with map focus and inspection state

### Map Management

The map management area controls which map and floor are currently visible.

Core controls:

- map search with suggestions
- load action for a valid selected map
- floor spinner
- onion-slice opacity and range controls

Expected states:

- no map selected
- map selected but not yet loaded
- map loaded
- invalid or empty search state

## Travel Surface

### Travel Canvas

The travel canvas reuses the dungeon render but emphasizes runtime state.

Visible elements:

- party token with facing
- current traversable layout
- active travel focus

Core interactions:

- select or drag the party marker
- move focus to the current or next room

### Room Inspector

The room inspector is the main information surface for travel.

It presents:

- room identity and authored description
- exits and traversability notes
- feature summaries
- jump targets to connected rooms

### Runtime State Panel

The runtime state panel presents immediate travel actions.

Expected contents:

- current room
- available connection actions
- destination-oriented travel controls

## Editor Surface

### Editor Canvas

The editor extends the base map canvas with authored editing affordances.

Expected editor-specific interactions:

- select clusters, rooms, connections, and features
- drag selected affordances where editing is allowed
- preview pending edits directly on the canvas
- commit or cancel the active gesture

### Editor Management

The editor extends map management with authoring operations.

Expected controls:

- create map
- delete loaded map
- choose active editing tool

### Tool Model

The editor supports at least these tool families:

- neutral selection
- area paint
- floor paint
- wall paint
- door placement
- stair placement
- corridor connection

Each tool defines:

- user intent
- input form
- preview behavior
- commit trigger

The tool does not define the domain repair or topology conflict logic.

### Interaction Rules

- only one editing tool is active at a time
- visible preview is shown for in-progress edits
- `Esc` cancels the active edit
- undo and redo replay committed editor history
- selection and focus update inspector content consistently
