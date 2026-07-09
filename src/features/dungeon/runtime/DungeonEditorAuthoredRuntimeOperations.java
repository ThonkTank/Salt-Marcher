package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorAuthoredRuntimeOperations {
    private final DungeonEditorMapCatalogRuntimeOperations mapCatalogOperations;
    private final DungeonEditorProjectionRuntimeOperations projectionOperations;
    private final DungeonEditorRoomPaintRuntimeOperation roomPaintOperation;
    private final DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraftOperation;
    private final DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraftOperation;
    private final DungeonEditorCorridorDraftRuntimeOperation corridorDraftOperation;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;
    private final DungeonEditorStairDeleteRuntimeOperation stairDeleteOperation;
    private final DungeonEditorTransitionRuntimeOperation transitionOperation;
    private final DungeonEditorFeatureMarkerRuntimeOperation featureMarkerOperation;
    private final DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation;
    private final DungeonEditorDetailSaveRuntimeOperations detailSaveOperations;

    DungeonEditorAuthoredRuntimeOperations(DungeonEditorAuthoredRuntimeOperationUseCases useCases) {
        DungeonEditorAuthoredRuntimeOperationUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        stairDraftOperation = Objects.requireNonNull(
                safeUseCases.stairDraft(),
                "stairDraftOperation");
        mapCatalogOperations = new DungeonEditorMapCatalogRuntimeOperations(safeUseCases.map(), stairDraftOperation);
        projectionOperations = new DungeonEditorProjectionRuntimeOperations(
                safeUseCases.projection(),
                stairDraftOperation);
        roomPaintOperation = Objects.requireNonNull(safeUseCases.roomPaint(), "roomPaintOperation");
        wallBoundaryDraftOperation = Objects.requireNonNull(safeUseCases.wallBoundaryDraft(), "wallBoundaryDraftOperation");
        doorBoundaryDraftOperation = Objects.requireNonNull(safeUseCases.doorBoundaryDraft(), "doorBoundaryDraftOperation");
        corridorDraftOperation = Objects.requireNonNull(safeUseCases.corridorDraft(), "corridorDraftOperation");
        stairDeleteOperation = Objects.requireNonNull(safeUseCases.stairDelete(), "stairDeleteOperation");
        transitionOperation = Objects.requireNonNull(safeUseCases.transition(), "transitionOperation");
        featureMarkerOperation = Objects.requireNonNull(safeUseCases.featureMarker(), "featureMarkerOperation");
        selectedHandleOperation = Objects.requireNonNull(safeUseCases.selectedHandle(), "selectedHandleOperation");
        detailSaveOperations = new DungeonEditorDetailSaveRuntimeOperations(safeUseCases.detail());
    }

    DungeonEditorRuntimeOperationResult selectMap(long mapIdValue) {
        return mapCatalogOperations.selectMap(mapIdValue);
    }

    DungeonEditorRuntimeOperationResult createMap(String mapName) {
        return mapCatalogOperations.createMap(mapName);
    }

    DungeonEditorRuntimeOperationResult renameMap(long mapIdValue, String mapName) {
        return mapCatalogOperations.renameMap(mapIdValue, mapName);
    }

    DungeonEditorRuntimeOperationResult deleteMap(long mapIdValue) {
        return mapCatalogOperations.deleteMap(mapIdValue);
    }

    DungeonEditorRuntimeOperationResult setViewMode(DungeonEditorViewMode viewMode) {
        return projectionOperations.setViewMode(viewMode);
    }

    DungeonEditorRuntimeOperationResult setTool(DungeonEditorTool tool) {
        return projectionOperations.setTool(tool);
    }

    DungeonEditorRuntimeOperationResult setToolAndPublishSnapshot(DungeonEditorTool tool) {
        return projectionOperations.setToolAndPublishSnapshot(tool);
    }

    DungeonEditorRuntimeOperationResult cancelActivePreviewSession() {
        return projectionOperations.cancelActivePreviewSession();
    }

    DungeonEditorRuntimeOperationResult shiftProjectionLevel(int levelShift) {
        return projectionOperations.shiftProjectionLevel(levelShift);
    }

    DungeonEditorRuntimeOperationResult setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        return projectionOperations.setOverlay(overlaySettings);
    }

    DungeonEditorRuntimeOperationResult applyRoomPaint(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return roomPaintOperation.apply(action, tool, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyStairDelete(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return stairDeleteOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyTransition(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return transitionOperation.apply(
                action,
                tool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyFeatureMarker(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return featureMarkerOperation.apply(
                action,
                tool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyWallBoundaryDraft(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return wallBoundaryDraftOperation.apply(
                action,
                wallTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyDoorBoundaryDraft(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return doorBoundaryDraftOperation.apply(
                action,
                doorTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyCorridorDraft(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return corridorDraftOperation.apply(
                action,
                corridorTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyStairDraft(
            PointerAction action,
            DungeonEditorTool stairTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return stairDraftOperation.apply(
                action,
                stairTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applySelectionHandlePreview(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return selectedHandleOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult scrollSelection(int levelDelta) {
        return selectedHandleOperation.scroll(levelDelta);
    }

    DungeonEditorRuntimeOperationResult moveCorridorPoint(
            DungeonEditorWorkspaceValues.HandleRef handle,
            int q,
            int r
    ) {
        return selectedHandleOperation.moveCorridorPoint(handle, q, r);
    }

    DungeonEditorRuntimeOperationResult saveRoomNarration(RoomNarration narration) {
        return detailSaveOperations.saveRoomNarration(narration);
    }

    DungeonEditorRuntimeOperationResult saveLabelName(
            DungeonEditorRuntimeLabelTarget target,
            String name
    ) {
        return detailSaveOperations.saveLabelName(target, name);
    }

    DungeonEditorRuntimeOperationResult saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return detailSaveOperations.saveTransitionLink(
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional);
    }

    DungeonEditorRuntimeOperationResult saveTransitionDescription(
            long transitionId,
            String description
    ) {
        return detailSaveOperations.saveTransitionDescription(transitionId, description);
    }

    DungeonEditorRuntimeOperationResult saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return detailSaveOperations.saveStairGeometry(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2);
    }
}
