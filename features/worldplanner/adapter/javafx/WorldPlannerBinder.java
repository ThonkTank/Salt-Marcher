package features.worldplanner.adapter.javafx;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import features.creatures.api.CreatureCatalogModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerApi;
import features.worldplanner.api.AddWorldFactionNpcCommand;
import features.worldplanner.api.AddWorldLocationEncounterTableCommand;
import features.worldplanner.api.AddWorldLocationFactionCommand;
import features.worldplanner.api.CreateWorldFactionCommand;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.SetWorldFactionInventoryLimitCommand;
import features.worldplanner.api.SetWorldFactionDispositionCommand;
import features.worldplanner.api.SetWorldNpcLifecycleStatusCommand;
import features.worldplanner.api.SetWorldNpcDispositionModifierCommand;
import features.worldplanner.api.UpdateWorldNpcNotesCommand;
import features.worldplanner.api.UpdateWorldNpcCommand;
import features.worldplanner.api.DeleteWorldNpcCommand;
import features.worldplanner.api.UpdateWorldFactionCommand;
import features.worldplanner.api.RemoveWorldFactionNpcCommand;
import features.worldplanner.api.DeleteWorldFactionCommand;
import features.worldplanner.api.UpdateWorldLocationCommand;
import features.worldplanner.api.RemoveWorldLocationFactionCommand;
import features.worldplanner.api.RemoveWorldLocationEncounterTableCommand;
import features.worldplanner.api.DeleteWorldLocationCommand;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.api.WorldPlannerEncounterSink;
import platform.ui.searchfilter.SearchFilterControlsView;
import platform.ui.searchfilter.SearchFilterControlsViewInputEvent;

final class WorldPlannerBinder {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;

    private final WorldPlannerApi worldPlanner;
    private final @Nullable WorldPlannerEncounterSink encounter;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final @Nullable CreatureCatalogModel creatureCatalog;
    private final @Nullable EncounterTableCatalogModel encounterTableCatalog;
    private final InspectorSink inspector;
    private @Nullable InspectorSession activeInspector;
    private @Nullable PendingMutation pendingMutation;

