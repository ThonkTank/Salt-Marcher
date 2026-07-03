package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerOperationDispatcher {
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;

    DungeonEditorPointerOperationDispatcher(DungeonEditorAuthoredRuntimeOperations operationOwner) {
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    DungeonEditorRuntimeOperationResult applyPointer(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DraftPointerResult draftResult =
                applyDraftPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        if (draftResult.handled()) {
            return draftResult.result();
        }
        DungeonEditorRuntimeOperationResult pointResult =
                applyPointPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        if (pointResult != null) {
            return pointResult;
        }
        DungeonEditorRuntimeOperationResult selectionResult =
                applySelectionPointer(action, tool, sample, wallSingleClickMode, transitionDestination);
        return selectionResult == null ? DungeonEditorRuntimeOperationResult.none() : selectionResult;
    }

    private DraftPointerResult applyDraftPointer(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorWallBoundaryDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(operationOwner.applyWallBoundaryDraft(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorDoorBoundaryDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(operationOwner.applyDoorBoundaryDraft(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorCorridorDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(operationOwner.applyCorridorDraft(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        if (DungeonEditorStairDraftRuntimeOperation.handles(tool)) {
            return DraftPointerResult.handled(operationOwner.applyStairDraft(
                    action,
                    tool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination));
        }
        return DraftPointerResult.notHandled();
    }

    private DungeonEditorRuntimeOperationResult applyPointPointer(
            PointerAction action,
            DungeonEditorTool editorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorSessionValues.Tool roomTool = DungeonEditorRoomPaintRuntimeOperation.roomTool(editorTool);
        if (roomTool != null) {
            return operationOwner.applyRoomPaint(action, roomTool, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorStairDeleteRuntimeOperation.handles(editorTool)) {
            return operationOwner.applyStairDelete(action, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorTransitionRuntimeOperation.handles(editorTool)) {
            return operationOwner.applyTransition(action, editorTool, sample, wallSingleClickMode, transitionDestination);
        }
        if (DungeonEditorFeatureMarkerRuntimeOperation.handles(editorTool)) {
            return operationOwner.applyFeatureMarker(action, editorTool, sample, wallSingleClickMode, transitionDestination);
        }
        return null;
    }

    private DungeonEditorRuntimeOperationResult applySelectionPointer(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorTool.SELECT == tool) {
            return operationOwner.applySelectionHandlePreview(action, sample, wallSingleClickMode, transitionDestination);
        }
        return null;
    }

    private record DraftPointerResult(
            boolean handled,
            DungeonEditorRuntimeOperationResult result
    ) {
        static DraftPointerResult handled(DungeonEditorRuntimeOperationResult result) {
            return new DraftPointerResult(true, result);
        }

        static DraftPointerResult notHandled() {
            return new DraftPointerResult(false, DungeonEditorRuntimeOperationResult.none());
        }
    }
}
