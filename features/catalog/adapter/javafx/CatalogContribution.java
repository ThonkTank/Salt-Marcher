package features.catalog.adapter.javafx;

import features.encountertable.api.EncounterTableSummary;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureReferenceIndexResult;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class CatalogContribution implements ShellContribution {

    private final CatalogBindingData data;
    private final CatalogBindingActions actions;

    public CatalogContribution(CatalogBindingData data, CatalogBindingActions actions) {
        this.data = Objects.requireNonNull(data, "data");
        this.actions = Objects.requireNonNull(actions, "actions");
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
        CatalogViewModel viewModel = new CatalogViewModel(
                data.creatures(), data.creatureQueries(), data.encounterTables(), data.encounters(),
                actions.addCreatureToScene());
        CatalogControlsView monsterControls = new CatalogControlsView();
        CatalogMainView monsters = new CatalogMainView();
        bindMonster(viewModel, monsterControls, monsters);

        ItemsCatalogSection items = new ItemsCatalogSection(data.items(), actions.inspector());
        SavedEncounterCatalogSection encounters =
                new SavedEncounterCatalogSection(data.encounters(), data.savedPlans());
        Map<Long, String> creatureNames = new HashMap<>();
        Map<Long, String> factionNames = new HashMap<>();
        Map<Long, String> tableNames = new HashMap<>();
        AtomicReference<WorldPlannerSnapshot> currentWorld = new AtomicReference<>();
        ReferenceCatalogSection<WorldNpcSummary> npcs = new ReferenceCatalogSection<>(
                CatalogSectionId.NPCS,
                "Keine NPCs verfügbar.",
                WorldNpcSummary::displayName,
                value -> reference(creatureNames, value.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, value.factionId(), "Keine Fraktion")
                        + " · " + value.disposition() + " · " + value.status(),
                value -> actions.openNpcInspector().accept(value.npcId()),
                "Öffne vorhandene NPCs im Inspector oder lege einen neuen Welt-Charakter an.",
                "NPC anlegen",
                actions.createNpc());
        ReferenceCatalogSection<WorldFactionSummary> factions = new ReferenceCatalogSection<>(
                CatalogSectionId.FACTIONS,
                "Keine Fraktionen verfügbar.",
                WorldFactionSummary::displayName,
                value -> reference(tableNames, value.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + value.disposition() + " · " + value.npcIds().size() + " NPCs",
                value -> actions.openFactionInspector().accept(value.factionId()),
                "Fraktionen bleiben World-Planner-Wahrheit und werden im Inspector bearbeitet.",
                "Fraktion anlegen",
                actions.createFaction());
        ReferenceCatalogSection<WorldLocationSummary> locations = new ReferenceCatalogSection<>(
                CatalogSectionId.LOCATIONS,
                "Keine Orte verfügbar.",
                WorldLocationSummary::displayName,
                value -> joinedReferences(factionNames, value.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, value.encounterTableIds(), "Tabellen"),
                value -> actions.openLocationInspector().accept(value.locationId()),
                "Orte öffnen und bearbeiten sich im World-Planner-Inspector.",
                "Ort anlegen",
                actions.createLocation());
        ReferenceCatalogSection<EncounterTableSummary> encounterTables = new ReferenceCatalogSection<>(
                CatalogSectionId.ENCOUNTER_TABLES,
                "Keine Encounter-Tabellen verfügbar.",
                EncounterTableSummary::name,
                value -> "#" + value.tableId(),
                ignored -> { },
                "Encounter-Tabellen sind eine read-only Referenz für die Monster- und Encounter-Auswahl.",
                "",
                () -> { });

        npcs.addAction("Encounter", "Zum Encounter", value -> data.encounters().applyState(
                ApplyEncounterStateCommand.addWorldNpcCreature(value.creatureStatblockId(), value.npcId())));
        npcs.addAction("Scene", "Zur Scene", value -> actions.addNpcToScene().accept(value.npcId()));
        factions.addAction("Encounter", "Als Quelle", value -> data.encounters().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withFaction(
                        data.builderInputs().current().poolFilters(), value.factionId()))));
        locations.addAction("Encounter", "Als Quelle", value -> data.encounters().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withLocation(
                        data.builderInputs().current().poolFilters(), value.locationId()))));
        locations.addAction("Scene", "Als Ort", value -> actions.setSceneLocation().accept(value.locationId()));
        encounterTables.addAction("Encounter", "Als Quelle", value -> data.encounters().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withTable(
                        data.builderInputs().current().poolFilters(), value.tableId()))));

        data.creatureReferences().subscribe(result -> {
            applyCreatureNames(result, creatureNames);
            applyWorld(currentWorld.get(), npcs, factions, locations, factionNames);
        });
        applyCreatureNames(data.creatureReferences().current(), creatureNames);
        data.encounterTableCatalog().subscribe(result -> {
            List<EncounterTableSummary> values = result == null ? List.of() : result.tables();
            applyTableNames(values, tableNames);
            encounterTables.apply(values);
            applyWorld(currentWorld.get(), npcs, factions, locations, factionNames);
        });
        List<EncounterTableSummary> initialTables = data.encounterTableCatalog().current().tables();
        applyTableNames(initialTables, tableNames);
        encounterTables.apply(initialTables);
        if (data.worldPlanner() != null) {
            data.worldPlanner().subscribe(snapshot -> {
                currentWorld.set(snapshot);
                applyWorld(snapshot, npcs, factions, locations, factionNames);
            });
            currentWorld.set(data.worldPlanner().current());
            applyWorld(currentWorld.get(), npcs, factions, locations, factionNames);
        }

        CatalogWorkspace workspace = new CatalogWorkspace(List.of(
                new MonsterCatalogSection(monsterControls, monsters),
                items,
                encounters,
                npcs,
                factions,
                locations,
                encounterTables));
        return ShellBinding.cockpit("Katalog", workspace.controls(), workspace.content());
    }

    private void bindMonster(
            CatalogViewModel viewModel,
            CatalogControlsView controls,
            CatalogMainView monsters
    ) {
        controls.bind(viewModel.controlsContentModel());
        controls.onViewInputEvent(viewModel::consume);
        monsters.bind(viewModel.mainContentModel());
        monsters.onViewInputEvent(viewModel::consume);
        viewModel.creatureDetailSelectionProperty().addListener((ignored, before, after) -> {
            if (after != null && after.longValue() > 0L) {
                actions.openCreatureInspector().accept(after.longValue());
                viewModel.setCreatureDetailSelection(0L);
            }
        });
        data.encounterTableCatalog().subscribe(viewModel.controlsContentModel()::applyEncounterTables);
        data.tuningPreview().subscribe(result ->
                viewModel.controlsContentModel().applyEncounterTuningPreview(result.labels()));
        data.builderInputs().subscribe(viewModel::applyEncounterBuilderInputs);
        if (data.worldPlanner() != null) {
            data.worldPlanner().subscribe(viewModel.controlsContentModel()::applyWorldPlannerSnapshot);
        }
        viewModel.controlsContentModel().applyEncounterTables(data.encounterTableCatalog().current());
        viewModel.controlsContentModel().applyEncounterTuningPreview(data.tuningPreview().current().labels());
        if (data.worldPlanner() != null) {
            viewModel.controlsContentModel().applyWorldPlannerSnapshot(data.worldPlanner().current());
        }
        viewModel.applyEncounterBuilderInputs(data.builderInputs().current());
        viewModel.initialize();
    }

    private static void applyWorld(
            WorldPlannerSnapshot snapshot,
            ReferenceCatalogSection<WorldNpcSummary> npcs,
            ReferenceCatalogSection<WorldFactionSummary> factions,
            ReferenceCatalogSection<WorldLocationSummary> locations,
            Map<Long, String> factionNames
    ) {
        if (snapshot == null) {
            return;
        }
        factionNames.clear();
        snapshot.factions().forEach(value -> factionNames.put(value.factionId(), value.displayName()));
        npcs.apply(snapshot.npcs());
        factions.apply(snapshot.factions());
        locations.apply(snapshot.locations());
    }

    private static void applyCreatureNames(CreatureReferenceIndexResult result, Map<Long, String> names) {
        names.clear();
        if (result != null) {
            result.rows().forEach(value -> names.put(value.id(), value.name()));
        }
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

    private static EncounterPoolFilters withFaction(EncounterPoolFilters source, long factionId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), List.of(factionId), safe.worldLocationId());
    }

    private static EncounterPoolFilters withLocation(EncounterPoolFilters source, long locationId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), safe.worldFactionIds(), locationId);
    }

    private static EncounterPoolFilters withTable(EncounterPoolFilters source, long tableId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>(safe.encounterTableIds());
        ids.add(tableId);
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                List.copyOf(ids), safe.worldFactionIds(), safe.worldLocationId());
    }
}
