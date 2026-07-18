package features.catalog;

import features.catalog.adapter.javafx.CatalogSection;
import features.catalog.adapter.javafx.ItemsCatalogSection;
import features.catalog.adapter.javafx.ReferenceCatalogSection;
import features.catalog.adapter.javafx.SavedEncounterCatalogSection;
import features.catalog.application.CatalogApplicationRoutes;
import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import features.creatures.api.CreatureReferenceIndexResult;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Temporary bridge only for the six sections that migrate in M3 and M4. */
final class LegacyCatalogBindingAdapter implements AutoCloseable {

    private final SavedEncounterCatalogSection savedEncounters;
    private final ReferenceCatalogSection<WorldNpcSummary> npcs;
    private final ReferenceCatalogSection<WorldFactionSummary> factions;
    private final ReferenceCatalogSection<WorldLocationSummary> locations;
    private final ReferenceCatalogSection<EncounterTableSummary> encounterTables;
    private final List<CatalogSection> sections;
    private final Map<Long, String> creatureNames = new HashMap<>();
    private final Map<Long, String> factionNames = new HashMap<>();
    private final Map<Long, String> tableNames = new HashMap<>();
    private Runnable unsubscribe;

    LegacyCatalogBindingAdapter(CatalogWorkspaceController controller, CatalogApplicationRoutes routes) {
        CatalogWorkspaceController requiredController = Objects.requireNonNull(controller, "controller");
        CatalogApplicationRoutes requiredRoutes = Objects.requireNonNull(routes, "routes");
        ItemsCatalogSection items = new ItemsCatalogSection(
                requiredController.itemCatalog(), requiredRoutes.itemInspector(), requiredController);
        savedEncounters = new SavedEncounterCatalogSection(requiredRoutes.encounter(), requiredController);
        npcs = npcSection(requiredRoutes);
        factions = factionSection(requiredRoutes);
        locations = locationSection(requiredRoutes);
        encounterTables = tableSection();
        addActions(requiredRoutes);
        sections = List.of(items, savedEncounters, npcs, factions, locations, encounterTables);
        unsubscribe = requiredController.publication().subscribe(this::apply);
        apply(requiredController.publication().current());
    }

    List<CatalogSection> sections() {
        return sections;
    }

    private ReferenceCatalogSection<WorldNpcSummary> npcSection(CatalogApplicationRoutes routes) {
        return new ReferenceCatalogSection<>(
                CatalogSectionId.NPCS, "Keine NPCs verfügbar.", WorldNpcSummary::displayName,
                value -> reference(creatureNames, value.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, value.factionId(), "Keine Fraktion")
                        + " · " + value.disposition() + " · " + value.status(),
                value -> routes.worldInspectors().openNpc(value.npcId()),
                "Öffne vorhandene NPCs im Inspector oder lege einen neuen Welt-Charakter an.",
                "NPC anlegen", routes.worldInspectors()::createNpc);
    }

    private ReferenceCatalogSection<WorldFactionSummary> factionSection(CatalogApplicationRoutes routes) {
        return new ReferenceCatalogSection<>(
                CatalogSectionId.FACTIONS, "Keine Fraktionen verfügbar.", WorldFactionSummary::displayName,
                value -> reference(tableNames, value.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + value.disposition() + " · " + value.npcIds().size() + " NPCs",
                value -> routes.worldInspectors().openFaction(value.factionId()),
                "Fraktionen bleiben World-Planner-Wahrheit und werden im Inspector bearbeitet.",
                "Fraktion anlegen", routes.worldInspectors()::createFaction);
    }

    private ReferenceCatalogSection<WorldLocationSummary> locationSection(CatalogApplicationRoutes routes) {
        return new ReferenceCatalogSection<>(
                CatalogSectionId.LOCATIONS, "Keine Orte verfügbar.", WorldLocationSummary::displayName,
                value -> joinedReferences(factionNames, value.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, value.encounterTableIds(), "Tabellen"),
                value -> routes.worldInspectors().openLocation(value.locationId()),
                "Orte öffnen und bearbeiten sich im World-Planner-Inspector.",
                "Ort anlegen", routes.worldInspectors()::createLocation);
    }

    private static ReferenceCatalogSection<EncounterTableSummary> tableSection() {
        return new ReferenceCatalogSection<>(
                CatalogSectionId.ENCOUNTER_TABLES, "Keine Encounter-Tabellen verfügbar.",
                EncounterTableSummary::name, value -> "#" + value.tableId(),
                "Encounter-Tabellen sind eine read-only Referenz für die Monster- und Encounter-Auswahl.");
    }

    private void addActions(CatalogApplicationRoutes routes) {
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
        EncounterTableCatalogResult tables = encounterTableResult(state);
        WorldPlannerSnapshot world = worldSnapshot(state);
        savedEncounters.apply(savedEncounterResult(state));
        applyCreatureNames(state.worldReferences().creatures(), creatureNames);
        applyTableNames(tables.tables(), tableNames);
        factionNames.clear();
        world.factions().forEach(value -> factionNames.put(value.factionId(), value.displayName()));
        npcs.apply(world.npcs());
        factions.apply(world.factions());
        locations.apply(world.locations());
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
        unsubscribe.run();
        unsubscribe = () -> { };
    }
}
