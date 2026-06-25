package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerOperationDispatcher {
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;

    DungeonEditorPointerOperationDispatcher(DungeonEditorAuthoredRuntimeOperations operationOwner) {
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (applyDraftPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination)) {
            return;
        }
        if (applyPointPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination)) {
            return;
        }
        applySelectionPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination);
    }

    private boolean applyDraftPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorTool wallTool = DungeonEditorWallBoundaryDraftRuntimeOperation.wallTool(toolKey);
        if (wallTool != null) {
            operationOwner.applyWallBoundaryDraft(action, wallTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        DungeonEditorTool doorTool = DungeonEditorDoorBoundaryDraftRuntimeOperation.doorTool(toolKey);
        if (doorTool != null) {
            operationOwner.applyDoorBoundaryDraft(action, doorTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        DungeonEditorTool corridorTool = DungeonEditorCorridorDraftRuntimeOperation.corridorTool(toolKey);
        if (corridorTool != null) {
            operationOwner.applyCorridorDraft(action, corridorTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        DungeonEditorTool stairTool = DungeonEditorStairDraftRuntimeOperation.stairTool(toolKey);
        if (stairTool != null) {
            operationOwner.applyStairDraft(action, stairTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        return false;
    }

    private boolean applyPointPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorTool editorTool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        DungeonEditorSessionValues.Tool roomTool = DungeonEditorRoomPaintRuntimeOperation.roomTool(editorTool);
        if (roomTool != null) {
            operationOwner.applyRoomPaint(action, roomTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        if (DungeonEditorStairDeleteRuntimeOperation.handles(editorTool)) {
            operationOwner.applyStairDelete(action, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        if (DungeonEditorTransitionRuntimeOperation.handles(editorTool)) {
            operationOwner.applyTransition(action, editorTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        if (DungeonEditorFeatureMarkerRuntimeOperation.handles(editorTool)) {
            operationOwner.applyFeatureMarker(action, editorTool, sample, wallSingleClickMode, transitionDestination);
            return true;
        }
        return false;
    }

    private void applySelectionPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorTool.SELECT == DungeonEditorRuntimeEnumTranslator.editorTool(toolKey)) {
            operationOwner.applySelectionHandlePreview(action, sample, wallSingleClickMode, transitionDestination);
        }
    }
}