    WorldPlannerBinder(
            WorldPlannerApi worldPlanner,
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

    Runnable subscribeToInspectorSnapshots() {
        return snapshotModel.subscribe(this::applyInspectorSnapshot);
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
        controlsView.bind(viewModel);
        viewModel.bindSearchFilters(searchFilterView);
        npcMainView.bind(viewModel);
        factionMainView.bind(viewModel);
        locationMainView.bind(viewModel);
        sourceMainView.bind(viewModel);
        mainView.bind(viewModel);
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
        return new Binding(ShellControls.stack(controlsView, searchFilterView), mainView);
    }

    void openNpc(long npcId) {
        WorldPlannerViewModel viewModel = inspectorViewModel();
        viewModel.activate(NPCS);
        var npcs = snapshotModel.current().npcs();
        for (int index = 0; index < npcs.size(); index++) {
            if (npcs.get(index).npcId() == npcId) {
                viewModel.selectNpc(index);
                openDetails(viewModel);
                return;
            }
        }
    }

    void openFaction(long factionId) {
        WorldPlannerViewModel viewModel = inspectorViewModel();
        viewModel.activate(FACTIONS);
        var factions = snapshotModel.current().factions();
        for (int index = 0; index < factions.size(); index++) {
            if (factions.get(index).factionId() == factionId) {
                viewModel.selectFaction(index);
                openDetails(viewModel);
                return;
            }
        }
    }

    void openLocation(long locationId) {
        WorldPlannerViewModel viewModel = inspectorViewModel();
        viewModel.activate(LOCATIONS);
        var locations = snapshotModel.current().locations();
        for (int index = 0; index < locations.size(); index++) {
            if (locations.get(index).locationId() == locationId) {
                viewModel.selectLocation(index);
                openDetails(viewModel);
                return;
            }
        }
    }

    void openNpcCreator() {
        openCreator(NPCS, "NPC anlegen", "world-planner:create:npc");
    }

    void openFactionCreator() {
        openCreator(FACTIONS, "Fraktion anlegen", "world-planner:create:faction");
    }

    void openLocationCreator() {
        openCreator(LOCATIONS, "Ort anlegen", "world-planner:create:location");
    }

    private void openCreator(int module, String title, String key) {
        WorldPlannerViewModel viewModel = inspectorViewModel();
        viewModel.beginCreate(module);
        activateInspector(new InspectorSession(viewModel, title, key, true));
    }

    private WorldPlannerViewModel inspectorViewModel() {
        WorldPlannerViewModel viewModel = new WorldPlannerViewModel(encounter != null);
        viewModel.applySnapshot(snapshotModel.current());
        if (creatureCatalog != null) {
            viewModel.applyCreatureCatalog(creatureCatalog.current());
        }
        if (encounterTableCatalog != null) {
            viewModel.applyEncounterTables(encounterTableCatalog.current());
        }
        return viewModel;
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
            WorldPlannerApi worldPlanner,
            @Nullable WorldPlannerEncounterSink encounter,
            WorldPlannerViewModel viewModel,
            StateInput event
    ) {
        StateInput safeEvent = Objects.requireNonNull(event, "event");
        ActionSnapshot actions = safeEvent.actions();
        boolean tracked = mutationRequested(actions);
        if (tracked) {
            pendingMutation = PendingMutation.capture(viewModel, snapshotModel.current(), actions.createRequested());
        }
        try {
            if (safeEvent.activeModuleIndex() == NPCS) {
                consumeNpcState(worldPlanner, encounter, viewModel, safeEvent.npc(), actions);
            } else if (safeEvent.activeModuleIndex() == FACTIONS) {
                consumeFactionState(worldPlanner, viewModel, safeEvent.faction(), actions);
            } else if (safeEvent.activeModuleIndex() == LOCATIONS) {
                consumeLocationState(worldPlanner, viewModel, safeEvent.location(), actions);
            }
        } catch (RuntimeException exception) {
            if (tracked) {
                pendingMutation = null;
            }
            throw exception;
        }
    }

    private void consumeNpcState(
            WorldPlannerApi worldPlanner,
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
        } else if (actions.saveEntityRequested()) {
            worldPlanner.updateNpc(new UpdateWorldNpcCommand(
                    viewModel.selectedNpcId(),
                    snapshot.displayName(),
                    viewModel.npcStatblockChoiceId(snapshot.statblockChoiceIndex()),
                    snapshot.appearanceNotes(), snapshot.behaviorNotes(), snapshot.historyNotes(), snapshot.generalNotes()));
        } else if (actions.deleteRequested()) {
            worldPlanner.deleteNpc(new DeleteWorldNpcCommand(viewModel.selectedNpcId()));
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
        } else if (actions.setNpcDispositionRequested()) {
            worldPlanner.setNpcDispositionModifier(new SetWorldNpcDispositionModifierCommand(
                    viewModel.selectedNpcId(),
                    parseDisposition(snapshot.dispositionModifierText())));
        }
    }

