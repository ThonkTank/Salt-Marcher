package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.MoveDungeonEditorHandleUseCase.HandleMoveInput;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase.ExitInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.RoomNarration;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorRuntimeInputTranslator {

    private DungeonEditorRuntimeInputTranslator() {
    }

    static ToolWorkflowInput toolWorkflowInput(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return DungeonEditorPointerInputTranslator.toolWorkflowInput(
                action,
                toolKey,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    static MainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return DungeonEditorPointerInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    static HandleMoveInput handleMoveInput(HandleTarget handle, int q, int r) {
        return DungeonEditorHandleInputTranslator.handleMoveInput(handle, q, r);
    }

    static String toolName(String value) {
        return DungeonEditorRuntimeEnumTranslator.toolName(value);
    }

    static String viewModeName(String value) {
        return DungeonEditorRuntimeEnumTranslator.viewModeName(value);
    }

    static List<ExitInput> exitInputs(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return safeNarration.exits().stream()
                .map(DungeonEditorRuntimeInputTranslator::exitInput)
                .toList();
    }

    private static ExitInput exitInput(DungeonEditorRuntimeOperations.ExitNarration exit) {
        return new ExitInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }
}
