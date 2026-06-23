package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.RoomNarration;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorAuthoredRuntimeOperations {
    private static final String SELECTION_TOOL = "SELECT";

    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;
    private final DungeonEditorRoomPaintRuntimeOperation roomPaintOperation;
    private final DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraftOperation;
    private final DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraftOperation;
    private final DungeonEditorCorridorDraftRuntimeOperation corridorDraftOperation;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;
    private final DungeonEditorStairDeleteRuntimeOperation stairDeleteOperation;
    private final DungeonEditorTransitionRuntimeOperation transitionOperation;
    private final DungeonEditorFeatureMarkerRuntimeOperation featureMarkerOperation;
    private final DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation;
    private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;
    private final SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase;
    private final SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
    private final SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase;
    private final SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase;

    DungeonEditorAuthoredRuntimeOperations(DungeonEditorAuthoredRuntimeOperationUseCases useCases) {
        DungeonEditorAuthoredRuntimeOperationUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        selectMapUseCase = Objects.requireNonNull(safeUseCases.map().select(), "selectMapUseCase");
        createMapUseCase = Objects.requireNonNull(safeUseCases.map().create(), "createMapUseCase");
        renameMapUseCase = Objects.requireNonNull(safeUseCases.map().rename(), "renameMapUseCase");
        deleteMapUseCase = Objects.requireNonNull(safeUseCases.map().delete(), "deleteMapUseCase");
        setViewModeUseCase = Objects.requireNonNull(safeUseCases.projection().setViewMode(), "setViewModeUseCase");
        setToolUseCase = Objects.requireNonNull(safeUseCases.projection().setTool(), "setToolUseCase");
        shiftProjectionLevelUseCase = Objects.requireNonNull(
                safeUseCases.projection().shiftLevel(),
                "shiftProjectionLevelUseCase");
        setOverlayUseCase = Objects.requireNonNull(safeUseCases.projection().setOverlay(), "setOverlayUseCase");
        roomPaintOperation = Objects.requireNonNull(safeUseCases.roomPaint(), "roomPaintOperation");
        wallBoundaryDraftOperation = Objects.requireNonNull(
                safeUseCases.wallBoundaryDraft(),
                "wallBoundaryDraftOperation");
        doorBoundaryDraftOperation = Objects.requireNonNull(
                safeUseCases.doorBoundaryDraft(),
                "doorBoundaryDraftOperation");
        corridorDraftOperation = Objects.requireNonNull(
                safeUseCases.corridorDraft(),
                "corridorDraftOperation");
        stairDraftOperation = Objects.requireNonNull(
                safeUseCases.stairDraft(),
                "stairDraftOperation");
        stairDeleteOperation = Objects.requireNonNull(
                safeUseCases.stairDelete(),
                "stairDeleteOperation");
        transitionOperation = Objects.requireNonNull(
                safeUseCases.transition(),
                "transitionOperation");
        featureMarkerOperation = Objects.requireNonNull(
                safeUseCases.featureMarker(),
                "featureMarkerOperation");
        selectedHandleOperation = Objects.requireNonNull(
                safeUseCases.selectedHandle(),
                "selectedHandleOperation");
        saveRoomNarrationUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveRoomNarration(),
                "saveRoomNarrationUseCase");
        saveLabelNameUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveLabelName(),
                "saveLabelNameUseCase");
        saveTransitionDescriptionUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveTransitionDescription(),
                "saveTransitionDescriptionUseCase");
        saveTransitionLinkUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveTransitionLink(),
                "saveTransitionLinkUseCase");
        saveStairGeometryUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveStairGeometry(),
                "saveStairGeometryUseCase");
    }

    void selectMap(long mapIdValue) {
        stairDraftOperation.clear();
        selectMapUseCase.execute(mapIdValue);
    }

    void createMap(String mapName) {
        stairDraftOperation.clear();
        createMapUseCase.execute(mapName);
    }

    void renameMap(long mapIdValue, String mapName) {
        renameMapUseCase.execute(mapIdValue, mapName);
    }

    void deleteMap(long mapIdValue) {
        stairDraftOperation.clear();
        deleteMapUseCase.execute(mapIdValue);
    }

    void setViewMode(String viewModeKey) {
        stairDraftOperation.clear();
        setViewModeUseCase.execute(DungeonEditorRuntimeInputTranslator.viewModeName(viewModeKey));
    }

    void setTool(String toolKey) {
        stairDraftOperation.clear();
        setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.toolName(toolKey));
    }

    void cancelActivePreviewSession() {
        stairDraftOperation.clear();
        setToolUseCase.execute(SELECTION_TOOL);
    }

    void shiftProjectionLevel(int levelShift) {
        shiftProjectionLevelUseCase.execute(levelShift);
        stairDraftOperation.refreshAfterProjectionLevelChanged();
    }

    void setOverlay(String modeKey, int levelRange, double opacity, java.util.List<Integer> selectedLevels) {
        setOverlayUseCase.execute(modeKey, levelRange, opacity, selectedLevels);
    }

    void applyRoomPaint(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        roomPaintOperation.apply(action, tool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyStairDelete(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        stairDeleteOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    void applyTransition(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        transitionOperation.apply(action, tool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyFeatureMarker(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        featureMarkerOperation.apply(action, tool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyWallBoundaryDraft(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        wallBoundaryDraftOperation.apply(action, wallTool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyDoorBoundaryDraft(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        doorBoundaryDraftOperation.apply(action, doorTool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyCorridorDraft(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        corridorDraftOperation.apply(action, corridorTool, sample, wallSingleClickMode, transitionDestination);
    }

    void applyStairDraft(
            PointerAction action,
            DungeonEditorTool stairTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        stairDraftOperation.apply(action, stairTool, sample, wallSingleClickMode, transitionDestination);
    }

    void applySelectionHandlePreview(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        selectedHandleOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    void scrollSelection(int levelDelta) {
        selectedHandleOperation.scroll(levelDelta);
    }

    void moveCorridorPoint(DungeonEditorWorkspaceValues.HandleRef handle, int q, int r) {
        selectedHandleOperation.moveCorridorPoint(handle, q, r);
    }

    void saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", java.util.List.of()) : narration;
        saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                DungeonEditorRuntimeInputTranslator.exitInputs(safeNarration)));
    }

    void saveLabelName(String targetKind, long targetId, String name) {
        saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                targetKind,
                targetId,
                name));
    }

    void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        saveTransitionLinkUseCase.execute(new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional));
    }

    void saveTransitionDescription(long transitionId, String description) {
        saveTransitionDescriptionUseCase.execute(
                new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(
                        transitionId,
                        description));
    }

    void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2));
    }
}
