package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorTool;

public final class DungeonEditorToolFrameLabels {
    public static final String SELECT = "Auswahl";

    private DungeonEditorToolFrameLabels() {
    }

    public static String labelFor(DungeonEditorTool tool) {
        if (tool == null || tool == DungeonEditorTool.SELECT) {
            return SELECT;
        }
        String paintLabel = paintToolLabel(tool);
        if (!paintLabel.isBlank()) {
            return paintLabel;
        }
        String structureLabel = structureToolLabel(tool);
        return structureLabel.isBlank() ? transitionToolLabel(tool) : structureLabel;
    }

    private static String paintToolLabel(DungeonEditorTool tool) {
        return switch (tool) {
            case ROOM_PAINT -> "Raum malen";
            case ROOM_DELETE -> "Raum löschen";
            case WALL_CREATE -> "Wand setzen";
            case WALL_DELETE -> "Wand löschen";
            default -> "";
        };
    }

    private static String structureToolLabel(DungeonEditorTool tool) {
        return switch (tool) {
            case DOOR_CREATE -> "Tür setzen";
            case DOOR_DELETE -> "Tür löschen";
            case CORRIDOR_CREATE -> "Korridor erstellen";
            case CORRIDOR_DELETE -> "Korridor löschen";
            case FEATURE_POI_CREATE -> "POI erstellen";
            case FEATURE_OBJECT_CREATE -> "Objekt erstellen";
            case FEATURE_ENCOUNTER_CREATE -> "Encounter erstellen";
            case FEATURE_DELETE -> "Feature löschen";
            default -> "";
        };
    }

    private static String transitionToolLabel(DungeonEditorTool tool) {
        return switch (tool) {
            case STAIR_CREATE, STAIR_CREATE_SQUARE, STAIR_CREATE_CIRCULAR -> "Treppe erstellen";
            case STAIR_DELETE -> "Treppe löschen";
            case TRANSITION_CREATE -> "Übergang erstellen";
            case TRANSITION_DELETE -> "Übergang löschen";
            default -> SELECT;
        };
    }
}
