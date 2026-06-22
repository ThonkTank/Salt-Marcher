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
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorAuthoredRuntimeOperations implements DungeonEditorRuntimeOperations {
    private static final String SELECTION_TOOL = "SELECT";

    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;
    private final ApplyDungeonEditorToolWorkflowUseCase applyToolWorkflowUseCase;
    private final DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraftOperation;
    private final DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraftOperation;
    private final DungeonEditorCorridorDraftRuntimeOperation corridorDraftOperation;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;
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
        applyToolWorkflowUseCase = Objects.requireNonNull(safeUseCases.toolWorkflow(), "applyToolWorkflowUseCase");
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

    @Override
    public void selectMap(long mapIdValue) {
        stairDraftOperation.clear();
        selectMapUseCase.execute(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        stairDraftOperation.clear();
        createMapUseCase.execute(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        renameMapUseCase.execute(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        stairDraftOperation.clear();
        deleteMapUseCase.execute(mapIdValue);
    }

    @Override
    public void setViewMode(String viewModeKey) {
        stairDraftOperation.clear();
        setViewModeUseCase.execute(DungeonEditorRuntimeInputTranslator.viewModeName(viewModeKey));
    }

    @Override
    public void setTool(String toolKey) {
        stairDraftOperation.clear();
        setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.toolName(toolKey));
    }

    @Override
    public void cancelActivePreviewSession() {
        stairDraftOperation.clear();
        setToolUseCase.execute(SELECTION_TOOL);
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        shiftProjectionLevelUseCase.execute(levelShift);
        stairDraftOperation.refreshAfterProjectionLevelChanged();
    }

    @Override
    public void setOverlay(String modeKey, int levelRange, double opacity, java.util.List<Integer> selectedLevels) {
        setOverlayUseCase.execute(modeKey, levelRange, opacity, selectedLevels);
    }

    @Override
    public void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        applyToolWorkflowUseCase.apply(DungeonEditorRuntimeInputTranslator.toolWorkflowInput(
                action,
                toolKey,
                sample,
                wallSingleClickMode,
                transitionDestination));
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

    @Override
    public void scrollSelection(int levelDelta) {
        selectedHandleOperation.scroll(levelDelta);
    }

    void moveCorridorPoint(HandleTarget handle, int q, int r) {
        selectedHandleOperation.moveCorridorPoint(handle, q, r);
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", java.util.List.of()) : narration;
        saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                DungeonEditorRuntimeInputTranslator.exitInputs(safeNarration)));
    }

    @Override
    public void saveLabelName(String targetKind, long targetId, String name) {
        saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                targetKind,
                targetId,
                name));
    }

    @Override
    public void saveTransitionLink(
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

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        saveTransitionDescriptionUseCase.execute(
                new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(
                        transitionId,
                        description));
    }

    @Override
    public void saveStairGeometry(
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
