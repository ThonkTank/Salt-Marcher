package features.world.dungeonmap.ui.workspace;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM_PAINT("Raum malen"),
    ROOM_DELETE("Raum löschen"),
    CLUSTER_WALL("Wand setzen"),
    CLUSTER_WALL_DELETE("Wand löschen"),
    CLUSTER_DOOR("Tür setzen"),
    CLUSTER_DOOR_DELETE("Tür löschen"),
    CORRIDOR_CREATE("Korridor erstellen"),
    CORRIDOR_DELETE("Korridor löschen");

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

    public boolean isWallTool() {
        return this == CLUSTER_WALL || this == CLUSTER_WALL_DELETE;
    }

    public boolean isDoorTool() {
        return this == CLUSTER_DOOR || this == CLUSTER_DOOR_DELETE;
    }

    public DungeonEditorTool editVariant() {
        if (isRoomTool()) {
            return ROOM_PAINT;
        }
        if (isWallTool()) {
            return CLUSTER_WALL;
        }
        if (isDoorTool()) {
            return CLUSTER_DOOR;
        }
        if (isCorridorTool()) {
            return CORRIDOR_CREATE;
        }
        return null;
    }

    public DungeonEditorTool deleteVariant() {
        if (isRoomTool()) {
            return ROOM_DELETE;
        }
        if (isWallTool()) {
            return CLUSTER_WALL_DELETE;
        }
        if (isDoorTool()) {
            return CLUSTER_DOOR_DELETE;
        }
        if (isCorridorTool()) {
            return CORRIDOR_DELETE;
        }
        return null;
    }
}
