package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorWallBoundaryDraftRuntimeOperation {
    private final PointerToolUseCase createWall;
    private final PointerToolUseCase deleteWall;

    DungeonEditorWallBoundaryDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorApplyToolUseCase toolUseCase = new DungeonEditorApplyToolUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
        createWall = toolUseCase.boundaryWorkflow(DungeonEditorSessionValues.Tool.WALL_CREATE);
        deleteWall = toolUseCase.boundaryWorkflow(DungeonEditorSessionValues.Tool.WALL_DELETE);
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
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
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

    private void applyCreate(PointerAction action, DungeonEditorMainViewInput input) {
        applyWorkflow(action, input, createWall, "wall create");
    }

    private void applyDelete(PointerAction action, DungeonEditorMainViewInput input) {
        applyWorkflow(action, input, deleteWall, "wall delete");
    }

    private static void applyWorkflow(
            PointerAction action,
            DungeonEditorMainViewInput input,
            PointerToolUseCase workflow,
            String workflowName
    ) {
        PointerAction effectiveAction = previewAction(action);
        ApplyDungeonEditorToolWorkflowUseCase.PointerAction toolAction;
        if (effectiveAction == PointerAction.PRESSED) {
            toolAction = workflow.press();
        } else if (effectiveAction == PointerAction.DRAGGED) {
            toolAction = workflow.drag();
        } else if (effectiveAction == PointerAction.RELEASED) {
            toolAction = workflow.release();
        } else if (effectiveAction == PointerAction.MOVED) {
            toolAction = workflow.hover();
        } else {
            throw new IllegalStateException("Unsupported " + workflowName + " pointer action: " + effectiveAction);
        }
        if (toolAction == null) {
            throw new IllegalStateException("Unsupported " + workflowName + " pointer action: " + effectiveAction);
        }
        toolAction.apply(input);
    }

    private static PointerAction previewAction(PointerAction action) {
        return action == null ? PointerAction.MOVED : action;
    }

}
