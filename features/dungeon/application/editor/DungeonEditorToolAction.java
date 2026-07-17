package features.dungeon.application.editor;

import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairShape;
import org.jspecify.annotations.Nullable;

/** Effective authored action derived from one selected tool family and one pointer gesture. */
record DungeonEditorToolAction(
        DungeonEditorToolSelection selection,
        Operation operation
) {
    DungeonEditorToolAction {
        selection = selection == null ? DungeonEditorToolSelection.select() : selection;
        operation = normalizedOperation(selection.family(), operation);
    }

    static DungeonEditorToolAction selected(DungeonEditorToolSelection selection) {
        DungeonEditorToolSelection safeSelection = selection == null
                ? DungeonEditorToolSelection.select()
                : selection;
        return new DungeonEditorToolAction(
                safeSelection,
                safeSelection.family() == DungeonEditorToolFamily.SELECT ? Operation.SELECT : Operation.CREATE);
    }

    static DungeonEditorToolAction delete(DungeonEditorToolSelection selection) {
        return new DungeonEditorToolAction(selection, Operation.DELETE);
    }

    DungeonEditorToolAction create() {
        return new DungeonEditorToolAction(selection, Operation.CREATE);
    }

    DungeonEditorToolFamily family() {
        return selection.family();
    }

    DungeonEditorToolOptions options() {
        return selection.options();
    }

    boolean is(DungeonEditorToolFamily expectedFamily, Operation expectedOperation) {
        return family() == expectedFamily && operation == expectedOperation;
    }

    boolean isSelect() {
        return operation == Operation.SELECT;
    }

    boolean deleteMode() {
        return operation == Operation.DELETE;
    }

    boolean isDoorAction() {
        return family() == DungeonEditorToolFamily.DOOR;
    }

    boolean prefersBoundaryTargets() {
        return family() == DungeonEditorToolFamily.WALL
                || family() == DungeonEditorToolFamily.DOOR
                || family() == DungeonEditorToolFamily.CORRIDOR;
    }

    boolean wallSingleClickMode(boolean controlDown) {
        return family() == DungeonEditorToolFamily.WALL
                && (controlDown
                || options() instanceof DungeonEditorToolOptions.Wall wall
                && wall.mode() == DungeonEditorToolOptions.Wall.Mode.SINGLE);
    }

    StairShape stairShape() {
        if (!(options() instanceof DungeonEditorToolOptions.Stair stair)) {
            return StairShape.STRAIGHT;
        }
        return switch (stair.shape()) {
            case STRAIGHT -> StairShape.STRAIGHT;
            case SQUARE -> StairShape.SQUARE;
            case CIRCULAR -> StairShape.CIRCULAR;
        };
    }

    @Nullable FeatureMarkerKind featureMarkerKind() {
        if (deleteMode() || !(options() instanceof DungeonEditorToolOptions.Feature feature)) {
            return null;
        }
        return switch (feature.kind()) {
            case POINT_OF_INTEREST -> FeatureMarkerKind.POI;
            case OBJECT -> FeatureMarkerKind.OBJECT;
            case ENCOUNTER -> FeatureMarkerKind.ENCOUNTER;
        };
    }

    private static Operation normalizedOperation(
            DungeonEditorToolFamily family,
            Operation operation
    ) {
        if (family == DungeonEditorToolFamily.SELECT) {
            return Operation.SELECT;
        }
        return operation == null || operation == Operation.SELECT ? Operation.CREATE : operation;
    }

    enum Operation {
        SELECT,
        CREATE,
        DELETE
    }
}
