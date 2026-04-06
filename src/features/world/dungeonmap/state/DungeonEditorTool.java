package features.world.dungeonmap.state;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM_PAINT("Raum malen"),
    ROOM_DELETE("Raum löschen"),
    FLOOR_PAINT("Boden malen"),
    FLOOR_DELETE("Boden löschen"),
    CLUSTER_WALL("Wand setzen"),
    CLUSTER_WALL_DELETE("Wand löschen"),
    DOOR("Tür"),
    CORRIDOR("Korridor"),
    STAIR("Treppe"),
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

    public boolean isFloorTool() {
        return this == FLOOR_PAINT || this == FLOOR_DELETE;
    }

    public boolean isTransitionTool() {
        return this == TRANSITION_CREATE || this == TRANSITION_DELETE;
    }

    public boolean isWallTool() {
        return this == CLUSTER_WALL || this == CLUSTER_WALL_DELETE;
    }

    public boolean isDoorTool() {
        return this == DOOR;
    }

    public boolean isCorridorTool() {
        return this == CORRIDOR;
    }

    public boolean isStairTool() {
        return this == STAIR;
    }

    public DungeonEditorTool editVariant() {
        return switch (this) {
            case ROOM_PAINT, ROOM_DELETE -> ROOM_PAINT;
            case FLOOR_PAINT, FLOOR_DELETE -> FLOOR_PAINT;
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> CLUSTER_WALL;
            case DOOR -> DOOR;
            case CORRIDOR -> CORRIDOR;
            case STAIR -> STAIR;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION_CREATE;
            case SELECT -> this;
        };
    }

    public DungeonEditorTool deleteVariant() {
        return switch (this) {
            case ROOM_PAINT, ROOM_DELETE -> ROOM_DELETE;
            case FLOOR_PAINT, FLOOR_DELETE -> FLOOR_DELETE;
            case CLUSTER_WALL, CLUSTER_WALL_DELETE -> CLUSTER_WALL_DELETE;
            case DOOR -> DOOR;
            case CORRIDOR -> CORRIDOR;
            case STAIR -> STAIR;
            case TRANSITION_CREATE, TRANSITION_DELETE -> TRANSITION_DELETE;
            case SELECT -> this;
        };
    }
}
