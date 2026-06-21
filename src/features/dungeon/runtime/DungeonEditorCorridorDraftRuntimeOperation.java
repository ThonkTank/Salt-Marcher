package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final PointerToolUseCase createCorridor;
    private final PointerToolUseCase deleteCorridor;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorApplyToolUseCase toolUseCase = new DungeonEditorApplyToolUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
        createCorridor = toolUseCase.corridorWorkflow(DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
        deleteCorridor = toolUseCase.corridorWorkflow(DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
    }

    static @Nullable DungeonEditorTool corridorTool(String toolKey) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        return tool == DungeonEditorTool.CORRIDOR_CREATE || tool == DungeonEditorTool.CORRIDOR_DELETE ? tool : null;
    }

    void apply(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        if (corridorTool == DungeonEditorTool.CORRIDOR_CREATE) {
            applyCreate(action, input);
        } else if (corridorTool == DungeonEditorTool.CORRIDOR_DELETE) {
            applyDelete(action, input);
        } else {
            throw new IllegalArgumentException("Unsupported corridor draft tool: " + corridorTool);
        }
    }

    private void applyCreate(PointerAction action, DungeonEditorMainViewInput input) {
        applyWorkflow(action, input, createCorridor, "corridor create");
    }

    private void applyDelete(PointerAction action, DungeonEditorMainViewInput input) {
        applyWorkflow(action, input, deleteCorridor, "corridor delete");
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
        } else if (effectiveAction == PointerAction.MOVED) {
            toolAction = workflow.hover();
        } else if (effectiveAction == PointerAction.DRAGGED || effectiveAction == PointerAction.RELEASED) {
            return;
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
