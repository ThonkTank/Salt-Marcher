package features.catalog.adapter.javafx;

import features.catalog.application.CatalogApplicationRoutes;
import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureCatalogQueryApi;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;

/** JavaFX renderer and raw-event translator for the application-owned Catalog workspace. */
public final class CatalogContribution implements ShellContribution, AutoCloseable {

    private final CatalogWorkspaceController controller;
    private final CreatureCatalogQueryApi creatureQueries;
    private final ItemsCatalogApi itemCatalog;
    private final CatalogApplicationRoutes routes;
    private final AtomicBoolean closed = new AtomicBoolean();
    private Runnable unsubscribe = () -> { };
    private CatalogWorkspaceView workspace;
    private CatalogViewModel monsterViewModel;
    private SavedEncounterCatalogSection savedEncounterSection;
    private ReferenceCatalogSection<WorldNpcSummary> npcs;
    private ReferenceCatalogSection<WorldFactionSummary> factions;
    private ReferenceCatalogSection<WorldLocationSummary> locations;
    private ReferenceCatalogSection<EncounterTableSummary> encounterTables;
    private final Map<Long, String> creatureNames = new HashMap<>();
    private final Map<Long, String> factionNames = new HashMap<>();
    private final Map<Long, String> tableNames = new HashMap<>();

    public CatalogContribution(
            CatalogWorkspaceController controller,
            CreatureCatalogQueryApi creatureQueries,
            ItemsCatalogApi itemCatalog,
            CatalogApplicationRoutes routes
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.creatureQueries = Objects.requireNonNull(creatureQueries, "creatureQueries");
        this.itemCatalog = Objects.requireNonNull(itemCatalog, "itemCatalog");
        this.routes = Objects.requireNonNull(routes, "routes");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/catalog/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        if (closed.get()) {
            throw new IllegalStateException("Catalog contribution is closed.");
        }
        if (workspace != null) {
            throw new IllegalStateException("Catalog contribution may only be bound once.");
        }
        CatalogControlsView monsterControls = new CatalogControlsView();
        CatalogMainView monsters = new CatalogMainView();
        monsterViewModel = new CatalogViewModel(
                creatureQueries, routes.creatureInspector(), routes.encounter(), routes.scene(), controller);
        bindMonster(monsterControls, monsters);

        ItemsCatalogSection items = new ItemsCatalogSection(
                itemCatalog, routes.itemInspector(), controller);
        savedEncounterSection = new SavedEncounterCatalogSection(routes.encounter(), controller);
        createReferenceSections();

        workspace = new CatalogWorkspaceView(controller, List.of(
                new MonsterCatalogSection(monsterControls, monsters, monsterViewModel::initialize),
                items,
                savedEncounterSection,
                npcs,
                factions,
                locations,
                encounterTables));
        unsubscribe = controller.publication().subscribe(this::apply);
        apply(controller.publication().current());
        return new CatalogShellBinding(workspace);
    }

    private void bindMonster(CatalogControlsView controls, CatalogMainView monsters) {
        controls.bind(monsterViewModel.controlsContentModel());
        controls.onViewInputEvent(monsterViewModel::consume);
        monsters.bind(monsterViewModel.mainContentModel());
        monsters.onViewInputEvent(monsterViewModel::consume);
    }

