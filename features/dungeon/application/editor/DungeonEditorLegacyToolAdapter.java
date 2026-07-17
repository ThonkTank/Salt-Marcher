package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;

/** M2-only adapter between the typed Editor API and the legacy runtime tool enum. */
final class DungeonEditorLegacyToolAdapter {
    private DungeonEditorLegacyToolAdapter() {
    }

    static DungeonEditorToolSelection selection(DungeonEditorTool tool) {
        DungeonEditorTool safeTool = tool == null ? DungeonEditorTool.SELECT : tool;
        return switch (safeTool) {
            case SELECT -> DungeonEditorToolSelection.select();
            case ROOM_PAINT, ROOM_DELETE -> DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM);
            case WALL_CREATE -> new DungeonEditorToolSelection(
                    DungeonEditorToolFamily.WALL,
                    new DungeonEditorToolOptions.Wall(DungeonEditorToolOptions.Wall.Mode.PATH));
            case WALL_DELETE -> DungeonEditorToolSelection.family(DungeonEditorToolFamily.WALL);
            case DOOR_CREATE, DOOR_DELETE -> DungeonEditorToolSelection.family(DungeonEditorToolFamily.DOOR);
            case CORRIDOR_CREATE, CORRIDOR_DELETE ->
                    DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR);
            case STAIR_CREATE -> stair(DungeonEditorToolOptions.Stair.Shape.STRAIGHT);
            case STAIR_CREATE_SQUARE -> stair(DungeonEditorToolOptions.Stair.Shape.SQUARE);
            case STAIR_CREATE_CIRCULAR -> stair(DungeonEditorToolOptions.Stair.Shape.CIRCULAR);
            case STAIR_DELETE -> DungeonEditorToolSelection.family(DungeonEditorToolFamily.STAIR);
            case TRANSITION_CREATE, TRANSITION_DELETE ->
                    DungeonEditorToolSelection.family(DungeonEditorToolFamily.TRANSITION);
            case FEATURE_POI_CREATE -> feature(DungeonEditorToolOptions.Feature.Kind.POINT_OF_INTEREST);
            case FEATURE_OBJECT_CREATE -> feature(DungeonEditorToolOptions.Feature.Kind.OBJECT);
            case FEATURE_ENCOUNTER_CREATE -> feature(DungeonEditorToolOptions.Feature.Kind.ENCOUNTER);
            case FEATURE_DELETE -> DungeonEditorToolSelection.family(DungeonEditorToolFamily.FEATURE);
        };
    }

    static DungeonEditorTool tool(DungeonEditorToolSelection selection) {
        DungeonEditorToolSelection safeSelection = selection == null
                ? DungeonEditorToolSelection.select()
                : selection;
        return switch (safeSelection.family()) {
            case SELECT -> DungeonEditorTool.SELECT;
            case ROOM -> DungeonEditorTool.ROOM_PAINT;
            case WALL -> DungeonEditorTool.WALL_CREATE;
            case DOOR -> DungeonEditorTool.DOOR_CREATE;
            case CORRIDOR -> DungeonEditorTool.CORRIDOR_CREATE;
            case STAIR -> stairTool(safeSelection.options());
            case TRANSITION -> DungeonEditorTool.TRANSITION_CREATE;
            case FEATURE -> featureTool(safeSelection.options());
        };
    }

    static boolean wallSingleClick(DungeonEditorToolSelection selection) {
        return selection != null
                && selection.options() instanceof DungeonEditorToolOptions.Wall wall
                && wall.mode() == DungeonEditorToolOptions.Wall.Mode.SINGLE;
    }

    private static DungeonEditorTool stairTool(DungeonEditorToolOptions options) {
        if (!(options instanceof DungeonEditorToolOptions.Stair stair)) {
            return DungeonEditorTool.STAIR_CREATE;
        }
        return switch (stair.shape()) {
            case STRAIGHT -> DungeonEditorTool.STAIR_CREATE;
            case SQUARE -> DungeonEditorTool.STAIR_CREATE_SQUARE;
            case CIRCULAR -> DungeonEditorTool.STAIR_CREATE_CIRCULAR;
        };
    }

    private static DungeonEditorTool featureTool(DungeonEditorToolOptions options) {
        if (!(options instanceof DungeonEditorToolOptions.Feature feature)) {
            return DungeonEditorTool.FEATURE_POI_CREATE;
        }
        return switch (feature.kind()) {
            case POINT_OF_INTEREST -> DungeonEditorTool.FEATURE_POI_CREATE;
            case OBJECT -> DungeonEditorTool.FEATURE_OBJECT_CREATE;
            case ENCOUNTER -> DungeonEditorTool.FEATURE_ENCOUNTER_CREATE;
        };
    }

    private static DungeonEditorToolSelection stair(DungeonEditorToolOptions.Stair.Shape shape) {
        return new DungeonEditorToolSelection(
                DungeonEditorToolFamily.STAIR,
                new DungeonEditorToolOptions.Stair(shape));
    }

    private static DungeonEditorToolSelection feature(DungeonEditorToolOptions.Feature.Kind kind) {
        return new DungeonEditorToolSelection(
                DungeonEditorToolFamily.FEATURE,
                new DungeonEditorToolOptions.Feature(kind));
    }
}
