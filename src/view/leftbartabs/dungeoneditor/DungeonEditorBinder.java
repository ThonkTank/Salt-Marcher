package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
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
        DungeonEditorIntentHandler intentHandler = new DungeonEditorIntentHandler(contributionModel);
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

    private static DungeonEditorSessionCommand toCommand(DungeonEditorPublishedEvent event) {
        if (event == null) {
            return new DungeonEditorSessionCommand(
                    DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                    null,
                    "",
                    DungeonEditorSessionValues.ViewMode.GRID,
                    DungeonEditorSessionValues.Tool.SELECT,
                    0,
                    DungeonEditorSessionValues.OverlaySettings.defaults(),
                    DungeonEditorSessionCommand.MainViewInput.empty(),
                    DungeonEditorSessionCommand.RoomNarrationInput.empty());
        }
        DungeonEditorPublishedEvent safeEvent = event;
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.valueOf(safeEvent.kind().name()),
                toMapId(safeEvent.mapId()),
                safeEvent.mapName(),
                toViewMode(safeEvent.viewMode()),
                toTool(safeEvent.selectedTool()),
                safeEvent.projectionLevelDelta(),
                toOverlaySettings(safeEvent.overlaySettings()),
                toMainViewInput(safeEvent.mainViewInput()),
                toRoomNarrationInput(safeEvent.roomNarration()));
    }

    private static DungeonEditorSessionValues.ViewMode toViewMode(DungeonEditorPublishedEvent.ViewMode viewMode) {
        return viewMode == DungeonEditorPublishedEvent.ViewMode.GRAPH
                ? DungeonEditorSessionValues.ViewMode.GRAPH
                : DungeonEditorSessionValues.ViewMode.GRID;
    }

    private static DungeonEditorSessionValues.Tool toTool(DungeonEditorPublishedEvent.Tool tool) {
        return tool == null ? DungeonEditorSessionValues.Tool.SELECT : DungeonEditorSessionValues.Tool.valueOf(tool.name());
    }

    private static DungeonEditorSessionValues.OverlaySettings toOverlaySettings(
            DungeonEditorPublishedEvent.OverlaySettings overlaySettings
    ) {
        DungeonEditorPublishedEvent.OverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorPublishedEvent.OverlaySettings.defaults()
                : overlaySettings;
        return new DungeonEditorSessionValues.OverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonEditorSessionCommand.MainViewInput toMainViewInput(
            DungeonEditorPublishedEvent.MainViewInput mainViewInput
    ) {
        DungeonEditorPublishedEvent.MainViewInput safeInput = mainViewInput == null
                ? DungeonEditorPublishedEvent.MainViewInput.empty()
                : mainViewInput;
        return new DungeonEditorSessionCommand.MainViewInput(
                DungeonEditorSessionCommand.MainViewInputSource.valueOf(safeInput.source().name()),
                safeInput.canvasX(),
                safeInput.canvasY(),
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef(),
                safeInput.levelDelta());
    }

    private static DungeonEditorSessionCommand.RoomNarrationInput toRoomNarrationInput(
            DungeonEditorPublishedEvent.RoomNarrationInput roomNarration
    ) {
        DungeonEditorPublishedEvent.RoomNarrationInput safeNarration = roomNarration == null
                ? DungeonEditorPublishedEvent.RoomNarrationInput.empty()
                : roomNarration;
        return new DungeonEditorSessionCommand.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                safeNarration.exits().stream().map(DungeonEditorBinder::toRoomExit).toList());
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration toRoomExit(
            DungeonEditorPublishedEvent.RoomExitNarration exit
    ) {
        DungeonEditorPublishedEvent.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorPublishedEvent.RoomExitNarration("", DungeonEditorPublishedEvent.CellRef.empty(), "", "")
                : exit;
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorWorkspaceValues.Cell(
                        safeExit.cell().q(),
                        safeExit.cell().r(),
                        safeExit.cell().level()),
                safeExit.direction(),
                safeExit.description());
    }

    private static DungeonEditorWorkspaceValues.MapId toMapId(long mapId) {
        return mapId <= 0L ? null : new DungeonEditorWorkspaceValues.MapId(mapId);
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
