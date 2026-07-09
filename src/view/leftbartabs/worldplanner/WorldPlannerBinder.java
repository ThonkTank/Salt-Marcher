package src.view.leftbartabs.worldplanner;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorEntrySpec;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsView;

final class WorldPlannerBinder {

    private final ShellRuntimeContext runtimeContext;

    WorldPlannerBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        ServiceRegistry services = runtimeContext.services();
        WorldPlannerApplicationService worldPlanner = services.require(WorldPlannerApplicationService.class);
        EncounterApplicationService encounter = services.find(EncounterApplicationService.class).orElse(null);
        WorldPlannerSnapshotModel snapshotModel = services.require(WorldPlannerSnapshotModel.class);
        CreatureCatalogModel creatureCatalog = services.find(CreatureCatalogModel.class).orElse(null);
        EncounterTableCatalogModel encounterTableCatalog =
                services.find(EncounterTableCatalogModel.class).orElse(null);

        WorldPlannerViewModel viewModel = new WorldPlannerViewModel(encounter != null);
        WorldPlannerIntentHandler intentHandler = new WorldPlannerIntentHandler(
                worldPlanner,
                encounter,
                viewModel,
                () -> openDetails(viewModel));
        WorldPlannerControlsView controlsView = new WorldPlannerControlsView();
        SearchFilterControlsView searchFilterView = new SearchFilterControlsView();
        WorldPlannerNpcMainView npcMainView = new WorldPlannerNpcMainView();
        WorldPlannerFactionMainView factionMainView = new WorldPlannerFactionMainView();
        WorldPlannerLocationMainView locationMainView = new WorldPlannerLocationMainView();
        WorldPlannerSourceMainView sourceMainView = new WorldPlannerSourceMainView();
        WorldPlannerMainView mainView = new WorldPlannerMainView(
                npcMainView,
                factionMainView,
                locationMainView,
                sourceMainView);
        WorldPlannerStateView stateView = new WorldPlannerStateView();

        viewModel.bindControls(controlsView);
        viewModel.bindSearchFilters(searchFilterView);
        viewModel.bindNpcMain(npcMainView);
        viewModel.bindFactionMain(factionMainView);
        viewModel.bindLocationMain(locationMainView);
        viewModel.bindSourceMain(sourceMainView);
        viewModel.bindMain(mainView);
        viewModel.bindState(stateView);
        viewModel.onControlsInput(controlsView, intentHandler::consume);
        searchFilterView.onViewInputEvent(intentHandler::consume);
        npcMainView.onViewInputEvent(intentHandler::consume);
        factionMainView.onViewInputEvent(intentHandler::consume);
        locationMainView.onViewInputEvent(intentHandler::consume);
        stateView.onViewInputEvent(intentHandler::consume);

        snapshotModel.subscribe(viewModel::applySnapshot);
        if (creatureCatalog != null) {
            creatureCatalog.subscribe(viewModel::applyCreatureCatalog);
            viewModel.applyCreatureCatalog(creatureCatalog.current());
        }
        if (encounterTableCatalog != null) {
            encounterTableCatalog.subscribe(viewModel::applyEncounterTables);
            viewModel.applyEncounterTables(encounterTableCatalog.current());
        }
        viewModel.applySnapshot(snapshotModel.current());
        intentHandler.activateRoot();
        return new Binding(ShellControls.stack(controlsView, searchFilterView), mainView, stateView);
    }

    private void openDetails(WorldPlannerViewModel viewModel) {
        String key = viewModel.detailKey();
        if (key.isBlank()) {
            runtimeContext.inspector().clear();
            return;
        }
        String title = viewModel.detailTitle();
        WorldPlannerDetailContentModel.Projection projection = viewModel.detailProjection();
        runtimeContext.inspector().push(new InspectorEntrySpec(
                title,
                key,
                () -> detailContent(projection),
                null));
    }

    private static Node detailContent(WorldPlannerDetailContentModel.Projection projection) {
        WorldPlannerDetailView view = new WorldPlannerDetailView();
        view.bind(new WorldPlannerDetailContentModel(projection));
        return view;
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "World Planner";
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
