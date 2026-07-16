package src.view.leftbartabs.catalog;

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
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.view.slotcontent.details.creature.CreatureDetailsView;

public final class CatalogContribution implements ShellContribution {

    private final CreaturesApplicationService creatures;
    private final EncounterTableApplicationService encounterTables;
    private final EncounterApplicationService encounters;
    private final EncounterBuilderInputsModel builderInputs;
    private final CreatureFilterOptionsModel filterOptions;
    private final CreatureCatalogModel catalog;
    private final CreatureDetailModel detail;
    private final EncounterTableCatalogModel encounterTableCatalog;
    private final EncounterTuningPreviewModel tuningPreview;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;
    private final InspectorSink inspector;

    public CatalogContribution(
            CreaturesApplicationService creatures,
            EncounterTableApplicationService encounterTables,
            EncounterApplicationService encounters,
            EncounterBuilderInputsModel builderInputs,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            CreatureDetailModel detail,
            EncounterTableCatalogModel encounterTableCatalog,
            EncounterTuningPreviewModel tuningPreview,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            InspectorSink inspector
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.builderInputs = Objects.requireNonNull(builderInputs, "builderInputs");
        this.filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.detail = Objects.requireNonNull(detail, "detail");
        this.encounterTableCatalog = Objects.requireNonNull(encounterTableCatalog, "encounterTableCatalog");
        this.tuningPreview = Objects.requireNonNull(tuningPreview, "tuningPreview");
        this.worldPlanner = worldPlanner;
        this.inspector = Objects.requireNonNull(inspector, "inspector");
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
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();

        controls.bind(viewModel.controlsContentModel());
        controls.onViewInputEvent(viewModel::consume);
        main.bind(viewModel.mainContentModel());
        main.onViewInputEvent(viewModel::consume);
        viewModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            CreatureDetailsView.openInspector(inspector, detail, after.longValue());
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
        return ShellBinding.cockpit("Encounter-Planer", controls, main);
    }

}
