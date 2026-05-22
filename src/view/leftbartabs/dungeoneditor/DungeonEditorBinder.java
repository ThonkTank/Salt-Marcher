package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonEditorApplicationService;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonEditorApplicationService editor = runtimeContext.services().require(DungeonEditorApplicationService.class);
        DungeonEditorControlsModel controlsModel = runtimeContext.services().require(DungeonEditorControlsModel.class);
        DungeonEditorMapSurfaceModel mapSurfaceModel = runtimeContext.services().require(DungeonEditorMapSurfaceModel.class);
        DungeonEditorStateModel stateModel = runtimeContext.services().require(DungeonEditorStateModel.class);
        DungeonEditorControlsContentModel controlsContentModel = new DungeonEditorControlsContentModel();
        DungeonEditorStateContentModel stateContentModel = new DungeonEditorStateContentModel();
        DungeonEditorContributionModel contributionModel = new DungeonEditorContributionModel(stateContentModel);
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorIntentHandler intentHandler =
                new DungeonEditorIntentHandler(
                        contributionModel,
                        controlsContentModel,
                        stateContentModel,
                        mapContentModel,
                        editor);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(controlsContentModel);
        state.bind(stateContentModel);
        main.onViewInputEvent(intentHandler::consume);
        controls.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
        contributionModel.bindControlsContentModel(controlsContentModel);
        controlsModel.subscribe(snapshot -> applyControls(snapshot, contributionModel));
        mapSurfaceModel.subscribe(snapshot -> applyMapSurface(snapshot, mapContentModel));
        stateModel.subscribe(snapshot -> applyState(snapshot, contributionModel));
        applyControls(controlsModel.current(), contributionModel);
        applyMapSurface(mapSurfaceModel.current(), mapContentModel);
        applyState(stateModel.current(), contributionModel);
        return new Binding(controls, main, state);
    }

    private static void applyControls(
            DungeonEditorControlsSnapshot snapshot,
            DungeonEditorContributionModel contributionModel
    ) {
        contributionModel.applyControls(snapshot);
    }

    private static void applyMapSurface(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel
    ) {
        mapContentModel.applyEditorSurfaceSnapshot(snapshot);
    }

    private static void applyState(
            DungeonEditorStateSnapshot snapshot,
            DungeonEditorContributionModel contributionModel
    ) {
        contributionModel.applyState(snapshot);
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
