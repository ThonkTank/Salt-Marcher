package src.domain.dungeon.published;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM_PAINT("Raum malen"),
    ROOM_DELETE("Raum l\u00f6schen"),
    WALL_CREATE("Wand setzen"),
    WALL_DELETE("Wand l\u00f6schen"),
    DOOR_CREATE("T\u00fcr setzen"),
    DOOR_DELETE("T\u00fcr l\u00f6schen"),
    CORRIDOR_CREATE("Korridor erstellen"),
    CORRIDOR_DELETE("Korridor l\u00f6schen"),
    STAIR_CREATE("Treppe erstellen"),
    STAIR_CREATE_SQUARE("Treppe erstellen"),
    STAIR_CREATE_CIRCULAR("Treppe erstellen"),
    STAIR_DELETE("Treppe l\u00f6schen"),
    TRANSITION_CREATE("\u00dcbergang erstellen"),
    TRANSITION_DELETE("\u00dcbergang l\u00f6schen"),
    FEATURE_POI_CREATE("POI erstellen"),
    FEATURE_OBJECT_CREATE("Objekt erstellen"),
    FEATURE_ENCOUNTER_CREATE("Encounter erstellen"),
    FEATURE_DELETE("Feature l\u00f6schen");

    private final String displayLabel;

    DungeonEditorTool(String displayLabel) {
        this.displayLabel = displayLabel;
    }

    public String displayLabel() {
        return displayLabel;
    }

    public static String labelFor(DungeonEditorTool tool) {
        return tool == null ? SELECT.displayLabel : tool.displayLabel;
    }
}
