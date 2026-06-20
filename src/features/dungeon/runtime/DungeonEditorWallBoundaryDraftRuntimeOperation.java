package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateWallUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteWallUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final ApplyDungeonEditorCreateWallUseCase createWall;
    private final ApplyDungeonEditorDeleteWallUseCase deleteWall;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        createWall = new ApplyDungeonEditorCreateWallUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
        deleteWall = new ApplyDungeonEditorDeleteWallUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
    }

    static @Nullable DungeonEditorTool wallTool(String toolKey) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        return tool == DungeonEditorTool.WALL_CREATE || tool == DungeonEditorTool.WALL_DELETE ? tool : null;
    }

    void apply(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        MainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (wallTool == DungeonEditorTool.WALL_CREATE) {
            applyCreate(action, input);
        } else if (wallTool == DungeonEditorTool.WALL_DELETE) {
            applyDelete(action, input);
        } else {
            throw new IllegalArgumentException("Unsupported wall draft tool: " + wallTool);
        }
    }

    private void applyCreate(PointerAction action, MainViewInput input) {
        PointerAction effectiveAction = previewAction(action);
        if (effectiveAction == PointerAction.PRESSED) {
            createWall.press(input);
        } else if (effectiveAction == PointerAction.DRAGGED) {
            createWall.drag(input);
        } else if (effectiveAction == PointerAction.RELEASED) {
            createWall.release(input);
        } else if (effectiveAction == PointerAction.MOVED) {
            createWall.hover(input);
        } else {
            throw new IllegalStateException("Unsupported wall create pointer action: " + effectiveAction);
        }
    }

    private void applyDelete(PointerAction action, MainViewInput input) {
        PointerAction effectiveAction = previewAction(action);
        if (effectiveAction == PointerAction.PRESSED) {
            deleteWall.press(input);
        } else if (effectiveAction == PointerAction.DRAGGED) {
            deleteWall.drag(input);
        } else if (effectiveAction == PointerAction.RELEASED) {
            deleteWall.release(input);
        } else if (effectiveAction == PointerAction.MOVED) {
            deleteWall.hover(input);
        } else {
            throw new IllegalStateException("Unsupported wall delete pointer action: " + effectiveAction);
        }
    }

    private static PointerAction previewAction(PointerAction action) {
        return action == null ? PointerAction.MOVED : action;
    }

}
