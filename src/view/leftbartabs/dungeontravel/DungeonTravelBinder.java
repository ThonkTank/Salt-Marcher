package src.view.leftbartabs.dungeontravel;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonTravelBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonTravelBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonTravelRuntimeApplicationService travel = runtimeContext.services().require(DungeonTravelRuntimeApplicationService.class);
        DungeonMapCatalogModel mapCatalogModel = runtimeContext.services().require(DungeonMapCatalogModel.class);
        TravelDungeonModel travelModel = runtimeContext.services().require(TravelDungeonModel.class);
        DungeonTravelContributionModel contributionModel = new DungeonTravelContributionModel();
        DungeonTravelControlsContentModel controlsContentModel = new DungeonTravelControlsContentModel();
        CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
        DungeonTravelStateContentModel stateContentModel = new DungeonTravelStateContentModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Travel workspace", false);
        DungeonTravelIntentHandler intentHandler =
                new DungeonTravelIntentHandler(
                        contributionModel,
                        mapCatalogContentModel,
                        mapContentModel,
                        travel);
        DungeonTravelControlsView controls = new DungeonTravelControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonTravelStateView state = new DungeonTravelStateView();
        main.bind(mapContentModel);
        mapCatalog.bind(mapCatalogContentModel);
        contributionModel.bindControlsContentModel(controlsContentModel);
        contributionModel.bindMapCatalogContentModel(mapCatalogContentModel);
        contributionModel.bindStateContentModel(stateContentModel);
        controls.bind(controlsContentModel);
        state.bind(stateContentModel);
        controls.onViewInputEvent(intentHandler::consume);
        mapCatalog.onViewInputEvent(intentHandler::consume);
        main.onViewInputEvent(intentHandler::consume);
        mapContentModel.zoomProperty().addListener((ignored, before, after) ->
                controlsContentModel.showZoom(after.doubleValue()));
        state.onViewInputEvent(intentHandler::consume);
        travelModel.subscribe(snapshot -> {
            applySnapshot(snapshot, contributionModel, mapContentModel);
            contributionModel.applyMapCatalog(mapCatalogModel.current(), selectedMapId(snapshot));
        });
        mapCatalogModel.subscribe(catalog -> contributionModel.applyMapCatalog(
                catalog,
                selectedMapId(travelModel.current())));
        applySnapshot(travelModel.current(), contributionModel, mapContentModel);
        contributionModel.applyMapCatalog(mapCatalogModel.current(), selectedMapId(travelModel.current()));
        controlsContentModel.showZoom(mapContentModel.currentZoom());
        return new Binding(ShellControls.stack(mapCatalog, controls), main, state);
    }

    private static void applySnapshot(
            TravelDungeonSnapshot snapshot,
            DungeonTravelContributionModel contributionModel,
            DungeonMapContentModel mapContentModel
    ) {
        contributionModel.apply(snapshot);
        mapContentModel.applyTravelSnapshot(snapshot);
    }

    private static long selectedMapId(TravelDungeonSnapshot snapshot) {
        if (snapshot == null || snapshot.travelSurface() == null || snapshot.travelSurface().position() == null) {
            return 0L;
        }
        return snapshot.travelSurface().position().mapId().value();
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
