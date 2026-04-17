# Dungeon Map Feature
A userfacing deconstruction of the capabilities the dungeon feature must provide-

## Basic Dungeon Map Interface
Shows the map of the dungeon. simple placeholder "no map selected" if none is loaded.
### Map UI Component
5 foot squares are depicted as a grid canvas (unbounded). 
- Grid Element: help orientation, there are 4 variations of line thickness: thickest (4th) for the 0-lines, then the others in five foot increments (so second strength every 5 feet, third every 10 feet).
- Camera tool: Movement via wasd and mouse drag (middle mouse button), scroll via scroll wheel or tabulator (up)/capslock (down)
- Wall Element: A Line on top of the grid lines, rendered in a different colour to signal the presence of a structure.
- Door Selectable: Rendered to visualise a door placement, has a handle-shape to visually differentiate it from the door it sits on and let the user interact with it more easily. Displays door description in the inspector if clicked. Draggable in the editor. (Drag =/= click so drag doesn't trigger the inspector)
- Floor Element: Coloured tiles to visualise traversible floor
- Stair Interactible: Stylised stair graphic used to visualise points at which the party may ascend/descend to other dungeon levels. May be used to drag the stair in editor mode.
- Dungeon Floor Onion Slice Element: Transparent overlays of adjacent floors. Upper floors shift red, lower floors shift blue.
### Map List Component
- Sorted list of all dungeon map objects. May be used to filter and edit clusters, rooms and features.

### Map Management Component
- primary HBox A containing:
    - secondary HBox A:
        - Dungeon Selector Searchbar Interactible: Searchbar (text field with suggestions dropdown) for selecting a map
        - Map Loading Button Interactible: Grayed out untill searchbar contains a real map. Loads selected map. Opens on floor 0.
    - secondary HBox B (May expand into a second row if it can't fit in the same as secondary HBox A):
        - Dungeon Floor Spinner Interactible: Text field with +/- buttons to select what Floor ist currently the main floor.
        - Dungeon Floor Onion Slice Dropdown Interface:
            - Dungeon Floor Onion Slice Opacity Slider Interactible: Lets the user control onion slice opacity.
            - Dungeon Floor Onion Slice Rande Spinner Interactible: Spinner Element to select how many floors above/below the current floor should be rendered.

## Dungeon Map Travel Interface
Runtime Tab.
Lets the User select and open maps to travel. Provides a rendered depiction of the map with a token for the party and (later) monsters to show position.
- Party Interactible: Token element with one pointed side to indicate direction. May be dragged to change party position.

### Room Inspector Interface
Primary information source about rooms. Dynamically generates a room description from topology. Structured as:
```# Room name (room ID)
Description containing sensory information (Room size, shape, light level, sounds smells, physical makeup).
Description of all Exits and Connections to other connected spaces with: Direction (to your left/right/above you/below you etc) and Description (is an old, rusted iron door. It seems heavy.) and ID
Description of room features (Loot, enemies, interactibles etc) with Direction and Description.

#### Connection 1 name (Connection 1 ID)
Optional further detail. Traversibility information (It is locked/blocked/welded shut etc.).
Leads to: Connected Space name (ID) as a hyperlink.
In [] optional GM Information (freeform)
#### Other connections, same shema

#### Feature 1 (ID)
Optional further detail
In [] optional GM Information (freeform)
```
### Dungeonmap Travel Runtime State Tab Interface
- Room Connection Travel button Interactible: For each connectoin from the room description, a button is instantiated, labeled like the connection description. Clicking the Button places the party right at the entrance of the connecte room.

## Dugeonmap Map Editor Interface 
Editor Tab.
Lets the User select and open maps to edit.
Extends the map canvas with the following:
- Cluster Label Interactible: A label baring the cluster name. Can be selected to drag the cluster. Boundary walls of a selected cluster may be moved by dragging it to move it in either wall direction. Walls are moved in straight segments between two corners. Connecting walls expand in a straight line as well to keep the cluster enclosed.
Extends the Map Management Component with the following:
- secondary HBonx A:
    - Map Creation Dropdown Interface:
        - Dungeon Name Textbox Interactible: Contains per default Dungeon Nr.X (X= first free numeral)
        - Dungeon Create Button: Creates and opens a new dungeon with the entered name
    - Map Deletion Dopdown:
        - Warning Text Element: "Are you sure?"
        - Confirmation button Interactible: deletes map.
- secondary HBox C:
    Each Button deselects the previous button.
    - Selection Tool button Selectable: Neutral state without any special behaviour. Allows selection of selectables and dragging of draggables as usual.
    - Area Paint Tool Butto Selectable: enables the area paint mode. Allows marquee selection on the map canvas to create new areas with a left-click drag or delete existing areas with a right click drag
        Scenario 1: The selected area is fully outside of any existing area. A new Cluster is created, the area is filled with floors and the outside boundaries are marked by walls.
        Scenario 2: The celected area overlaps one preexisting cluster on the same floor. The area is filled with floor, the cluster is expanded to cover that area, the preexisting boundary walls within the area are deleted or rerouted to demarcate the new boundary.
        Scenario 3: The Area overlaps two preexisting Clusters. All now connected areas are reassigned to the larger cluster. The area is filled with floor, the cluster is expanded to cover that area, the preexisting boundary walls within the area are deleted or rerouted to demarcate the new boundary.
        Scenario 4: Deleted area partitions a cluster into two disconnected pieces. The larger piece retains the cluster identity, while the smaller gets assigned a new identity. Contained walls/floor are deleted, boundary walls are rerouted to enclose the new separate clusters.
        Edge Case 1: A door used to be on that now deleted boundary wall. The door is replaced at the closest new boundary wall.
        Edge Case 2: The Area overlaps a preexistig corridor. The corridor is rerouted as usual.
        Edge Case 3: The Area overlaps with a fixed corridor node. The node is replayed to the closet tile not occupied by a cluster.
        Edge Case 4: Two clusters are the size so no largest can be determined. Resolve by selecting the one whose midpoint is the furthest in the negative +y/-x (top left).
        Deletion: Straightforward. Just delete all cluster/cluster topology in the area. Close new boundaries with walls as usual. Replace doors as usual.
    - Floor Paint Tool Button Selectable: Marquee Selection to add/remove floors inside a cluster respectively via left/right click.
        Scenario 1: Below the removed floor is nothing. On the Floor below, new walls and floor areas are created to enclose the cluster inside. The Cluster is expanded to fill that area on the new floor.
        Scenario 2: There is already a cluster below the new opening. Merge as usual. Fill remaining Space with floors if there is any, and reroute boundary walls to enclose it.
        Edge Cases: Door displacement or corridor overlap is resolves like in the area paint tool.
    - Wall Paint Tool Button Interactible: 
        - Allows the user to create a new wall between 2-n points. Points are placed via leftclick on/near a vertex (A corner where four tiles meet). The path follows tile edges (where two tiles meet) along the shortest path beteween all points. THe wall is finalised when the last click is a rightclick or lands on a preexisting wall.
        - Delete works via right click betwee strictly two points. The Path only travels along edges which alread bear a wall. Doors are deleted alongside the wall. Boundary walls may not be deleted.
    - Connection Dropdown:
        - Door Placement Tool interactible: Lets the user place a door on any wall. The Door now connects the space on either side if both sides lead to a cluster/corridor interior. Left is placement, right is delete.
        - Stair Placement Tool interactible: Lets the User place or delete stairs via left/right click. Placing a new stair opens the stair editor panel in the state pane.
            Stairs can be either of: Ladder, square, rectangle, circle. This determines the footprint of the stair.
            Further, squares and circles have a radius while rectangles have two side lengths.
            Stairs also have a start and an end floor.
            Stairs also have an incline, meaning how many horizonta tiles they must travel for each vertical step.
            Each stair tiles also must each connect to a traversible tile on both floors they connect which can not have the same X/Y coordinates i.e. be directly on top of one another. The element icon reflects whether the stair tile makes a left turn, right turn or goes straight ahead. 
            Ladders have a special graphic and go down in a straight line.
        - Corridor Connection Tool Interactible: Lets the GM create or expand corridor networks.
            Scenario 1: GM clicks two of: Door with one unoccupied side (no interior) / Corridor wall. An new corridor segment is formed between those two places. If one or both points are corridor walls, fixed corridor endpoints are created there as authored boundary-side placements and the route they are created on is split into two distinct corridor segments. A route is calculated for the new segment (fastest connection, not overlapping any corridor interiors, slight punishment for taking corners) between both points.
            Edgecase: Both points are on different Floors. A stairway is created at some segment of the path. The stairway is its own corridor segment, with fixed endpoints at either end of it. If the stairway is moved or the shape edited, both connecting segments are rerouted to meet the regenerated stair endpoints.
    All in-process edits may be terminated instantly via Esc.
    ctrl-y/ctrl-x allow for undo/redo
    marquee-selection is vertex-based, like wall painting. The smallest paintable area is thus one tile.
    All in-progress editing interactions provide a visible preview of what the state would look like if the edit was concluded at this mouse position.
    
    Corridor canonical truth: Corridors persist as ordinary traversable `SpaceId` interior plus the smallest authored corridor node/segment graph and segment-owned generated topology needed to rebuild routes when endpoints move. Corridor networks are derived connected components of that graph, not their own persisted top-level objects, and corridor walls are not a separate truth layer.
    Stair canonical truth: Stairs persist authored `StairPlacement` parameters plus the stair-owned generated topology they materialise. `StairPlacement` includes explicit horizontal orientation so stair regeneration does not depend on reverse-reading generated topology. Landings are derived wherever stair-owned topology touches traversable non-stair floor.

## Normative Target Architecture
This section is normative for the `dungeon` feature. Implementations must be evaluated against these boundaries and ownership rules, not against convenience in a single use case.

### Feature Boundary
- `dungeon` is one feature slice with one backend boundary: `src/domain/dungeon/dungeonAPI.java`.
- A `DungeonMap` is the canonical aggregate root for exactly one authored dungeon map.
- Editor and travel are separate presentation slices over the same dungeon truth. They must not create competing persisted models of the map.
- `mapcore` remains a transport-neutral snapshot boundary for map rendering contracts. It is not the owner of dungeon business truth.

### Canonical Truth And Derived State
- Only authored truth and stable identities may be persisted.
- Anything that can be deterministically rebuilt from persisted truth must be treated as derived state and must not be persisted as a second source of truth.
- Editor runtime state and travel runtime state must not be stored inside the dungeon aggregate.
- Inspector text, room descriptions, adjacency lists, travel exits, render overlays, and similar read models must be rebuilt from dungeon truth.

### Canonical Aggregate
The persisted core of the feature must be shaped as one aggregate per map:

```text
DungeonMap
- DungeonMapId id
- DungeonMapMetadata metadata
- SpatialTopology topology
- SpaceCatalog spaces
- ConnectionCatalog connections
- FeatureCatalog features
- long revision
```

The aggregate is the transaction boundary for one map. It is not permission to collapse all concerns into one unstructured document. Internal ownership remains split by the domain partitions below.

### Domain Partitions

#### SpatialTopology
Responsibility: canonical spatial truth.

Owns:
- which tiles are interior and traversable
- which explicit internal edges exist
- authored corridor node and segment ownership
- stair-owned and corridor-owned generated topology tagged by owner
- authored spatial anchors for doors, stairs, and corridor routing constraints

May know:
- geometry value objects
- stable identifiers such as `SpaceId` and `ConnectionId` when needed to attach authored topology to domain objects

Must not own:
- room names
- room narrative descriptors
- inspector text
- global adjacency graphs

#### SpaceCatalog
Responsibility: stable space identity and authored space semantics.

Owns:
- which `SpaceId` values exist
- authored metadata for each space
- space kind, label position, and authored descriptors

May know:
- geometry anchors
- references to `SpaceId`

Must not own:
- tile occupancy
- boundary walls
- corridor geometry
- travel state

#### ConnectionCatalog
Responsibility: authored connections between spaces.

Owns:
- which `ConnectionId` values exist
- connection kind, typed placement, connected spaces, traversability state, and authored notes
- authored stair shape, stair dimensions, floor span, and incline

May know:
- `SpaceId`
- geometry anchors

Must not own:
- derived room adjacency graphs
- party position
- render-only connection summaries
- fully resolved projection paths unless they are themselves authored truth

#### FeatureCatalog
Responsibility: authored points of interest and other placed dungeon features.

Owns:
- which `FeatureId` values exist
- feature kind, authored anchor, description, and GM notes
- optional association to a `SpaceId`

Must not own:
- room boundaries
- travel routing logic
- adjacency logic

#### Derived Projection Boundaries
Responsibility: deterministic read models only.

Projection builders may include:
- `TopologyDerivation`
- `InspectorProjectionBuilder`
- `TravelProjectionBuilder`
- `RenderProjectionBuilder`

They may:
- read `SpatialTopology`, `SpaceCatalog`, `ConnectionCatalog`, and `FeatureCatalog`
- build room projections, boundaries, exits, inspector content, and render snapshots

They must not:
- persist data
- call repositories to create second truth
- mutate the aggregate during projection building

### Single Sources Of Truth
- Interior tile occupancy is owned only by `SpatialTopology`.
- Explicit internal wall data and authored corridor/stair boundary-side anchors are owned only by `SpatialTopology`.
- Stable space identity and authored space semantics are owned only by `SpaceCatalog`.
- Door and stair business objects are owned only by `ConnectionCatalog`.
- POIs, interactibles, loot anchors, and GM feature notes are owned only by `FeatureCatalog`.
- Room boundaries, room lists, adjacency, inspector room descriptions, travel options, and render layers are derived only from the authored aggregate.
- Tool selection, preview state, camera state, onion-slice settings, undo/redo state, party marker, facing, and active travel selection belong only to `src/view/.../Model`.

### Geometry And Placement Rules
- Every concrete map coordinate is floor-aware.
- `FloorSpan` expresses vertical reach only. It never replaces a concrete floor-aware coordinate.
- Boundary walls are derived from neighboring tile context only.
- A boundary exists when the two tile contexts on an edge differ: interior vs non-interior or `SpaceId A` vs `SpaceId B`.
- Explicit wall truth exists only for authored internal walls inside already-traversable interior.
- Corridors and rooms are both normal `SpaceId` interiors. They do not own separate wall vocabularies.
- Landings are always derived and are never persisted.
- Corridor networks are derived from authored corridor nodes and segments. They do not own a separate identity layer.
- `MapPlacement` is the shared typed placement language for authored placements across connections, features, and any future label override.
- If two authored things use the same carrier geometry, they must reuse the same `MapPlacement` carrier instead of introducing a second anchor type.
- The allowed `MapPlacement` carriers are `TileAnchor`, `EdgeAnchor`, `VertexAnchor`, `TileFootprint`, `DoorSidePlacement`, `BoundarySidePlacement`, and `StairPlacement`.
- `StairPlacement` includes explicit horizontal heading/orientation so stair regeneration does not depend on reverse-reading generated topology.

### Domain Objects
The feature must keep its shared geometry and identity vocabulary inside `src/domain/dungeon/valueobject`.

Expected value objects include:
Identity:
- `DungeonMapId`
- `SpaceId`
- `ConnectionId`
- `FeatureId`
- `CorridorNodeId`
- `CorridorSegmentId`
Semantics:
- `SpaceKind`
- `ConnectionKind`
- `TraversabilityState`
- `StairShape`
- `StairDimensions`
- `StairIncline`
Geometry kernel:
- `FloorIndex`
- `TileCoord`
- `EdgeCoord`
- `VertexCoord`
- `EdgeSide`
- `CardinalHeading`
- `FloorSpan`
Shared placements:
- `MapPlacement`
- `TileAnchor`
- `EdgeAnchor`
- `VertexAnchor`
- `TileFootprint`
- `DoorSidePlacement`
- `BoundarySidePlacement`
- `StairPlacement`
Ownership and regeneration:
- `TopologyOwnerRef`

Placement role notes:
- `DoorSidePlacement`: stable corridor endpoint on one side of a door connection
- `BoundarySidePlacement`: stable fixed endpoint on one side of a boundary edge
- `StairPlacement`: authored stair parameters used to regenerate stair-owned topology
- `TopologyOwnerRef`: owner reference used to mark generated topology eligible for selective rebuild
- `CardinalHeading`: authored stair orientation on the horizontal plane

Command-only geometry value objects include:
- `VertexRect`
- `VertexPolyline`

Expected entities include:
- `DungeonMap`
- `SpatialTopology`
- `SpaceCatalog`
- `ConnectionCatalog`
- `FeatureCatalog`
- `Space`
- `Connection`
- `DungeonFeature`

No separate top-level `geometry` or `geometrykernel` feature root may be introduced for this shared vocabulary.

### Invariants And Policies
Hard invariants must be enforced inside the aggregate and its owned objects.

Hard invariants include:
- Every traversable interior tile belongs to exactly one `SpaceId`.
- A `SpaceId` without any occupied interior tiles is invalid.
- A door connection must sit on a valid derived boundary.
- A door connection must connect exactly two different spaces.
- A stair connection must attach to valid traversable tiles on every connected floor.
- Explicit internal walls are valid only inside interior context.
- Corridor routes may not cut through foreign space interiors.
- Corridor reroute and stair rebuild may only replace topology owned by their matching `TopologyOwnerRef`.

Policies are allowed where deterministic conflict resolution is required, but they must be modeled as policies rather than hidden second truth.

Policy examples include:
- space identity retention during split and merge
- deterministic tie-breaking for equal-size components
- re-anchoring doors after topology changes
- formatting derived inspector narration

Policies must choose outcomes from authored truth. They must not create parallel persisted truth.

### Public API And Use Case Boundary
- `src/domain/dungeon/dungeonAPI.java` remains the only public backend boundary below the view layer.
- Commands may mutate only canonical dungeon truth.
- Queries may read only and must return projections or snapshots.
- View and controller code must never call domain internals directly.
- Editor and travel interactors must reach the backend only through `dungeonAPI`.

Expected command categories include:
- map creation
- area paint and erase
- floor opening paint and erase
- internal wall draw and erase
- door place, update, and remove
- stair place, update, and remove
- corridor extension and reroute
- space metadata updates
- connection metadata updates
- feature add, update, and remove

Command shapes must follow these geometry rules:
- area and floor paint use `VertexRect`
- wall draw and erase use `VertexPolyline`
- door place uses `EdgeAnchor`
- stair place and update use `StairPlacement`
- corridor extension uses `DoorSidePlacement` or `BoundarySidePlacement` endpoints
- feature add and update use `MapPlacement`
- no command may introduce a second placement vocabulary parallel to `MapPlacement`

Expected query categories include:
- editor snapshot loading
- travel snapshot loading
- describing a space, connection, or feature
- resolving travel options
- building render projections

### Dependency Direction
Allowed architectural direction:
- `src/view/dungeoneditor/interactor -> src/domain/dungeon/dungeonAPI`
- `src/view/dungeontravel/interactor -> src/domain/dungeon/dungeonAPI`
- `src/domain/dungeon/dungeonAPI -> usecase`
- `usecase -> entity/valueobject/repository`
- `src/data/dungeon -> src/domain/dungeon`
- projection builders read aggregate state without persisting it

Forbidden architectural direction:
- `view/* -> domain internals`
- `view/* -> data/*`
- `shell -> dungeon internals`
- `domain -> JavaFX`
- `SpaceCatalog -> SpatialTopology` as a write dependency
- `ConnectionCatalog -> FeatureCatalog`
- projection builders writing to persistence

All dependencies must remain one-way and inward-pointing. Cross-catalog coordination must happen through aggregate-owned operations and use cases, not through peer mutation.

### Repository Mapping
This target architecture must stay within the repository layout defined for active code:
- `src/domain/dungeon/entity`
- `src/domain/dungeon/valueobject`
- `src/domain/dungeon/usecase`
- `src/domain/dungeon/repository`
- `src/data/dungeon/model`
- `src/data/dungeon/mapper`
- `src/data/dungeon/repository`
- `src/data/dungeon/datasource/local`
- `src/data/dungeon/datasource/remote`

No alternate top-level architecture root may be introduced for the feature.

### VO-Ansätze nach fachlichen Bereichen

Ich werte hier **nur die 2D-koordinatenabhängigen VOs** aus. Die Datei verlangt floor-aware concrete coordinates, nennt die relevanten Geometrie-/Placement-VOs explizit und reserviert zusätzlich `VertexRect` und `VertexPolyline` als command-only Geometrie-VOs. Reine IDs, Enums und vertikale Hilfs-VOs wie `DungeonMapId`, `SpaceId`, `ConnectionKind`, `FloorSpan`, `CardinalHeading`, `EdgeSide`, `TopologyOwnerRef` sind zwar Teil der Konzeption, aber **keine eigenen Tile/Edge/Corner-Träger** und deshalb nicht sinnvoll als Zeilen dieser Matrix.   

**Annahmen für die Matrix**

* Annahme: quadratisches Raster, `y+` nach unten.
* Annahme: `EdgeCoord_E(f,x,y,H)` = horizontale Kante von Vertex `(x,y)` nach `(x+1,y)`.
* Annahme: `EdgeCoord_E(f,x,y,V)` = vertikale Kante von Vertex `(x,y)` nach `(x,y+1)`.
* Annahme: `EdgeSide.NEGATIVE/POSITIVE` meint die beiden Halbseiten einer orientierten Kante: bei `H` = oben/unten, bei `V` = links/rechts.
* Jede konkrete Definition ist **floor-aware** und trägt daher `FloorIndex` mit. Das ist nicht optional. 

#### 1. Atomare Geometrieelemente bzw. grundlegende Koordinatentypen

- `TileCoord`
  - `Tile-System`: `record TileCoord_T(FloorIndex f, int x, int y)`  
    `// genau eine Tile-Innenfläche`  
    `Bsp: (2,10,7)`
  - `Edge-System`: `record TileCoord_E(FloorIndex f, EdgeCoord_E north, EdgeCoord_E west)`  
    `// Tile wird durch ihre NW-Kanten identifiziert`  
    `Inv: north=H(x,y), west=V(x,y), beide teilen NW-Vertex`  
    `Bsp: north=H(10,7), west=V(10,7)`
  - `Corner-System`: `record TileCoord_V(FloorIndex f, VertexCoord_V nw)`  
    `// Tile = Zelle zwischen nw und nw+(1,1)`  
    `Bsp: nw=(10,7)`
- `EdgeCoord`
  - `Tile-System`: `record EdgeCoord_T(FloorIndex f, int x, int y, CardinalHeading side)`  
    `Inv: canonical only {N,W}`  
    `// Kante als Seite einer Tile`  
    `Bsp: (2,10,7,W)`
  - `Edge-System`: `record EdgeCoord_E(FloorIndex f, int x, int y, EdgeAxis axis)`  
    `// axis ∈ {H,V}`  
    `Bsp: V(10,7)`
  - `Corner-System`: `record EdgeCoord_V(FloorIndex f, VertexCoord_V a, VertexCoord_V b)`  
    `Inv: manhattan(a,b)==1, canonical order a<=b`  
    `Bsp: (10,7)->(10,8)`
- `VertexCoord`
  - `Tile-System`: `record VertexCoord_T(FloorIndex f, int x, int y)`  
    `// canonical: NW-Corner von Tile(x,y)`  
    `Bsp: (2,10,7)`
  - `Edge-System`: `record VertexCoord_E(FloorIndex f, EdgeCoord_E north, EdgeCoord_E west)`  
    `Inv: north=H(x,y), west=V(x,y), gleicher Ursprung`  
    `Bsp: north=H(10,7), west=V(10,7)`
  - `Corner-System`: `record VertexCoord_V(FloorIndex f, int x, int y)`  
    `// genau ein Gittervertex`  
    `Bsp: (2,10,7)`
- `MapPlacement`
  - `Tile-System`: `sealed interface MapPlacement_T permits TileAnchor_T, EdgeAnchor_T, VertexAnchor_T, TileFootprint_T, DoorSidePlacement_T, BoundarySidePlacement_T, StairPlacement_T`  
    `Bsp: new EdgeAnchor_T(2,10,7,W)`
  - `Edge-System`: `sealed interface MapPlacement_E permits TileAnchor_E, EdgeAnchor_E, VertexAnchor_E, TileFootprint_E, DoorSidePlacement_E, BoundarySidePlacement_E, StairPlacement_E`  
    `Bsp: new BoundarySidePlacement_E(2,V(11,7),NEGATIVE)`
  - `Corner-System`: `sealed interface MapPlacement_V permits TileAnchor_V, EdgeAnchor_V, VertexAnchor_V, TileFootprint_V, DoorSidePlacement_V, BoundarySidePlacement_V, StairPlacement_V`  
    `Bsp: new VertexAnchor_V(2,10,7)`
- `TileAnchor`
  - `Tile-System`: `record TileAnchor_T(FloorIndex f, int x, int y)`  
    `// authored placement auf Tile-Innenfläche`  
    `Bsp: (2,10,7)`
  - `Edge-System`: `record TileAnchor_E(FloorIndex f, EdgeCoord_E north, EdgeCoord_E west)`  
    `Inv wie TileCoord_E`  
    `Bsp: north=H(10,7), west=V(10,7)`
  - `Corner-System`: `record TileAnchor_V(FloorIndex f, VertexCoord_V nw)`  
    `// authored placement auf Zelle ab nw`  
    `Bsp: nw=(10,7)`
- `EdgeAnchor`
  - `Tile-System`: `record EdgeAnchor_T(FloorIndex f, int x, int y, CardinalHeading side)`  
    `Inv: canonical only {N,W}`  
    `Bsp: (2,10,7,W)`
  - `Edge-System`: `record EdgeAnchor_E(FloorIndex f, int x, int y, EdgeAxis axis)`  
    `Bsp: H(10,7)`
  - `Corner-System`: `record EdgeAnchor_V(FloorIndex f, VertexCoord_V a, VertexCoord_V b)`  
    `Inv: orthogonal adjacent`  
    `Bsp: (10,7)->(11,7)`
- `VertexAnchor`
  - `Tile-System`: `record VertexAnchor_T(FloorIndex f, int x, int y)`  
    `// canonical NW-Corner von Tile(x,y)`  
    `Bsp: (2,10,7)`
  - `Edge-System`: `record VertexAnchor_E(FloorIndex f, EdgeCoord_E north, EdgeCoord_E west)`  
    `Inv wie VertexCoord_E`  
    `Bsp: north=H(10,7), west=V(10,7)`
  - `Corner-System`: `record VertexAnchor_V(FloorIndex f, int x, int y)`  
    `Bsp: (2,10,7)`

#### 2. Geometrische Grid-Formen

- `TileFootprint`
  - `Tile-System`: `record TileFootprint_T(FloorIndex f, TileAnchor_T anchor, Set<Int2> offsets)`  
    `// offsets relativ zur Anchor-Tile`  
    `Bsp: anchor=(2,10,7), offsets={(0,0),(1,0),(0,1),(1,1)}`
  - `Edge-System`: `record TileFootprint_E(FloorIndex f, TileAnchor_E anchor, Set<Int2> offsets)`  
    `// gleiche Semantik, aber Anchor edge-nativ`  
    `Bsp: anchor=[H(10,7),V(10,7)], offsets={(0,0),(1,0)}`
  - `Corner-System`: `record TileFootprint_V(FloorIndex f, VertexAnchor_V nw, Set<Int2> offsets)`  
    `// offsets sind Zellen relativ zu nw`  
    `Bsp: nw=(10,7), offsets={(0,0),(1,0),(0,1),(1,1)}`
- `StairPlacement`
  - `Tile-System`: `record StairPlacement_T(TileAnchor_T entry, CardinalHeading heading, StairShape shape, StairDimensions dims, FloorSpan span, StairIncline incline)`  
    `// entry bestimmt konkreten Startfloor; span nur vertikale Reichweite`  
    `Bsp: entry=(0,10,7), heading=E, shape=RECT(2,4), span=+1, incline=2`
  - `Edge-System`: `record StairPlacement_E(EdgeAnchor_E entryEdge, EdgeSide entrySide, CardinalHeading heading, StairShape shape, StairDimensions dims, FloorSpan span, StairIncline incline)`  
    `// stair beginnt an Kante und materialisiert von dort Tiles`  
    `Bsp: entryEdge=H(10,7), entrySide=POSITIVE, heading=E, shape=RECT(2,4), span=+1, incline=2`
  - `Corner-System`: `record StairPlacement_V(VertexAnchor_V origin, CardinalHeading heading, StairShape shape, StairDimensions dims, FloorSpan span, StairIncline incline)`  
    `// origin = canonical outer origin vertex des ersten Stair-Footprints`  
    `Bsp: origin=(10,7), heading=E, shape=CIRCLE(r=2), span=+1, incline=2`
- `VertexRect`
  - `Tile-System`: `record VertexRect_T(FloorIndex f, TileCoord_T nwTile, int widthTiles, int heightTiles)`  
    `// Rechteckgrenzen liegen auf den Vertices um dieses Tile-Rechteck`  
    `Bsp: nwTile=(2,10,7), widthTiles=3, heightTiles=2`
  - `Edge-System`: `record VertexRect_E(FloorIndex f, EdgeCoord_E north, EdgeCoord_E west, int widthTiles, int heightTiles)`  
    `Inv: north=H(x,y), west=V(x,y), teilen NW-Vertex`  
    `Bsp: north=H(10,7), west=V(10,7), w=3, h=2`
  - `Corner-System`: `record VertexRect_V(FloorIndex f, VertexCoord_V nw, VertexCoord_V se)`  
    `Inv: nw.x<se.x && nw.y<se.y`  
    `Bsp: nw=(10,7), se=(13,9)`
- `VertexPolyline`
  - `Tile-System`: `record VertexPolyline_T(FloorIndex f, List<VertexCoord_T> controlPoints)`  
    `// authored Klickpunkte; Expansion läuft entlang Tile-Edges`  
    `Bsp: [(10,7),(14,7),(14,9)]`
  - `Edge-System`: `record VertexPolyline_E(FloorIndex f, List<EdgeCoord_E> contiguousEdges)`  
    `// polyline direkt als zusammenhängende Kantenkette`  
    `Bsp: [H(10,7),H(11,7),H(12,7),H(13,7),V(14,7),V(14,8)]`
  - `Corner-System`: `record VertexPolyline_V(FloorIndex f, List<VertexCoord_V> controlPoints)`  
    `Inv: size>=2, Segmente orthogonal`  
    `Bsp: [(10,7),(14,7),(14,9)]`

Ich werte im Folgenden **mögliche geometrische Definitions-Sets für instanziierte Endgeometrie** aus. Es geht ausdrücklich **nicht** um Authoring-, Routing- oder Regenerations-VOs, sondern nur um die Frage, mit welchen geometrischen VOs sich die auf der Map materialisierte Form definieren lässt. Alle Sets sind als alternative Beschreibungsformen derselben Endgeometrie zu verstehen.

**Annahmen für die Definitions-Sets**

* Annahme: quadratisches Raster, `y+` nach unten.
* Annahme: jede konkrete geometrische Instanz ist **floor-aware** und trägt daher `FloorIndex f`.
* Annahme: Wände und andere lineare Strukturen verlaufen orthogonal entlang des Rasters.
* Annahme: Flächen dürfen Löcher haben.
* Annahme: zusammengesetzte Formen dürfen aus mehreren disjunkten Teilen bestehen; ein solches Multipart-Objekt ist bei Bedarf ein Wrapper über mehrere Instanzen desselben primitiven Geometrietyps.

##### Set A: Vollständige Komponentenliste
Kernidee: Eine Form wird über die vollständige Menge ihrer atomaren Rasterkomponenten beschrieben.

- `TileSetGeometry`
  - `record TileSetGeometry(FloorIndex f, Set<TileCoord> tiles)`  
    `record TileCoord(int x, int y)`  
    `// Tile (x,y) bezeichnet genau die Zelle [x,x+1) × [y,y+1)`  
    `Inv: tiles != empty`  
    `Bsp: tiles={(10,7),(11,7),(10,8),(11,8)}`
- `EdgeSetGeometry`
  - `record EdgeSetGeometry(FloorIndex f, Set<EdgeCoord> edges)`  
    `record EdgeCoord(int x, int y, EdgeAxis axis)`  
    `enum EdgeAxis { H, V }`  
    `// H(x,y) = Kante von Vertex (x,y) nach (x+1,y)`  
    `// V(x,y) = Kante von Vertex (x,y) nach (x,y+1)`  
    `Inv: edges != empty`  
    `Bsp: edges={H(10,7),H(11,7),V(10,7)}`

Abbildung:
* Wand = `EdgeSetGeometry`
* Boden / Raum / Korridor / Stair-Footprint = `TileSetGeometry`

##### Set B: Boundary-Komponentenliste
Kernidee: Eine Form wird über ihre Randkanten beschrieben. Flächeninneres ergibt sich aus den geschlossenen Randkanten.

- `EdgeBoundaryGeometry`
  - `record EdgeBoundaryGeometry(FloorIndex f, Set<EdgeCoord> boundaryEdges)`  
    `record EdgeCoord(int x, int y, EdgeAxis axis)`  
    `enum EdgeAxis { H, V }`  
    `// H(x,y) = Kante von Vertex (x,y) nach (x+1,y)`  
    `// V(x,y) = Kante von Vertex (x,y) nach (x,y+1)`  
    `Inv: boundaryEdges != empty`  
    `Inv: für Flächen bildet boundaryEdges eine oder mehrere geschlossene orthogonale Ringe`  
    `Inv: verschiedene Ringe schneiden sich nicht`  
    `Bsp: boundaryEdges={H(10,7),H(11,7),H(10,9),H(11,9),V(10,7),V(10,8),V(12,7),V(12,8)}`

Abbildung:
* Wand = offene oder geschlossene `EdgeBoundaryGeometry`
* Boden / Raum / Korridor / Stair-Footprint = geschlossene `EdgeBoundaryGeometry`, Inneres daraus abgeleitet

##### Set C: Polygon + Polyline
Kernidee: Linien und Flächen werden als geordnete Vertex-Züge beschrieben.

- `VertexCoord`
  - `record VertexCoord(int x, int y)`  
    `// genau ein Rastervertex`  
    `Bsp: (10,7)`
- `VertexPolylineGeometry`
  - `record VertexPolylineGeometry(FloorIndex f, List<VertexCoord> vertices)`  
    `Inv: vertices.size() >= 2`  
    `Inv: jedes Segment zwischen aufeinanderfolgenden Vertexen ist orthogonal`  
    `Inv: jedes Segment hat Manhattan-Länge >= 1`  
    `Inv: keine Nullsegmente`  
    `// Geometrie besteht aus allen Segmenten zwischen vertices[i] und vertices[i+1]`  
    `Bsp: vertices=[(10,7),(14,7),(14,9)]`
- `VertexPolygonGeometry`
  - `record VertexPolygonGeometry(FloorIndex f, VertexRing outerRing, List<VertexRing> holes)`  
    `record VertexRing(List<VertexCoord> vertices)`  
    `Inv: outerRing.vertices.size() >= 4`  
    `Inv: jedes Ring-Segment ist orthogonal`  
    `Inv: erster und letzter Vertex sind implizit verbunden`  
    `Inv: jeder Ring ist einfach, also ohne Selbstschnitt`  
    `Inv: holes liegen vollständig innerhalb des outerRing und schneiden weder einander noch den outerRing`  
    `Bsp: outerRing=[(10,7),(13,7),(13,9),(10,9)], holes=[]`

Abbildung:
* Wand = `VertexPolylineGeometry`
* Boden / Raum / Korridor / Stair-Footprint = `VertexPolygonGeometry`

##### Set D: Minimale Eckpunktliste
Kernidee: Gespeichert werden nur Eck- und Biegepunkte; gerade Zwischenstücke sind implizit.

- `VertexCoord`
  - `record VertexCoord(int x, int y)`  
    `// genau ein Rastervertex`  
    `Bsp: (10,7)`
- `OrthogonalControlPolyline`
  - `record OrthogonalControlPolyline(FloorIndex f, List<VertexCoord> controlPoints)`  
    `Inv: controlPoints.size() >= 2`  
    `Inv: benachbarte Punkte unterscheiden sich in genau einer Achse`  
    `Inv: keine drei aufeinanderfolgenden Punkte sind kollinear`  
    `// zwischen zwei benachbarten controlPoints verläuft implizit genau ein gerades orthogonales Segment`  
    `Bsp: controlPoints=[(10,7),(14,7),(14,9)]`
- `OrthogonalControlPolygon`
  - `record OrthogonalControlPolygon(FloorIndex f, ControlRing outerRing, List<ControlRing> holes)`  
    `record ControlRing(List<VertexCoord> corners)`  
    `Inv: outerRing.corners.size() >= 4`  
    `Inv: benachbarte corners unterscheiden sich in genau einer Achse`  
    `Inv: keine drei aufeinanderfolgenden corners sind kollinear`  
    `Inv: erster und letzter corner sind implizit verbunden`  
    `Inv: resultierender Ring ist einfach und orthogonal`  
    `Inv: holes liegen vollständig innerhalb des outerRing und schneiden weder einander noch den outerRing`  
    `Bsp: outerRing=[(10,7),(13,7),(13,9),(10,9)], holes=[]`

Abbildung:
* Wand = `OrthogonalControlPolyline`
* Boden / Raum / Korridor / Stair-Footprint = `OrthogonalControlPolygon`

##### Set E: Rechteckzerlegung
Kernidee: Flächen werden als Vereinigung orthogonaler Rechtecke beschrieben; lineare Strukturen als Linienzug.

- `VertexCoord`
  - `record VertexCoord(int x, int y)`  
    `// genau ein Rastervertex`  
    `Bsp: (10,7)`
- `AxisAlignedRect`
  - `record AxisAlignedRect(VertexCoord nw, VertexCoord se)`  
    `Inv: nw.x < se.x && nw.y < se.y`  
    `// Rechteck umfasst alle Tiles mit x in [nw.x, se.x) und y in [nw.y, se.y)`  
    `Bsp: nw=(10,7), se=(13,9)`
- `RectSetGeometry`
  - `record RectSetGeometry(FloorIndex f, Set<AxisAlignedRect> rects)`  
    `Inv: rects != empty`  
    `// Geometrie ist die Vereinigungsfläche aller rects`  
    `Bsp: rects={Rect((10,7),(13,8)), Rect((10,8),(12,9))}`
- `VertexPolylineGeometry`
  - `record VertexPolylineGeometry(FloorIndex f, List<VertexCoord> vertices)`  
    `Inv: vertices.size() >= 2`  
    `Inv: jedes Segment zwischen aufeinanderfolgenden Vertexen ist orthogonal`  
    `Inv: jedes Segment hat Manhattan-Länge >= 1`  
    `Inv: keine Nullsegmente`  
    `Bsp: vertices=[(10,7),(14,7),(14,9)]`

Abbildung:
* Wand = `VertexPolylineGeometry`
* Boden / Raum / Korridor / Stair-Footprint = `RectSetGeometry`

#### 3. Verhaltenszentrierte VOs

- `DoorSidePlacement`
  - `Tile-System`: `record DoorSidePlacement_T(FloorIndex f, TileCoord_T sideTile, CardinalHeading doorEdgeOnTile)`  
    `// genau die Tile auf der gewählten Türseite`  
    `Inv: angegebene Tile-Seite trägt die Tür`  
    `Bsp: sideTile=(2,10,7), doorEdgeOnTile=E`
  - `Edge-System`: `record DoorSidePlacement_E(FloorIndex f, EdgeAnchor_E door, EdgeSide side)`  
    `// Türkante + gewählte Halbseite`  
    `Bsp: door=V(11,7), side=NEGATIVE`
  - `Corner-System`: `record DoorSidePlacement_V(FloorIndex f, EdgeAnchor_V door, EdgeSide side)`  
    `// Türkante als Vertexpaar + gewählte Halbseite`  
    `Bsp: door=(11,7)->(11,8), side=POSITIVE`
- `BoundarySidePlacement`
  - `Tile-System`: `record BoundarySidePlacement_T(FloorIndex f, TileCoord_T interiorTile, CardinalHeading boundaryOnTile)`  
    `// fixe Endpoint-Platzierung auf einer Boundary-Seite`  
    `Bsp: interiorTile=(2,10,7), boundaryOnTile=N`
  - `Edge-System`: `record BoundarySidePlacement_E(FloorIndex f, EdgeAnchor_E boundary, EdgeSide side)`  
    `// Boundary-Kante + Halbseite`  
    `Bsp: boundary=H(10,7), side=POSITIVE`
  - `Corner-System`: `record BoundarySidePlacement_V(FloorIndex f, EdgeAnchor_V boundary, EdgeSide side)`  
    `Bsp: boundary=(10,7)->(11,7), side=NEGATIVE`
