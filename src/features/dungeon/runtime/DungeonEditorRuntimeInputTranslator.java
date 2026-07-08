package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase.ExitInput;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

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

    static DungeonEditorSessionValues.Tool tool(DungeonEditorTool tool) {
        return DungeonEditorSessionValues.Tool.valueOf(
                (tool == null ? DungeonEditorTool.SELECT : tool).name());
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

    static List<ExitInput> exitInputs(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return safeNarration.exits().stream()
                .map(DungeonEditorRuntimeInputTranslator::exitInput)
                .toList();
    }

    private static ExitInput exitInput(ExitNarration exit) {
        return new ExitInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }
}
