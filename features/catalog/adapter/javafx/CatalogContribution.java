package features.catalog.adapter.javafx;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import shell.api.ContributionKey;
import shell.api.InspectorSink;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureFilterOptionsModel;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterTuningPreviewModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldPlannerSnapshotModel;

public final class CatalogContribution implements ShellContribution {

    private final CreaturesApi creatures;
    private final EncounterTableApi encounterTables;
    private final EncounterApi encounters;
    private final EncounterBuilderInputsModel builderInputs;
    private final CreatureFilterOptionsModel filterOptions;
    private final CreatureCatalogModel catalog;
    private final EncounterTableCatalogModel encounterTableCatalog;
    private final EncounterTuningPreviewModel tuningPreview;
    private final SavedEncounterPlanListModel savedPlans;
    private final ItemsCatalogApi items;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;
    private final InspectorSink inspector;
    private final java.util.function.LongConsumer openCreatureInspector;
    private final java.util.function.LongConsumer openNpcInspector;
    private final java.util.function.LongConsumer openFactionInspector;
    private final java.util.function.LongConsumer openLocationInspector;
    private final Runnable createNpc;
    private final Runnable createFaction;
    private final Runnable createLocation;
    private final java.util.function.LongConsumer addNpcToScene;
    private final java.util.function.LongConsumer setSceneLocation;

    public CatalogContribution(
            CreaturesApi creatures,
            EncounterTableApi encounterTables,
            EncounterApi encounters,
            EncounterBuilderInputsModel builderInputs,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            EncounterTableCatalogModel encounterTableCatalog,
            EncounterTuningPreviewModel tuningPreview,
            SavedEncounterPlanListModel savedPlans,
            ItemsCatalogApi items,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            InspectorSink inspector,
            java.util.function.LongConsumer openCreatureInspector,
            java.util.function.LongConsumer openNpcInspector,
            java.util.function.LongConsumer openFactionInspector,
            java.util.function.LongConsumer openLocationInspector,
            Runnable createNpc,
            Runnable createFaction,
            Runnable createLocation
    ) {
        this(creatures, encounterTables, encounters, builderInputs, filterOptions, catalog,
                encounterTableCatalog, tuningPreview, savedPlans, items, worldPlanner, inspector,
                openCreatureInspector, openNpcInspector, openFactionInspector, openLocationInspector,
                createNpc, createFaction, createLocation, ignored -> { }, ignored -> { });
    }

    public CatalogContribution(
            CreaturesApi creatures,
            EncounterTableApi encounterTables,
            EncounterApi encounters,
            EncounterBuilderInputsModel builderInputs,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            EncounterTableCatalogModel encounterTableCatalog,
            EncounterTuningPreviewModel tuningPreview,
            SavedEncounterPlanListModel savedPlans,
            ItemsCatalogApi items,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            InspectorSink inspector,
            java.util.function.LongConsumer openCreatureInspector,
            java.util.function.LongConsumer openNpcInspector,
            java.util.function.LongConsumer openFactionInspector,
            java.util.function.LongConsumer openLocationInspector,
            Runnable createNpc,
            Runnable createFaction,
            Runnable createLocation,
            java.util.function.LongConsumer addNpcToScene,
            java.util.function.LongConsumer setSceneLocation
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.builderInputs = Objects.requireNonNull(builderInputs, "builderInputs");
        this.filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.encounterTableCatalog = Objects.requireNonNull(encounterTableCatalog, "encounterTableCatalog");
        this.tuningPreview = Objects.requireNonNull(tuningPreview, "tuningPreview");
        this.savedPlans = Objects.requireNonNull(savedPlans, "savedPlans");
        this.items = Objects.requireNonNull(items, "items");
        this.worldPlanner = worldPlanner;
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.openCreatureInspector = Objects.requireNonNull(openCreatureInspector, "openCreatureInspector");
        this.openNpcInspector = Objects.requireNonNull(openNpcInspector, "openNpcInspector");
        this.openFactionInspector = Objects.requireNonNull(openFactionInspector, "openFactionInspector");
        this.openLocationInspector = Objects.requireNonNull(openLocationInspector, "openLocationInspector");
        this.createNpc = Objects.requireNonNull(createNpc, "createNpc");
        this.createFaction = Objects.requireNonNull(createFaction, "createFaction");
        this.createLocation = Objects.requireNonNull(createLocation, "createLocation");
        this.addNpcToScene = Objects.requireNonNull(addNpcToScene, "addNpcToScene");
        this.setSceneLocation = Objects.requireNonNull(setSceneLocation, "setSceneLocation");
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
        CatalogViewModel viewModel = new CatalogViewModel(creatures, encounterTables, encounters);
        CatalogControlsHost controls = new CatalogControlsHost();
        CatalogMainView monsters = new CatalogMainView();

        controls.bind(viewModel.controlsContentModel());
        controls.onViewInputEvent(viewModel::consume);
        monsters.bind(viewModel.mainContentModel());
        monsters.onViewInputEvent(viewModel::consume);
        viewModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureInspector.accept(after.longValue());
            viewModel.setCreatureDetailSelection(0L);
        });

        filterOptions.subscribe(viewModel.controlsContentModel()::applyCreatureFilterOptions);
        catalog.subscribe(viewModel.mainContentModel()::applySearchResult);
        encounterTableCatalog.subscribe(viewModel.controlsContentModel()::applyEncounterTables);
        tuningPreview.subscribe(result ->
                viewModel.controlsContentModel().applyEncounterTuningPreview(result.labels()));
        builderInputs.subscribe(viewModel::applyEncounterBuilderInputs);
        if (worldPlanner != null) {
            worldPlanner.subscribe(viewModel.controlsContentModel()::applyWorldPlannerSnapshot);
        }

        viewModel.controlsContentModel().applyCreatureFilterOptions(filterOptions.current());
        viewModel.mainContentModel().applySearchResult(catalog.current());
        viewModel.controlsContentModel().applyEncounterTables(encounterTableCatalog.current());
        viewModel.controlsContentModel().applyEncounterTuningPreview(tuningPreview.current().labels());
        if (worldPlanner != null) {
            viewModel.controlsContentModel().applyWorldPlannerSnapshot(worldPlanner.current());
        }
        viewModel.applyEncounterBuilderInputs(builderInputs.current());
        CatalogWorkspaceView workspace = new CatalogWorkspaceView(
                monsters,
                controls,
                items,
                encounters,
                savedPlans,
                builderInputs,
                catalog,
                encounterTableCatalog,
                worldPlanner,
                inspector,
                openNpcInspector,
                openFactionInspector,
                openLocationInspector,
                createNpc,
                createFaction,
                createLocation,
                addNpcToScene,
                setSceneLocation);
        return ShellBinding.cockpit("Katalog", controls, workspace);
    }

}
