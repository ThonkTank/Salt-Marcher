package features.catalog.adapter.javafx;

import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.List;
import java.util.Objects;
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
                data.creatures(), data.creatureQueries(), data.encounterTables(), data.encounters());
        CatalogControlsView monsterControls = new CatalogControlsView();
        CatalogMainView monsters = new CatalogMainView();
        bindMonster(viewModel, monsterControls, monsters);

        ItemsCatalogSection items = new ItemsCatalogSection(data.items(), actions.inspector());
        SavedEncounterCatalogSection encounters =
                new SavedEncounterCatalogSection(data.encounters(), data.savedPlans());
        ReferenceCatalogSection<WorldNpcSummary> npcs = new ReferenceCatalogSection<>(
                CatalogSectionId.NPCS,
                "Keine NPCs verfügbar.",
                WorldNpcSummary::displayName,
                value -> actions.openNpcInspector().accept(value.npcId()),
                "Öffne vorhandene NPCs im Inspector oder lege einen neuen Welt-Charakter an.",
                "NPC anlegen",
                actions.createNpc());
        ReferenceCatalogSection<WorldFactionSummary> factions = new ReferenceCatalogSection<>(
                CatalogSectionId.FACTIONS,
                "Keine Fraktionen verfügbar.",
                WorldFactionSummary::displayName,
                value -> actions.openFactionInspector().accept(value.factionId()),
                "Fraktionen bleiben World-Planner-Wahrheit und werden im Inspector bearbeitet.",
                "Fraktion anlegen",
                actions.createFaction());
        ReferenceCatalogSection<WorldLocationSummary> locations = new ReferenceCatalogSection<>(
                CatalogSectionId.LOCATIONS,
                "Keine Orte verfügbar.",
                WorldLocationSummary::displayName,
                value -> actions.openLocationInspector().accept(value.locationId()),
                "Orte öffnen und bearbeiten sich im World-Planner-Inspector.",
                "Ort anlegen",
                actions.createLocation());
        ReferenceCatalogSection<EncounterTableSummary> encounterTables = new ReferenceCatalogSection<>(
                CatalogSectionId.ENCOUNTER_TABLES,
                "Keine Encounter-Tabellen verfügbar.",
                EncounterTableSummary::name,
                ignored -> { },
                "Encounter-Tabellen sind eine read-only Referenz für die Monster- und Encounter-Auswahl.",
                "",
                () -> { });

        data.encounterTableCatalog().subscribe(result ->
                encounterTables.apply(result == null ? List.of() : result.tables()));
        encounterTables.apply(data.encounterTableCatalog().current().tables());
        if (data.worldPlanner() != null) {
            data.worldPlanner().subscribe(snapshot -> applyWorld(snapshot, npcs, factions, locations));
            applyWorld(data.worldPlanner().current(), npcs, factions, locations);
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
            ReferenceCatalogSection<WorldLocationSummary> locations
    ) {
        if (snapshot == null) {
            return;
        }
        npcs.apply(snapshot.npcs());
        factions.apply(snapshot.factions());
        locations.apply(snapshot.locations());
    }
}
