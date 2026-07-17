package features.dungeon.application.editor;

import java.util.List;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.DungeonEditorViewMode;

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

    static DungeonEditorSessionValues.ViewMode viewMode(DungeonEditorViewMode viewMode) {
        return viewMode == DungeonEditorViewMode.GRAPH
                ? DungeonEditorSessionValues.ViewMode.GRAPH
                : DungeonEditorSessionValues.ViewMode.GRID;
    }

    static DungeonEditorSessionValues.OverlaySettings overlaySettings(
            DungeonEditorOverlaySettings overlaySettings
    ) {
        DungeonEditorOverlaySettings safeSettings = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonEditorSessionValues.OverlaySettings(
                DungeonEditorSessionValues.OverlaySettings.Mode.valueOf(safeSettings.mode().name()),
                safeSettings.levelRange(),
                safeSettings.opacity(),
                safeSettings.selectedLevels());
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