    private void createReferenceSections() {
        npcs = new ReferenceCatalogSection<>(
                CatalogSectionId.NPCS,
                "Keine NPCs verfügbar.",
                WorldNpcSummary::displayName,
                value -> reference(creatureNames, value.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, value.factionId(), "Keine Fraktion")
                        + " · " + value.disposition() + " · " + value.status(),
                value -> routes.worldInspectors().openNpc(value.npcId()),
                "Öffne vorhandene NPCs im Inspector oder lege einen neuen Welt-Charakter an.",
                "NPC anlegen",
                routes.worldInspectors()::createNpc);
        factions = new ReferenceCatalogSection<>(
                CatalogSectionId.FACTIONS,
                "Keine Fraktionen verfügbar.",
                WorldFactionSummary::displayName,
                value -> reference(tableNames, value.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + value.disposition() + " · " + value.npcIds().size() + " NPCs",
                value -> routes.worldInspectors().openFaction(value.factionId()),
                "Fraktionen bleiben World-Planner-Wahrheit und werden im Inspector bearbeitet.",
                "Fraktion anlegen",
                routes.worldInspectors()::createFaction);
        locations = new ReferenceCatalogSection<>(
                CatalogSectionId.LOCATIONS,
                "Keine Orte verfügbar.",
                WorldLocationSummary::displayName,
                value -> joinedReferences(factionNames, value.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, value.encounterTableIds(), "Tabellen"),
                value -> routes.worldInspectors().openLocation(value.locationId()),
                "Orte öffnen und bearbeiten sich im World-Planner-Inspector.",
                "Ort anlegen",
                routes.worldInspectors()::createLocation);
        encounterTables = new ReferenceCatalogSection<>(
                CatalogSectionId.ENCOUNTER_TABLES,
                "Keine Encounter-Tabellen verfügbar.",
                EncounterTableSummary::name,
                value -> "#" + value.tableId(),
                "Encounter-Tabellen sind eine read-only Referenz für die Monster- und Encounter-Auswahl.");

        npcs.addAction("Encounter", "Zum Encounter",
                value -> routes.encounter().addWorldNpc(value.creatureStatblockId(), value.npcId()));
        npcs.addAction("Scene", "Zur Scene", value -> routes.scene().addNpc(value.npcId()));
        factions.addAction("Encounter", "Als Quelle",
                value -> routes.encounter().useFactionSource(value.factionId()));
        locations.addAction("Encounter", "Als Quelle",
                value -> routes.encounter().useLocationSource(value.locationId()));
        locations.addAction("Scene", "Als Ort", value -> routes.scene().setLocation(value.locationId()));
        encounterTables.addAction("Encounter", "Als Quelle",
                value -> routes.encounter().useEncounterTableSource(value.tableId()));
    }

    private void apply(CatalogWorkspaceState state) {
        if (workspace == null || closed.get()) {
            return;
        }
        workspace.apply(state);
        EncounterTableCatalogResult tables = encounterTableResult(state);
        WorldPlannerSnapshot world = worldSnapshot(state);
        CreatureReferenceIndexResult creatures = state.worldReferences().creatures();
        EncounterBuilderInputs encounterInputs = state.monsters().encounterPoolFilters();
        SavedEncounterPlanListResult savedPlans = savedEncounterResult(state);

        monsterViewModel.controlsContentModel().applyEncounterTables(tables);
        monsterViewModel.controlsContentModel().applyWorldPlannerSnapshot(world);
        monsterViewModel.applyEncounterBuilderInputs(encounterInputs);
        savedEncounterSection.apply(savedPlans);
        applyCreatureNames(creatures, creatureNames);
        applyTableNames(tables.tables(), tableNames);
        applyWorld(world, npcs, factions, locations, factionNames);
        encounterTables.apply(tables.tables());
    }

    private static EncounterTableCatalogResult encounterTableResult(CatalogWorkspaceState state) {
        CatalogResultState<EncounterTableSummary> result = state.encounterTables().results();
        EncounterTableReadStatus status = result.status() == CatalogResultState.Status.READY
                || result.status() == CatalogResultState.Status.EMPTY
                ? EncounterTableReadStatus.SUCCESS : EncounterTableReadStatus.STORAGE_ERROR;
        return new EncounterTableCatalogResult(status, result.rows());
    }

    private static SavedEncounterPlanListResult savedEncounterResult(CatalogWorkspaceState state) {
        var result = state.savedEncounters().results();
        SavedEncounterPlanStatus status = result.status() == CatalogResultState.Status.READY
                || result.status() == CatalogResultState.Status.EMPTY
                ? SavedEncounterPlanStatus.SUCCESS : SavedEncounterPlanStatus.STORAGE_ERROR;
        return new SavedEncounterPlanListResult(status, result.rows(), result.message());
    }

    private static WorldPlannerSnapshot worldSnapshot(CatalogWorkspaceState state) {
        var world = state.worldReferences();
        boolean success = List.of(world.npcs().results(), world.factions().results(), world.locations().results())
                .stream().allMatch(result -> result.status() == CatalogResultState.Status.READY
                        || result.status() == CatalogResultState.Status.EMPTY);
        return new WorldPlannerSnapshot(
                success ? WorldPlannerReadStatus.SUCCESS : WorldPlannerReadStatus.STORAGE_ERROR,
                world.npcs().results().rows(), world.factions().results().rows(), world.locations().results().rows(),
                success ? "" : world.npcs().results().message());
    }

    private static void applyWorld(
            WorldPlannerSnapshot snapshot,
            ReferenceCatalogSection<WorldNpcSummary> npcs,
            ReferenceCatalogSection<WorldFactionSummary> factions,
            ReferenceCatalogSection<WorldLocationSummary> locations,
            Map<Long, String> factionNames
    ) {
        factionNames.clear();
        snapshot.factions().forEach(value -> factionNames.put(value.factionId(), value.displayName()));
        npcs.apply(snapshot.npcs());
        factions.apply(snapshot.factions());
        locations.apply(snapshot.locations());
    }

    private static void applyCreatureNames(CreatureReferenceIndexResult result, Map<Long, String> names) {
        names.clear();
        result.rows().forEach(value -> names.put(value.id(), value.name()));
    }

    private static void applyTableNames(List<EncounterTableSummary> tables, Map<Long, String> names) {
        names.clear();
        tables.forEach(value -> names.put(value.tableId(), value.name()));
    }

    private static String reference(Map<Long, String> labels, long id, String fallback) {
        if (id <= 0L) {
            return fallback;
        }
        String label = labels.get(id);
        return label == null || label.isBlank() ? fallback + " #" + id : label + " (#" + id + ")";
    }

    private static String joinedReferences(Map<Long, String> labels, List<Long> ids, String empty) {
        if (ids == null || ids.isEmpty()) {
            return "Keine " + empty;
        }
        return ids.stream().map(id -> reference(labels, id, empty))
                .collect(java.util.stream.Collectors.joining(", "));
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        unsubscribe.run();
        unsubscribe = () -> { };
        if (workspace != null) {
            workspace.deactivate();
        }
    }

    private final class CatalogShellBinding implements ShellBinding {
        private final Map<ShellSlot, javafx.scene.Node> slots;

        private CatalogShellBinding(CatalogWorkspaceView view) {
            slots = Map.of(ShellSlot.COCKPIT_CONTROLS, view.controls(), ShellSlot.COCKPIT_MAIN, view.content());
        }

        @Override
        public String title() {
            return "Katalog";
        }

        @Override
        public Map<ShellSlot, javafx.scene.Node> slotContent() {
            return slots;
        }

        @Override
        public void onActivate() {
            controller.activate();
            workspace.activate();
        }

        @Override
        public void onDeactivate() {
            workspace.deactivate();
            controller.deactivate();
        }
    }
}
