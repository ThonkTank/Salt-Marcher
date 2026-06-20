package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorCorridorDraftRuntimeOperation {
    private final ApplyDungeonEditorCreateCorridorUseCase createCorridor;
    private final ApplyDungeonEditorDeleteCorridorUseCase deleteCorridor;

    DungeonEditorCorridorDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        createCorridor = new ApplyDungeonEditorCreateCorridorUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
        deleteCorridor = new ApplyDungeonEditorDeleteCorridorUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
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
        MainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
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

    private void applyCreate(PointerAction action, MainViewInput input) {
        PointerAction effectiveAction = previewAction(action);
        if (effectiveAction == PointerAction.PRESSED) {
            createCorridor.press(input);
            return;
        } else if (effectiveAction == PointerAction.MOVED) {
            createCorridor.hover(input);
            return;
        } else if (effectiveAction == PointerAction.DRAGGED || effectiveAction == PointerAction.RELEASED) {
            // Corridor create currently supports press and hover only.
            return;
        }
        throw new IllegalStateException("Unsupported corridor create pointer action: " + effectiveAction);
    }

    private void applyDelete(PointerAction action, MainViewInput input) {
        PointerAction effectiveAction = previewAction(action);
        if (effectiveAction == PointerAction.PRESSED) {
            deleteCorridor.press(input);
            return;
        } else if (effectiveAction == PointerAction.MOVED) {
            deleteCorridor.hover(input);
            return;
        } else if (effectiveAction == PointerAction.DRAGGED || effectiveAction == PointerAction.RELEASED) {
            // Corridor delete currently supports press and hover only.
            return;
        }
        throw new IllegalStateException("Unsupported corridor delete pointer action: " + effectiveAction);
    }

    private static PointerAction previewAction(PointerAction action) {
        return action == null ? PointerAction.MOVED : action;
    }
}
