package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeon.published.DungeonEditorModel;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.LoadDungeonEditorQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorModel editorModel = dungeon.loadEditor(new LoadDungeonEditorQuery(null));
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
        intentHandler.onPublishedEventRequested(event -> dungeon.applyEditorSession(toCommand(event)));
        editorModel.subscribe(snapshot -> applySnapshot(snapshot, contributionModel, mapContentModel));
        applySnapshot(editorModel.current(), contributionModel, mapContentModel);
        return new Binding(controls, main, state);
    }

    private static void applySnapshot(
            src.domain.dungeon.published.DungeonEditorSnapshot snapshot,
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
                    "GRID",
                    "Auswahl",
                    0,
                    DungeonOverlaySettings.defaults(),
                    ApplyDungeonEditorSessionCommand.MainViewInput.empty(),
                    ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty());
        }
        DungeonEditorPublishedEvent safeEvent = event;
        return new ApplyDungeonEditorSessionCommand(
                ApplyDungeonEditorSessionCommand.Action.valueOf(safeEvent.kind().name()),
                toMapId(safeEvent.mapId()),
                safeEvent.mapName(),
                safeEvent.viewModeKey(),
                safeEvent.selectedTool(),
                safeEvent.projectionLevelDelta(),
                toOverlaySettings(safeEvent.overlaySettings()),
                toMainViewInput(safeEvent.mainViewInput()),
                toRoomNarrationInput(safeEvent.roomNarration()));
    }

    private static DungeonOverlaySettings toOverlaySettings(
            DungeonEditorPublishedEvent.OverlaySettings overlaySettings
    ) {
        DungeonEditorPublishedEvent.OverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorPublishedEvent.OverlaySettings.defaults()
                : overlaySettings;
        return new DungeonOverlaySettings(
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

    private static DungeonInspectorSnapshot.RoomExitNarration toPublishedExit(
            DungeonEditorPublishedEvent.RoomExitNarration exit
    ) {
        DungeonEditorPublishedEvent.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorPublishedEvent.RoomExitNarration("", DungeonEditorPublishedEvent.CellRef.empty(), "", "")
                : exit;
        return new DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                new src.domain.dungeon.published.DungeonCellRef(
                        safeExit.cell().q(),
                        safeExit.cell().r(),
                        safeExit.cell().level()),
                safeExit.direction(),
                safeExit.description());
    }

    private static @Nullable DungeonMapId toMapId(long mapId) {
        return mapId <= 0L ? null : new DungeonMapId(mapId);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
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
