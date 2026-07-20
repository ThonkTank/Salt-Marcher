package features.dungeon.application.editor;

import java.util.List;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;

final class DungeonEditorRuntimeInputTranslator {

    private DungeonEditorRuntimeInputTranslator() {
    }

    static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, DungeonEditorRuntimePointerTarget.empty())
                : sample;
        return buildMainViewInput(
                safeSample,
                wallSingleClickMode,
                false,
                transitionDestination);
    }

    static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            boolean doorDeleteSelected,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, DungeonEditorRuntimePointerTarget.empty())
                : sample;
        return buildMainViewInput(
                safeSample,
                wallSingleClickMode,
                doorDeleteSelected,
                transitionDestination);
    }

    private static DungeonEditorMainViewInput buildMainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            boolean doorDeleteSelected,
            TransitionDestination transitionDestination
    ) {
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return new DungeonEditorMainViewInput(
                sample.sceneX(),
                sample.sceneY(),
                sample.primaryButtonDown(),
                sample.secondaryButtonDown(),
                wallSingleClickMode,
                doorDeleteSelected,
                sample.target(),
                safeDestination);
    }

    static List<DungeonAuthoredApplicationService.RoomNarrationExitInput> exitInputs(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return safeNarration.exits().stream()
                .map(DungeonEditorRuntimeInputTranslator::exitInput)
                .toList();
    }

    private static DungeonAuthoredApplicationService.RoomNarrationExitInput exitInput(ExitNarration exit) {
        return new DungeonAuthoredApplicationService.RoomNarrationExitInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }
}
