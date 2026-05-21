package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonTravelRuntimeApplicationService travel = runtimeContext.services().require(DungeonTravelRuntimeApplicationService.class);
        TravelDungeonModel travelModel = runtimeContext.services().require(TravelDungeonModel.class);
        DungeonTravelContributionModel contributionModel = new DungeonTravelContributionModel();
        DungeonTravelControlsContentModel controlsContentModel = new DungeonTravelControlsContentModel();
        DungeonTravelStateContentModel stateContentModel = new DungeonTravelStateContentModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler =
                new DungeonTravelIntentHandler(contributionModel, mapContentModel, travel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.bind(mapContentModel);
        controlsContentModel.bindTo(contributionModel);
        stateContentModel.bindTo(contributionModel);
        controls.bind(controlsContentModel);
        state.bind(stateContentModel);
        controls.onTravelControlsInputEvent(intentHandler::consume);
        main.onViewInputEvent(intentHandler::consume);
        mapContentModel.zoomProperty().addListener((ignored, before, after) ->
                controlsContentModel.showZoom(after.doubleValue()));
        state.onViewInputEvent(intentHandler::consume);
        travelModel.subscribe(snapshot -> applySnapshot(snapshot, contributionModel, mapContentModel));
        applySnapshot(travelModel.current(), contributionModel, mapContentModel);
        controlsContentModel.showZoom(mapContentModel.currentZoom());
        return new Binding(controls, main, state);
    }

    private static void applySnapshot(
            TravelDungeonSnapshot snapshot,
            DungeonTravelContributionModel contributionModel,
            DungeonMapContentModel mapContentModel
    ) {
        contributionModel.apply(snapshot);
        mapContentModel.applyTravelSnapshot(snapshot);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon-Reise";
        }

        @Override
        public String navigationLabel() {
            return "Reise";
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
