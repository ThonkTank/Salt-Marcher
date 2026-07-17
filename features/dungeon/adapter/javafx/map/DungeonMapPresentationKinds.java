package features.dungeon.adapter.javafx.map;

enum PreparedTargetKind {
    EMPTY, CELL, LABEL, MARKER, GRAPH_NODE, HANDLE, BOUNDARY, VERTEX
}

enum PreparedLabelKind {
    EMPTY, ROOM_LABEL, CLUSTER_LABEL, FEATURE_LABEL
}

enum PreparedElementKind {
    EMPTY, ROOM, CORRIDOR, CORRIDOR_ANCHOR, STAIR, TRANSITION,
    FEATURE_MARKER, FEATURE_OBJECT, FEATURE_ENCOUNTER, FEATURE_POI,
    WALL, DOOR, WALL_VERTEX
}

enum PreparedTopologyKind {
    EMPTY, ROOM, CORRIDOR, CORRIDOR_ANCHOR, DOOR, WALL, STAIR,
    TRANSITION, FEATURE_MARKER
}

enum PreparedSyntheticHoverKind {
    NONE, CELL, BOUNDARY, VERTEX
}

enum PreparedBoundaryKind {
    WALL, DOOR
}
