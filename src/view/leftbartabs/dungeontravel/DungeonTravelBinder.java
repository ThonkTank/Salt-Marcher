package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.LoadTravelDungeonQuery;
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
        TravelDungeonModel travelModel = travel.loadDungeonTravel(new LoadTravelDungeonQuery());
        DungeonTravelContributionModel contributionModel = new DungeonTravelContributionModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler =
                new DungeonTravelIntentHandler(contributionModel, mapContentModel.mapCanvasContentModel(), travel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.bind(mapContentModel);
        controls.bind(contributionModel);
        state.bind(contributionModel);
        controls.onTravelControlsInputEvent(intentHandler::consume);
        main.onViewInputEvent(intentHandler::consume);
        mapContentModel.mapCanvasContentModel().zoomProperty().addListener((ignored, before, after) ->
                controls.showZoom(after.doubleValue()));
        state.onViewInputEvent(intentHandler::consume);
        travelModel.subscribe(snapshot -> applySnapshot(snapshot, contributionModel, mapContentModel));
        applySnapshot(travelModel.current(), contributionModel, mapContentModel);
        controls.showZoom(mapContentModel.mapCanvasContentModel().currentViewport().zoom());
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
