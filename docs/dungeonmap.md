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
- Cluster Label Interactible: A label baring the cluster name. Can be selected to drag the cluster.
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
            Scenario 1: GM clicks two of: Door with one unoccupied side (no interior) / Corridor wall. An new corridor segment is formed between those two places. If one or both points are corridor walls, fixed corridor points are created at that point and the route they are created on is split into two distinct corridor segments. A route is calculated for the new segment (fastest connection, not overlapping any corridor interiors, slight punishment for taking corners) between both points.
            Edgecase: Both points are on different Floors. A stairway is created at some segment of the path. The Stairway ist its own corridor segment, with fixed points at either end of it. If the stairway is moved or the shape edited, both connecting segments are rerouted to meet the new endpoints.
    All in-process edits may be terminated instantly via Esc.
    ctrl-y/ctrl-x allow for undo/redo
    marquee-selection is vertex-based, like wall painting. The smallest paintable area is thus one tile.
    All in-progress editing interactions provide a visible preview of what the state would look like if the edit was concluded at this mouse position.
