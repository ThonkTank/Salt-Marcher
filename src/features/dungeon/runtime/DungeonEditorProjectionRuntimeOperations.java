package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

final class DungeonEditorProjectionRuntimeOperations {
    private static final String SELECTION_TOOL = "SELECT";

    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;

    DungeonEditorProjectionRuntimeOperations(
            DungeonEditorAuthoredRuntimeOperationUseCases.ProjectionUseCases useCases,
            DungeonEditorStairDraftRuntimeOperation stairDraftOperation
    ) {
        DungeonEditorAuthoredRuntimeOperationUseCases.ProjectionUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        this.stairDraftOperation = Objects.requireNonNull(stairDraftOperation, "stairDraftOperation");
        setViewModeUseCase = Objects.requireNonNull(safeUseCases.setViewMode(), "setViewModeUseCase");
        setToolUseCase = Objects.requireNonNull(safeUseCases.setTool(), "setToolUseCase");
        shiftProjectionLevelUseCase = Objects.requireNonNull(safeUseCases.shiftLevel(), "shiftProjectionLevelUseCase");
        setOverlayUseCase = Objects.requireNonNull(safeUseCases.setOverlay(), "setOverlayUseCase");
    }

    DungeonEditorRuntimeOperationResult setViewMode(String viewModeKey) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(
                setViewModeUseCase.execute(DungeonEditorRuntimeInputTranslator.viewModeName(viewModeKey)));
    }

    DungeonEditorRuntimeOperationResult setTool(String toolKey) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromControls(
                setToolUseCase.executeControlsOnly(DungeonEditorRuntimeInputTranslator.toolName(toolKey)));
    }

    DungeonEditorRuntimeOperationResult setToolAndPublishSnapshot(String toolKey) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.toolName(toolKey)));
    }

    DungeonEditorRuntimeOperationResult cancelActivePreviewSession() {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(setToolUseCase.execute(SELECTION_TOOL));
    }

    DungeonEditorRuntimeOperationResult shiftProjectionLevel(int levelShift) {
        DungeonEditorSessionSnapshot.SessionFrameData frameData = shiftProjectionLevelUseCase.execute(levelShift);
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(frameData)
                .merge(stairDraftOperation.refreshAfterProjectionLevelChanged());
    }

    DungeonEditorRuntimeOperationResult setOverlay(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(
                setOverlayUseCase.execute(modeKey, levelRange, opacity, selectedLevels));
    }
}
