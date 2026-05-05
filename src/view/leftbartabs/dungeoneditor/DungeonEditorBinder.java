package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonEditorApplicationService editor = runtimeContext.services().require(DungeonEditorApplicationService.class);
        DungeonEditorModel editorModel = editor.loadEditor(new LoadDungeonEditorQuery(null));
        DungeonEditorContributionModel contributionModel = new DungeonEditorContributionModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorIntentHandler intentHandler = new DungeonEditorIntentHandler();
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(contributionModel);
        state.bind(contributionModel);
        main.onViewInputEvent(intentHandler::consume);
        controls.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
        intentHandler.onPublishedEventRequested(event -> editor.applyEditorSession(toCommand(event)));
        editorModel.subscribe(snapshot -> applySnapshot(snapshot, contributionModel, mapContentModel));
        applySnapshot(editorModel.current(), contributionModel, mapContentModel);
        return new Binding(controls, main, state);
    }

    private static void applySnapshot(
            src.domain.dungeoneditor.published.DungeonEditorSnapshot snapshot,
            DungeonEditorContributionModel contributionModel,
            DungeonMapContentModel mapContentModel
    ) {
        contributionModel.apply(snapshot);
        mapContentModel.applyEditorSnapshot(snapshot);
    }

    private static ApplyDungeonEditorSessionCommand toCommand(DungeonEditorPublishedEvent event) {
        if (event == null) {
            return new ApplyDungeonEditorSessionCommand(
                    ApplyDungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                    null,
                    "",
                    DungeonEditorViewMode.GRID,
                    DungeonEditorTool.SELECT,
                    0,
                    DungeonEditorOverlaySettings.defaults(),
                    ApplyDungeonEditorSessionCommand.MainViewInput.empty(),
                    ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty());
        }
        DungeonEditorPublishedEvent safeEvent = event;
        return new ApplyDungeonEditorSessionCommand(
                ApplyDungeonEditorSessionCommand.Action.valueOf(safeEvent.kind().name()),
                toMapId(safeEvent.mapId()),
                safeEvent.mapName(),
                toPublishedViewMode(safeEvent.viewMode()),
                toPublishedTool(safeEvent.selectedTool()),
                safeEvent.projectionLevelDelta(),
                toOverlaySettings(safeEvent.overlaySettings()),
                toMainViewInput(safeEvent.mainViewInput()),
                toRoomNarrationInput(safeEvent.roomNarration()));
    }

    private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorPublishedEvent.ViewMode viewMode) {
        return viewMode == DungeonEditorPublishedEvent.ViewMode.GRAPH
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    private static DungeonEditorTool toPublishedTool(DungeonEditorPublishedEvent.Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }

    private static DungeonEditorOverlaySettings toOverlaySettings(
            DungeonEditorPublishedEvent.OverlaySettings overlaySettings
    ) {
        DungeonEditorPublishedEvent.OverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorPublishedEvent.OverlaySettings.defaults()
                : overlaySettings;
        return new DungeonEditorOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static ApplyDungeonEditorSessionCommand.MainViewInput toMainViewInput(
            DungeonEditorPublishedEvent.MainViewInput mainViewInput
    ) {
        DungeonEditorPublishedEvent.MainViewInput safeInput = mainViewInput == null
                ? DungeonEditorPublishedEvent.MainViewInput.empty()
                : mainViewInput;
        return new ApplyDungeonEditorSessionCommand.MainViewInput(
                ApplyDungeonEditorSessionCommand.MainViewInput.Source.valueOf(safeInput.source().name()),
                safeInput.canvasX(),
                safeInput.canvasY(),
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef(),
                safeInput.levelDelta());
    }

    private static ApplyDungeonEditorSessionCommand.RoomNarrationInput toRoomNarrationInput(
            DungeonEditorPublishedEvent.RoomNarrationInput roomNarration
    ) {
        DungeonEditorPublishedEvent.RoomNarrationInput safeNarration = roomNarration == null
                ? DungeonEditorPublishedEvent.RoomNarrationInput.empty()
                : roomNarration;
        return new ApplyDungeonEditorSessionCommand.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                safeNarration.exits().stream().map(DungeonEditorBinder::toPublishedExit).toList());
    }

    private static DungeonEditorInspectorSnapshot.RoomExitNarration toPublishedExit(
            DungeonEditorPublishedEvent.RoomExitNarration exit
    ) {
        DungeonEditorPublishedEvent.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorPublishedEvent.RoomExitNarration("", DungeonEditorPublishedEvent.CellRef.empty(), "", "")
                : exit;
        return new DungeonEditorInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorCell(
                        safeExit.cell().q(),
                        safeExit.cell().r(),
                        safeExit.cell().level()),
                safeExit.direction(),
                safeExit.description());
    }

    private static @Nullable DungeonEditorMapId toMapId(long mapId) {
        return mapId <= 0L ? null : new DungeonEditorMapId(mapId);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon-Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
