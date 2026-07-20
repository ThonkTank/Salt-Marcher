package features.dungeon.adapter.javafx;

import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;

/** JavaFX-owned labels for typed Dungeon Editor tool language. */
public final class DungeonEditorToolPresentation {
    private DungeonEditorToolPresentation() {
    }

    public static String label(DungeonEditorToolSelection selection) {
        DungeonEditorToolSelection safeSelection = safe(selection);
        return switch (safeSelection.family()) {
            case SELECT -> "Auswahl";
            case ROOM -> "Raum malen";
            case WALL -> "Wand setzen";
            case DOOR -> "Tür setzen";
            case CORRIDOR -> "Korridor erstellen";
            case STAIR -> "Treppe erstellen";
            case TRANSITION -> "Übergang erstellen";
            case FEATURE -> featureLabel(safeSelection.options());
        };
    }

    public static String familyLabel(DungeonEditorToolFamily family) {
        DungeonEditorToolFamily safeFamily = family == null ? DungeonEditorToolFamily.SELECT : family;
        return switch (safeFamily) {
            case SELECT -> "Auswahl";
            case ROOM -> "Raum";
            case WALL -> "Wand";
            case DOOR -> "Tür";
            case CORRIDOR -> "Korridor";
            case FEATURE -> "Feature";
            case STAIR -> "Treppe";
            case TRANSITION -> "Übergang";
        };
    }

    public static String optionLabel(DungeonEditorToolSelection selection) {
        DungeonEditorToolOptions options = safe(selection).options();
        if (options instanceof DungeonEditorToolOptions.Wall wall) {
            return wall.mode() == DungeonEditorToolOptions.Wall.Mode.SINGLE ? "Einzeln" : "Pfad";
        }
        if (options instanceof DungeonEditorToolOptions.Stair stair) {
            return switch (stair.shape()) {
                case STRAIGHT -> "Gerade";
                case SQUARE -> "Eckspirale";
                case CIRCULAR -> "Rundspirale";
            };
        }
        if (options instanceof DungeonEditorToolOptions.Feature feature) {
            return switch (feature.kind()) {
                case POINT_OF_INTEREST -> "POI";
                case OBJECT -> "Objekt";
                case ENCOUNTER -> "Encounter";
            };
        }
        return familyLabel(safe(selection).family());
    }

    private static String featureLabel(DungeonEditorToolOptions options) {
        if (!(options instanceof DungeonEditorToolOptions.Feature feature)) {
            return "POI erstellen";
        }
        return switch (feature.kind()) {
            case POINT_OF_INTEREST -> "POI erstellen";
            case OBJECT -> "Objekt erstellen";
            case ENCOUNTER -> "Encounter erstellen";
        };
    }

    private static DungeonEditorToolSelection safe(DungeonEditorToolSelection selection) {
        return selection == null ? DungeonEditorToolSelection.select() : selection;
    }
}
