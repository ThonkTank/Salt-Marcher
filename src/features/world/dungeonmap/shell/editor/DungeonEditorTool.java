package features.world.dungeonmap.shell.editor;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM_PAINT("Raum malen"),
    ROOM_DELETE("Raum löschen"),
    CLUSTER_WALL("Wand setzen"),
    CLUSTER_WALL_DELETE("Wand löschen"),
    CLUSTER_DOOR("Tür setzen"),
    CLUSTER_DOOR_DELETE("Tür löschen"),
    CORRIDOR_CREATE("Korridor erstellen"),
    CORRIDOR_DELETE("Korridor löschen"),
    STAIR_CREATE("Treppe erstellen"),
    STAIR_DELETE("Treppe löschen"),
    TRANSITION_CREATE("Übergang erstellen"),
    TRANSITION_DELETE("Übergang löschen");

    private final String label;

    DungeonEditorTool(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean isRoomTool() {
        return this == ROOM_PAINT || this == ROOM_DELETE;
    }

    public boolean isCorridorTool() {
        return this == CORRIDOR_CREATE || this == CORRIDOR_DELETE;
    }

    public boolean isStairTool() {
        return this == STAIR_CREATE || this == STAIR_DELETE;
    }

    public boolean isTransitionTool() {
        return this == TRANSITION_CREATE || this == TRANSITION_DELETE;
    }

    public boolean isWallTool() {
        return this == CLUSTER_WALL || this == CLUSTER_WALL_DELETE;
    }

    public boolean isDoorTool() {
        return this == CLUSTER_DOOR || this == CLUSTER_DOOR_DELETE;
    }

    public DungeonEditorTool editVariant() {
        return switch (this) {
            case ROOM_PAINT, ROOM_DELETE -> ROOM_PAINT;
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> CLUSTER_WALL;
            case CLUSTER_DOOR, CLUSTER_DOOR_DELETE -> CLUSTER_DOOR;
            case CORRIDOR_CREATE, CORRIDOR_DELETE -> CORRIDOR_CREATE;
            case STAIR_CREATE, STAIR_DELETE -> STAIR_CREATE;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION_CREATE;
            case SELECT -> this;
        };
    }

    public DungeonEditorTool deleteVariant() {
        return switch (this) {
            case ROOM_PAINT, ROOM_DELETE -> ROOM_DELETE;
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> CLUSTER_WALL_DELETE;
            case CLUSTER_DOOR, CLUSTER_DOOR_DELETE -> CLUSTER_DOOR_DELETE;
            case CORRIDOR_CREATE, CORRIDOR_DELETE -> CORRIDOR_DELETE;
            case STAIR_CREATE, STAIR_DELETE -> STAIR_DELETE;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION_DELETE;
            case SELECT -> this;
        };
    }
}
