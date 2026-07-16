package src.view.leftbartabs.worldplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import javafx.scene.control.Separator;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.AddWorldFactionNpcCommand;
import src.domain.worldplanner.published.AddWorldLocationEncounterTableCommand;
import src.domain.worldplanner.published.AddWorldLocationFactionCommand;
import src.domain.worldplanner.published.CreateWorldFactionCommand;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.domain.worldplanner.published.SetWorldFactionInventoryLimitCommand;
import src.domain.worldplanner.published.SetWorldFactionDispositionCommand;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;
import src.domain.worldplanner.published.SetWorldNpcDispositionModifierCommand;
import src.domain.worldplanner.published.UpdateWorldNpcNotesCommand;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsView;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsViewInputEvent;

/** Adapts World Planner-owned lists and commands into shared Catalog content. */
public final class WorldPlannerBinder {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;

    private final WorldPlannerApplicationService worldPlanner;
    private final @Nullable EncounterApplicationService encounter;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final @Nullable CreatureCatalogModel creatureCatalog;
    private final @Nullable EncounterTableCatalogModel encounterTableCatalog;
    private final InspectorSink inspector;

    public WorldPlannerBinder(
            WorldPlannerApplicationService worldPlanner,
            @Nullable EncounterApplicationService encounter,
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

    public CatalogModule bindCatalog() {
        WorldPlannerViewModel viewModel = new WorldPlannerViewModel(encounter != null);
        SearchFilterControlsView search = new SearchFilterControlsView();
        WorldPlannerNpcMainView npcs = new WorldPlannerNpcMainView();
        WorldPlannerFactionMainView factions = new WorldPlannerFactionMainView();
        WorldPlannerLocationMainView locations = new WorldPlannerLocationMainView();
        StackPane main = new StackPane(npcs, factions, locations);
        main.getStyleClass().add("world-planner-main-stack");
        VBox.setVgrow(main, Priority.ALWAYS);

        viewModel.bindSearchFilters(search);
        npcs.bind(viewModel);
        factions.bind(viewModel);
        locations.bind(viewModel);
        search.onViewInputEvent(event -> consumeSearch(viewModel, event));
        npcs.onViewInputEvent(event -> {
            viewModel.selectNpc(event.selectedNpcIndex());
            openDetails(viewModel);
        });
        factions.onViewInputEvent(event -> {
            viewModel.selectFaction(event.selectedFactionIndex());
            openDetails(viewModel);
        });
        locations.onViewInputEvent(event -> {
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
        return new CatalogModule(search, main, viewModel, () -> openDetails(viewModel));
    }

    private void consumeSearch(WorldPlannerViewModel viewModel, SearchFilterControlsViewInputEvent event) {
        SearchFilterControlsViewInputEvent safeEvent = Objects.requireNonNull(event, "event");
        viewModel.applySearchFilters(safeEvent.searchQuery(), selectedFiltersByGroup(safeEvent));
        openDetails(viewModel);
    }

    private void consumeState(WorldPlannerViewModel viewModel, StateInput event) {
        StateInput safeEvent = Objects.requireNonNull(event, "event");
        ActionSnapshot actions = safeEvent.actions();
        if (safeEvent.activeModuleIndex() == NPCS) {
            consumeNpcState(viewModel, safeEvent.npc(), actions);
        } else if (safeEvent.activeModuleIndex() == FACTIONS) {
            consumeFactionState(viewModel, safeEvent.faction(), actions);
        } else if (safeEvent.activeModuleIndex() == LOCATIONS) {
            consumeLocationState(viewModel, safeEvent.location(), actions);
        }
        openDetails(viewModel);
    }

    private void consumeNpcState(WorldPlannerViewModel viewModel, NpcSnapshot snapshot, ActionSnapshot actions) {
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
            worldPlanner.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.defeated(viewModel.selectedNpcId()));
        } else if (actions.reactivateRequested()) {
            worldPlanner.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.active(viewModel.selectedNpcId()));
        } else if (actions.addToEncounterRequested()) {
            addNpcToEncounter(viewModel);
        } else if (actions.setNpcDispositionRequested()) {
            worldPlanner.setNpcDispositionModifier(new SetWorldNpcDispositionModifierCommand(
                    viewModel.selectedNpcId(), parseDisposition(snapshot.dispositionModifierText())));
        }
    }

    private void consumeFactionState(
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
        } else if (actions.setFactionDispositionRequested()) {
            worldPlanner.setFactionDisposition(new SetWorldFactionDispositionCommand(
                    viewModel.selectedFactionId(), parseDisposition(snapshot.dispositionText())));
        }
    }

    private void consumeLocationState(
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

    private void addNpcToEncounter(WorldPlannerViewModel viewModel) {
        long statblockId = viewModel.selectedNpcStatblockId();
        long npcId = viewModel.selectedNpcId();
        if (encounter != null && statblockId > 0L && npcId > 0L) {
            encounter.applyState(ApplyEncounterStateCommand.addWorldNpcCreature(statblockId, npcId));
        }
    }

    private void openDetails(WorldPlannerViewModel viewModel) {
        String detailKey = viewModel.detailKey();
        int module = viewModel.stateProjectionProperty().get().activeModuleIndex();
        String key = detailKey.isBlank() ? "world-planner-editor:" + module : detailKey;
        String title = viewModel.detailTitle().isBlank() ? moduleTitle(module) : viewModel.detailTitle();
        DetailProjection detail = viewModel.detailProjection();
        StateProjection editor = viewModel.stateProjectionProperty().get();
        inspector.push(new InspectorEntrySpec(
                title,
                key,
                () -> detailAndEditor(detailKey, detail, editor, viewModel),
                null));
    }

    private Node detailAndEditor(
            String detailKey,
            DetailProjection detail,
            StateProjection editorProjection,
            WorldPlannerViewModel viewModel
    ) {
        VBox content = new VBox(12);
        content.getStyleClass().add("world-planner-inspector");
        if (!detailKey.isBlank()) {
            WorldPlannerDetailView detailView = new WorldPlannerDetailView();
            detailView.render(detail);
            content.getChildren().addAll(detailView, new Separator());
        }
        WorldPlannerStateView editor = new WorldPlannerStateView();
        editor.render(editorProjection);
        editor.onViewInputEvent(event -> consumeState(viewModel, event));
        content.getChildren().add(editor);
        return content;
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

    private static String moduleTitle(int module) {
        return switch (module) {
            case FACTIONS -> "Fraktion";
            case LOCATIONS -> "Ort";
            default -> "NPC";
        };
    }

    private static int parseDisposition(String value) {
        try {
            return Math.max(-50, Math.min(50, Integer.parseInt(value == null ? "" : value.trim())));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    public static final class CatalogModule {
        private final Node controls;
        private final Node main;
        private final WorldPlannerViewModel viewModel;
        private final Runnable detailOpener;

        private CatalogModule(
                Node controls,
                Node main,
                WorldPlannerViewModel viewModel,
                Runnable detailOpener
        ) {
            this.controls = controls;
            this.main = main;
            this.viewModel = viewModel;
            this.detailOpener = detailOpener;
        }

        public Node controls() {
            return controls;
        }

        public Node main() {
            return main;
        }

        public void activateNpcs() {
            activate(NPCS);
        }

        public void activateFactions() {
            activate(FACTIONS);
        }

        public void activateLocations() {
            activate(LOCATIONS);
        }

        private void activate(int module) {
            viewModel.activate(module);
            detailOpener.run();
        }
    }
}
