package features.worldplanner.adapter.javafx;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import features.creatures.api.CreatureCatalogModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.api.AddWorldFactionNpcCommand;
import features.worldplanner.api.AddWorldLocationEncounterTableCommand;
import features.worldplanner.api.AddWorldLocationFactionCommand;
import features.worldplanner.api.CreateWorldFactionCommand;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.SetWorldFactionInventoryLimitCommand;
import features.worldplanner.api.SetWorldNpcLifecycleStatusCommand;
import features.worldplanner.api.UpdateWorldNpcNotesCommand;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerEncounterSink;
import platform.ui.searchfilter.SearchFilterControlsView;
import platform.ui.searchfilter.SearchFilterControlsViewInputEvent;

final class WorldPlannerBinder {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;

    private final WorldPlannerApplicationService worldPlanner;
    private final @Nullable WorldPlannerEncounterSink encounter;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final @Nullable CreatureCatalogModel creatureCatalog;
    private final @Nullable EncounterTableCatalogModel encounterTableCatalog;
    private final InspectorSink inspector;

    WorldPlannerBinder(
            WorldPlannerApplicationService worldPlanner,
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerSnapshotModel snapshotModel,
            @Nullable CreatureCatalogModel creatureCatalog,
            @Nullable EncounterTableCatalogModel encounterTableCatalog,
            InspectorSink inspector
    ) {
        this.worldPlanner = Objects.requireNonNull(worldPlanner, "worldPlanner");
        this.encounter = encounter;
        this.snapshotModel = Objects.requireNonNull(snapshotModel, "snapshotModel");
        this.creatureCatalog = creatureCatalog;
        this.encounterTableCatalog = encounterTableCatalog;
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    ShellBinding bind() {
        WorldPlannerViewModel viewModel = new WorldPlannerViewModel(encounter != null);
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

        controlsView.bind(viewModel);
        viewModel.bindSearchFilters(searchFilterView);
        npcMainView.bind(viewModel);
        factionMainView.bind(viewModel);
        locationMainView.bind(viewModel);
        sourceMainView.bind(viewModel);
        mainView.bind(viewModel);
        stateView.bind(viewModel);
        viewModel.onControlsInput(controlsView, event ->
                viewModel.consumeControls(event, worldPlanner::refresh, () -> openDetails(viewModel)));
        searchFilterView.onViewInputEvent(event -> consumeSearch(viewModel, event));
        npcMainView.onViewInputEvent(event -> {
            viewModel.selectNpc(event.selectedNpcIndex());
            openDetails(viewModel);
        });
        factionMainView.onViewInputEvent(event -> {
            viewModel.selectFaction(event.selectedFactionIndex());
            openDetails(viewModel);
        });
        locationMainView.onViewInputEvent(event -> {
            viewModel.selectLocation(event.selectedLocationIndex());
            openDetails(viewModel);
        });
        stateView.onViewInputEvent(event -> consumeState(worldPlanner, encounter, viewModel, event));

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
        viewModel.activateRoot(worldPlanner::refresh, () -> openDetails(viewModel));
        return new Binding(ShellControls.stack(controlsView, searchFilterView), mainView, stateView);
    }

    private void consumeSearch(
            WorldPlannerViewModel viewModel,
            SearchFilterControlsViewInputEvent event
    ) {
        SearchFilterControlsViewInputEvent safeEvent = Objects.requireNonNull(event, "event");
        viewModel.applySearchFilters(safeEvent.searchQuery(), selectedFiltersByGroup(safeEvent));
        openDetails(viewModel);
    }

    private void consumeState(
            WorldPlannerApplicationService worldPlanner,
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerViewModel viewModel,
            StateInput event
    ) {
        StateInput safeEvent = Objects.requireNonNull(event, "event");
        ActionSnapshot actions = safeEvent.actions();
        if (safeEvent.activeModuleIndex() == NPCS) {
            consumeNpcState(worldPlanner, encounter, viewModel, safeEvent.npc(), actions);
        } else if (safeEvent.activeModuleIndex() == FACTIONS) {
            consumeFactionState(worldPlanner, viewModel, safeEvent.faction(), actions);
        } else if (safeEvent.activeModuleIndex() == LOCATIONS) {
            consumeLocationState(worldPlanner, viewModel, safeEvent.location(), actions);
        }
        openDetails(viewModel);
    }

    private void consumeNpcState(
            WorldPlannerApplicationService worldPlanner,
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerViewModel viewModel,
            NpcSnapshot snapshot,
            ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            worldPlanner.createNpc(new CreateWorldNpcCommand(
                    snapshot.displayName(),
                    viewModel.npcStatblockChoiceId(snapshot.statblockChoiceIndex()),
                    snapshot.appearanceNotes(),
                    snapshot.behaviorNotes(),
                    snapshot.historyNotes(),
                    snapshot.generalNotes()));
        } else if (actions.saveNotesRequested()) {
            worldPlanner.updateNpcNotes(new UpdateWorldNpcNotesCommand(
                    viewModel.selectedNpcId(),
                    snapshot.appearanceNotes(),
                    snapshot.behaviorNotes(),
                    snapshot.historyNotes(),
                    snapshot.generalNotes()));
        } else if (actions.defeatRequested()) {
            worldPlanner.setNpcLifecycleStatus(
                    SetWorldNpcLifecycleStatusCommand.defeated(viewModel.selectedNpcId()));
        } else if (actions.reactivateRequested()) {
            worldPlanner.setNpcLifecycleStatus(
                    SetWorldNpcLifecycleStatusCommand.active(viewModel.selectedNpcId()));
        } else if (actions.addToEncounterRequested()) {
            addNpcToEncounter(encounter, viewModel);
        }
    }

