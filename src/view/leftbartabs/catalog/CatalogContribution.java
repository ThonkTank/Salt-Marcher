package src.view.leftbartabs.catalog;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellRuntimeContext;
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
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        ShellRuntimeContext safeRuntimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
        var services = safeRuntimeContext.services();
        var creatures = services.require(CreaturesApplicationService.class);
        var encounterTables = services.require(EncounterTableApplicationService.class);
        var encounters = services.require(EncounterApplicationService.class);
        var builderInputs = services.require(EncounterBuilderInputsModel.class);
        var filterOptions = services.require(CreatureFilterOptionsModel.class);
        var catalog = services.require(CreatureCatalogModel.class);
        var detail = services.require(CreatureDetailModel.class);
        var encounterTableCatalog = services.require(EncounterTableCatalogModel.class);
        var tuningPreview = services.require(EncounterTuningPreviewModel.class);
        var worldPlanner = services.find(WorldPlannerSnapshotModel.class).orElse(null);

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
            CreatureDetailsView.openInspector(safeRuntimeContext.inspector(), detail, after.longValue());
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
