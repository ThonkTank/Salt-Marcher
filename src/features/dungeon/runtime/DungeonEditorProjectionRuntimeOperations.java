package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;

final class DungeonEditorProjectionRuntimeOperations {
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

    DungeonEditorRuntimeOperationResult setViewMode(DungeonEditorViewMode viewMode) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(
                setViewModeUseCase.execute(DungeonEditorRuntimeInputTranslator.viewMode(viewMode)));
    }

    DungeonEditorRuntimeOperationResult setTool(DungeonEditorTool tool) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromControls(
                setToolUseCase.executeControlsOnly(DungeonEditorRuntimeInputTranslator.tool(tool)));
    }

    DungeonEditorRuntimeOperationResult setToolAndPublishSnapshot(DungeonEditorTool tool) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.tool(tool)));
    }

    DungeonEditorRuntimeOperationResult cancelActivePreviewSession() {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(
                setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.tool(DungeonEditorTool.SELECT)));
    }

    DungeonEditorRuntimeOperationResult shiftProjectionLevel(int levelShift) {
        DungeonEditorSessionSnapshot.SessionFrameData frameData = shiftProjectionLevelUseCase.execute(levelShift);
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(frameData)
                .merge(stairDraftOperation.refreshAfterProjectionLevelChanged());
    }

    DungeonEditorRuntimeOperationResult setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        return DungeonEditorRuntimeResultTranslator.fromSessionFrame(
                setOverlayUseCase.execute(DungeonEditorRuntimeInputTranslator.overlaySettings(overlaySettings)));
    }
}