    private void consumeFactionState(
            WorldPlannerApplicationService worldPlanner,
            WorldPlannerViewModel viewModel,
            FactionSnapshot snapshot,
            ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            worldPlanner.createFaction(new CreateWorldFactionCommand(
                    snapshot.displayName(),
                    "",
                    viewModel.factionPrimaryTableChoiceId(snapshot.primaryEncounterTableChoiceIndex())));
        } else if (actions.addNpcRequested()) {
            worldPlanner.addFactionNpc(new AddWorldFactionNpcCommand(
                    viewModel.selectedFactionId(),
                    viewModel.factionNpcChoiceId(snapshot.npcChoiceIndex())));
        } else if (actions.setInventoryLimitRequested()) {
            worldPlanner.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                    viewModel.selectedFactionId(),
                    viewModel.factionStatblockChoiceId(snapshot.inventoryStatblockChoiceIndex()),
                    snapshot.finiteInventory(),
                    parseQuantity(snapshot.inventoryQuantityText())));
        }
    }

    private void consumeLocationState(
            WorldPlannerApplicationService worldPlanner,
            WorldPlannerViewModel viewModel,
            LocationSnapshot snapshot,
            ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            worldPlanner.createLocation(new CreateWorldLocationCommand(snapshot.displayName(), ""));
        } else if (actions.linkFactionRequested()) {
            worldPlanner.addLocationFaction(new AddWorldLocationFactionCommand(
                    viewModel.selectedLocationId(),
                    viewModel.locationFactionChoiceId(snapshot.factionChoiceIndex())));
        } else if (actions.linkTableRequested()) {
            worldPlanner.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(
                    viewModel.selectedLocationId(),
                    viewModel.locationTableChoiceId(snapshot.encounterTableChoiceIndex())));
        }
    }

    private static void addNpcToEncounter(
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerViewModel viewModel
    ) {
        long statblockId = viewModel.selectedNpcStatblockId();
        long npcId = viewModel.selectedNpcId();
        if (encounter != null && statblockId > 0L && npcId > 0L) {
            encounter.addNpc(statblockId, npcId);
        }
    }

    private void openDetails(WorldPlannerViewModel viewModel) {
        String key = viewModel.detailKey();
        if (key.isBlank()) {
            inspector.clear();
            return;
        }
        DetailProjection projection = viewModel.detailProjection();
        inspector.push(new InspectorEntrySpec(
                viewModel.detailTitle(),
                key,
                () -> detailContent(projection),
                null));
    }

    private static Node detailContent(DetailProjection projection) {
        WorldPlannerDetailView view = new WorldPlannerDetailView();
        view.render(projection);
        return view;
    }

    private static Map<String, List<String>> selectedFiltersByGroup(SearchFilterControlsViewInputEvent event) {
        Map<String, List<String>> filters = new java.util.HashMap<>();
        for (SearchFilterControlsViewInputEvent.SelectedFilter selected : event.selectedFilters()) {
            filters.computeIfAbsent(selected.groupKey(), ignored -> new ArrayList<>()).add(selected.optionKey());
        }
        return filters;
    }

    private static int parseQuantity(String value) {
        try {
            return Math.max(0, Integer.parseInt(value == null ? "" : value.trim()));
        } catch (NumberFormatException exception) {
            return 0;
        }
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
