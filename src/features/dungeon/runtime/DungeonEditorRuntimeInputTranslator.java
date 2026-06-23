package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase.ExitInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.RoomNarration;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorRuntimeInputTranslator {

    private DungeonEditorRuntimeInputTranslator() {
    }

    static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return DungeonEditorPointerInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    static DungeonEditorMainViewInput mainViewInput(
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return DungeonEditorPointerInputTranslator.mainViewInput(
                toolKey,
                sample,
                wallSingleClickMode,
                transitionDestination);
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
