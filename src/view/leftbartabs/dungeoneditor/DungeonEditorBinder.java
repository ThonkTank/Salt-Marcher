package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonEditorApplicationService editor = runtimeContext.services().require(DungeonEditorApplicationService.class);
        DungeonEditorModel editorModel = editor.loadEditor(new LoadDungeonEditorQuery(null));
        DungeonEditorContributionModel contributionModel = new DungeonEditorContributionModel();
        DungeonEditorControlsContentModel controlsContentModel = new DungeonEditorControlsContentModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorIntentHandler intentHandler =
                new DungeonEditorIntentHandler(contributionModel, mapContentModel.mapCanvasContentModel(), editor);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(controlsContentModel);
        state.bind(contributionModel);
        main.onViewInputEvent(intentHandler::consume);
        controls.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
        contributionModel.controlsProjectionProperty().addListener((ignored, before, after) ->
                controlsContentModel.apply(after));
        controlsContentModel.apply(contributionModel.controlsProjectionProperty().get());
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
