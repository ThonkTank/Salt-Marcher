package features.world.dungeonmap.ui.workspace;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM_PAINT("Raum malen"),
    ROOM_DELETE("Raum löschen"),
    CLUSTER_WALL("Custom-Wand"),
    CLUSTER_DOOR("Custom-Tür"),
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
        return this == ROOM_PAINT || this == ROOM_DELETE || this == CLUSTER_WALL || this == CLUSTER_DOOR;
    }

    public boolean isCorridorTool() {
        return this == CORRIDOR_CREATE || this == CORRIDOR_DELETE;
    }
}
