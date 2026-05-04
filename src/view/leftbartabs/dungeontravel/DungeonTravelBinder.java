package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.travel.TravelApplicationService;
import src.domain.travel.published.ApplyTravelDungeonSessionCommand;
import src.domain.travel.published.LoadTravelDungeonQuery;
import src.domain.travel.published.TravelDungeonModel;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        TravelApplicationService travel = runtimeContext.services().require(TravelApplicationService.class);
        TravelDungeonModel travelModel = travel.loadDungeonTravel(new LoadTravelDungeonQuery(null));
        DungeonTravelContributionModel contributionModel = new DungeonTravelContributionModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler = new DungeonTravelIntentHandler(contributionModel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        bindTravelRequests(travel, intentHandler);
        main.bind(mapContentModel);
        controls.bind(contributionModel);
        state.bind(contributionModel);
        controls.onViewInputEvent(intentHandler::consume);
        main.onViewportChanged(() -> controls.showZoom(main.zoom()));
        state.onViewInputEvent(intentHandler::consume);
        contributionModel.cameraResetSignalProperty().addListener((ignored, before, after) -> main.resetCamera());
        contributionModel.refreshSignalProperty().addListener((ignored, before, after) ->
                travel.applyDungeonTravelSession(refreshCommand()));
        travelModel.subscribe(snapshot -> applySnapshot(snapshot, contributionModel, mapContentModel));
        applySnapshot(travelModel.current(), contributionModel, mapContentModel);
        controls.showZoom(main.zoom());
        return new Binding(controls, main, state);
    }

    private static void bindTravelRequests(
            TravelApplicationService travel,
            DungeonTravelIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(actionEvent -> {
            travel.applyDungeonTravelSession(toCommand(actionEvent));
        });
    }

    private static void applySnapshot(
            TravelDungeonSnapshot snapshot,
            DungeonTravelContributionModel contributionModel,
            DungeonMapContentModel mapContentModel
    ) {
        contributionModel.apply(snapshot);
        mapContentModel.applyTravelSnapshot(snapshot);
    }

    private static ApplyTravelDungeonSessionCommand toCommand(DungeonTravelStatePublishedEvent event) {
        if (event == null) {
            return refreshCommand();
        }
        return switch (event.kind()) {
            case ACTION -> new ApplyTravelDungeonSessionCommand(
                    ApplyTravelDungeonSessionCommand.Action.ACTION,
                    event.actionId(),
                    0,
                    TravelOverlaySettings.defaults());
            case SET_PROJECTION_LEVEL -> new ApplyTravelDungeonSessionCommand(
                    ApplyTravelDungeonSessionCommand.Action.SET_PROJECTION_LEVEL,
                    "",
                    event.projectionLevel(),
                    TravelOverlaySettings.defaults());
            case SET_OVERLAY -> new ApplyTravelDungeonSessionCommand(
                    ApplyTravelDungeonSessionCommand.Action.SET_OVERLAY,
                    "",
                    0,
                    new TravelOverlaySettings(
                            event.overlayModeKey(),
                            event.overlayRange(),
                            event.overlayOpacity(),
                            event.overlayLevels()));
        };
    }

    private static ApplyTravelDungeonSessionCommand refreshCommand() {
        return new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                "",
                0,
                TravelOverlaySettings.defaults());
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