    private void consumeFactionState(
            WorldPlannerApi worldPlanner,
            WorldPlannerViewModel viewModel,
            FactionSnapshot snapshot,
            ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            worldPlanner.createFaction(new CreateWorldFactionCommand(
                    snapshot.displayName(),
                    snapshot.notes(),
                    viewModel.factionPrimaryTableChoiceId(snapshot.primaryEncounterTableChoiceIndex())));
        } else if (actions.saveEntityRequested()) {
            worldPlanner.updateFaction(new UpdateWorldFactionCommand(
                    viewModel.selectedFactionId(), snapshot.displayName(), snapshot.notes(),
                    viewModel.factionPrimaryTableChoiceId(snapshot.primaryEncounterTableChoiceIndex())));
        } else if (actions.deleteRequested()) {
            worldPlanner.deleteFaction(new DeleteWorldFactionCommand(viewModel.selectedFactionId()));
        } else if (actions.addNpcRequested()) {
            worldPlanner.addFactionNpc(new AddWorldFactionNpcCommand(
                    viewModel.selectedFactionId(),
                    viewModel.factionNpcChoiceId(snapshot.npcChoiceIndex())));
        } else if (actions.removeNpcRequested()) {
            worldPlanner.removeFactionNpc(new RemoveWorldFactionNpcCommand(
                    viewModel.selectedFactionId(), viewModel.factionNpcChoiceId(snapshot.npcChoiceIndex())));
        } else if (actions.setInventoryLimitRequested()) {
            worldPlanner.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                    viewModel.selectedFactionId(),
                    viewModel.factionStatblockChoiceId(snapshot.inventoryStatblockChoiceIndex()),
                    snapshot.finiteInventory(),
                    parseQuantity(snapshot.inventoryQuantityText())));
        } else if (actions.setFactionDispositionRequested()) {
            worldPlanner.setFactionDisposition(new SetWorldFactionDispositionCommand(
                    viewModel.selectedFactionId(),
                    parseDisposition(snapshot.dispositionText())));
        }
    }

    private void consumeLocationState(
            WorldPlannerApi worldPlanner,
            WorldPlannerViewModel viewModel,
            LocationSnapshot snapshot,
            ActionSnapshot actions
    ) {
        if (actions.createRequested()) {
            worldPlanner.createLocation(new CreateWorldLocationCommand(snapshot.displayName(), snapshot.notes()));
        } else if (actions.saveEntityRequested()) {
            worldPlanner.updateLocation(new UpdateWorldLocationCommand(
                    viewModel.selectedLocationId(), snapshot.displayName(), snapshot.notes()));
        } else if (actions.deleteRequested()) {
            worldPlanner.deleteLocation(new DeleteWorldLocationCommand(viewModel.selectedLocationId()));
        } else if (actions.linkFactionRequested()) {
            worldPlanner.addLocationFaction(new AddWorldLocationFactionCommand(
                    viewModel.selectedLocationId(),
                    viewModel.locationFactionChoiceId(snapshot.factionChoiceIndex())));
        } else if (actions.removeFactionRequested()) {
            worldPlanner.removeLocationFaction(new RemoveWorldLocationFactionCommand(
                    viewModel.selectedLocationId(), viewModel.locationFactionChoiceId(snapshot.factionChoiceIndex())));
        } else if (actions.linkTableRequested()) {
            worldPlanner.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(
                    viewModel.selectedLocationId(),
                    viewModel.locationTableChoiceId(snapshot.encounterTableChoiceIndex())));
        } else if (actions.removeTableRequested()) {
            worldPlanner.removeLocationEncounterTable(new RemoveWorldLocationEncounterTableCommand(
                    viewModel.selectedLocationId(), viewModel.locationTableChoiceId(snapshot.encounterTableChoiceIndex())));
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
            activeInspector = null;
            return;
        }
        activateInspector(new InspectorSession(
                viewModel,
                viewModel.detailTitle(),
                key,
                false));
    }

    private void activateInspector(InspectorSession session) {
        pendingMutation = null;
        activeInspector = session;
        inspector.push(entry(session));
    }

    private InspectorEntrySpec entry(InspectorSession session) {
        return new InspectorEntrySpec(
                session.title,
                session.key,
                () -> detailContent(session),
                null);
    }

    private Node detailContent(InspectorSession session) {
        WorldPlannerDetailView details = new WorldPlannerDetailView();
        details.render(session.viewModel.detailProjection());
        WorldPlannerStateView actions = new WorldPlannerStateView();
        actions.render(session.viewModel.stateProjectionProperty().get());
        actions.onViewInputEvent(event -> consumeState(worldPlanner, encounter, session.viewModel, event));
        session.renderings.add(new InspectorRendering(details, actions));
        VBox content = new VBox(12, details, actions);
        content.getStyleClass().add("world-planner-inspector-content");
        return content;
    }

    private void applyInspectorSnapshot(features.worldplanner.api.WorldPlannerSnapshot snapshot) {
        InspectorSession session = activeInspector;
        if (session == null || !inspector.isShowing(session.key)) {
            pendingMutation = null;
            return;
        }
        PendingMutation mutation = pendingMutation;
        if (session.creator && mutation == null) {
            return;
        }
        session.viewModel.applySnapshot(snapshot);
        if (mutation != null && mutation.createRequested()) {
            if (selectCreated(session.viewModel, mutation, snapshot)) {
                session.creator = false;
                session.title = session.viewModel.detailTitle();
                session.key = session.viewModel.detailKey();
                session.renderings.clear();
                pendingMutation = null;
                inspector.push(entry(session));
                return;
            }
            pendingMutation = null;
            return;
        }
        boolean refreshEditor = mutation != null;
        for (InspectorRendering rendering : List.copyOf(session.renderings)) {
            rendering.details().render(session.viewModel.detailProjection());
            if (refreshEditor) {
                rendering.actions().render(session.viewModel.stateProjectionProperty().get());
            }
        }
        pendingMutation = null;
    }

    private static boolean selectCreated(
            WorldPlannerViewModel viewModel,
            PendingMutation mutation,
            features.worldplanner.api.WorldPlannerSnapshot snapshot
    ) {
        if (mutation.module() == NPCS) {
            for (int index = 0; index < snapshot.npcs().size(); index++) {
                if (!mutation.idsBefore().contains(snapshot.npcs().get(index).npcId())) {
                    viewModel.selectNpc(index);
                    return true;
                }
            }
        } else if (mutation.module() == FACTIONS) {
            for (int index = 0; index < snapshot.factions().size(); index++) {
                if (!mutation.idsBefore().contains(snapshot.factions().get(index).factionId())) {
                    viewModel.selectFaction(index);
                    return true;
                }
            }
        } else if (mutation.module() == LOCATIONS) {
            for (int index = 0; index < snapshot.locations().size(); index++) {
                if (!mutation.idsBefore().contains(snapshot.locations().get(index).locationId())) {
                    viewModel.selectLocation(index);
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean mutationRequested(ActionSnapshot actions) {
        return actions.createRequested()
                || actions.saveNotesRequested()
                || actions.defeatRequested()
                || actions.reactivateRequested()
                || actions.addNpcRequested()
                || actions.setInventoryLimitRequested()
                || actions.linkFactionRequested()
                || actions.linkTableRequested()
                || actions.setNpcDispositionRequested()
                || actions.setFactionDispositionRequested()
                || actions.saveEntityRequested()
                || actions.deleteRequested()
                || actions.removeNpcRequested()
                || actions.removeFactionRequested()
                || actions.removeTableRequested();
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

    private static int parseDisposition(String value) {
        try {
            return Integer.parseInt(value == null ? "" : value.trim());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static final class InspectorSession {

        private final WorldPlannerViewModel viewModel;
        private final List<InspectorRendering> renderings = new ArrayList<>();
        private String title;
        private String key;
        private boolean creator;

        private InspectorSession(
                WorldPlannerViewModel viewModel,
                String title,
                String key,
                boolean creator
        ) {
            this.viewModel = viewModel;
            this.title = title;
            this.key = key;
            this.creator = creator;
        }
    }

    private record InspectorRendering(
            WorldPlannerDetailView details,
            WorldPlannerStateView actions
    ) {
    }

    private record PendingMutation(
            int module,
            boolean createRequested,
            List<Long> idsBefore
    ) {

        private PendingMutation {
            idsBefore = idsBefore == null ? List.of() : List.copyOf(idsBefore);
        }

        private static PendingMutation capture(
                WorldPlannerViewModel viewModel,
                features.worldplanner.api.WorldPlannerSnapshot snapshot,
                boolean createRequested
        ) {
            int module = viewModel.activeModuleIndex();
            List<Long> ids = switch (module) {
                case NPCS -> snapshot.npcs().stream().map(features.worldplanner.api.WorldNpcSummary::npcId).toList();
                case FACTIONS -> snapshot.factions().stream()
                        .map(features.worldplanner.api.WorldFactionSummary::factionId).toList();
                case LOCATIONS -> snapshot.locations().stream()
                        .map(features.worldplanner.api.WorldLocationSummary::locationId).toList();
                default -> List.of();
            };
            return new PendingMutation(module, createRequested, ids);
        }
    }

    private record Binding(
            Node controls,
            Node main
    ) implements ShellBinding {

        @Override
        public String title() {
            return "World Planner";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
