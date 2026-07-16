package src.view.leftbartabs.catalog;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
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
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.items.ItemsCatalogApi;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.view.leftbartabs.worldplanner.WorldPlannerBinder;
import src.view.leftbartabs.worldplanner.WorldPlannerBinder.CatalogModule;
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
    private final @Nullable WorldPlannerApplicationService worldPlannerApplication;
    private final @Nullable ItemsCatalogApi items;
    private final @Nullable SavedEncounterPlanListModel savedPlans;
    private final @Nullable EncounterStateModel encounterState;
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
        this(creatures, encounterTables, encounters, builderInputs, filterOptions, catalog, detail,
                encounterTableCatalog, tuningPreview, worldPlanner, null, null, null, null, inspector);
    }

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
            WorldPlannerSnapshotModel worldPlanner,
            WorldPlannerApplicationService worldPlannerApplication,
            ItemsCatalogApi items,
            SavedEncounterPlanListModel savedPlans,
            EncounterStateModel encounterState,
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
        this.worldPlannerApplication = worldPlannerApplication;
        this.items = items;
        this.savedPlans = savedPlans;
        this.encounterState = encounterState;
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
        CatalogControlsView monsterControls = new CatalogControlsView();
        CatalogMainView monsterMain = new CatalogMainView();

        monsterControls.bind(viewModel.controlsContentModel());
        monsterControls.onViewInputEvent(viewModel::consume);
        monsterMain.bind(viewModel.mainContentModel());
        monsterMain.onViewInputEvent(viewModel::consume);
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

        ItemsCatalogModule itemModule = items == null ? null : new ItemsCatalogModule(items, inspector);
        SavedEncounterCatalogModule savedModule = savedPlans == null || encounterState == null
                ? null
                : new SavedEncounterCatalogModule(encounters, savedPlans, encounterState);
        EncounterTableCatalogModule tableModule = new EncounterTableCatalogModule(
                encounterTables, encounterTableCatalog, encounters, builderInputs);
        CatalogModule worldModule = worldPlannerApplication == null || worldPlanner == null
                ? null
                : new WorldPlannerBinder(
                        worldPlannerApplication,
                        encounters,
                        worldPlanner,
                        catalog,
                        encounterTableCatalog,
                        inspector).bindCatalog();
        Node unavailableControls = unavailable("In diesem Lauf nicht konfiguriert.");
        Node unavailableMain = unavailable("Keine Katalogdaten verfügbar.");
        Map<CatalogSection, CatalogWorkspaceView.Content> contents = new EnumMap<>(CatalogSection.class);
        contents.put(CatalogSection.MONSTERS, new CatalogWorkspaceView.Content(monsterControls, monsterMain));
        contents.put(CatalogSection.ITEMS, content(itemModule, unavailableControls, unavailableMain));
        contents.put(CatalogSection.ENCOUNTERS, content(savedModule, unavailableControls, unavailableMain));
        contents.put(CatalogSection.NPCS, worldContent(worldModule, unavailableControls, unavailableMain));
        contents.put(CatalogSection.FACTIONS, worldContent(worldModule, unavailableControls, unavailableMain));
        contents.put(CatalogSection.LOCATIONS, worldContent(worldModule, unavailableControls, unavailableMain));
        contents.put(CatalogSection.ENCOUNTER_TABLES,
                new CatalogWorkspaceView.Content(tableModule.controls(), tableModule.main()));
        CatalogModule boundWorldModule = worldModule;
        CatalogWorkspaceView workspace = new CatalogWorkspaceView(contents, section -> {
            if (section == CatalogSection.ITEMS && itemModule != null) {
                itemModule.activate();
            } else if (boundWorldModule != null) {
                activateWorldSection(boundWorldModule, section);
            }
        });
        return ShellBinding.cockpit("Katalog", workspace.controls(), workspace.main());
    }

    private static CatalogWorkspaceView.Content content(
            @Nullable ItemsCatalogModule module,
            Node unavailableControls,
            Node unavailableMain
    ) {
        return module == null
                ? new CatalogWorkspaceView.Content(unavailableControls, unavailableMain)
                : new CatalogWorkspaceView.Content(module.controls(), module.main());
    }

    private static CatalogWorkspaceView.Content content(
            @Nullable SavedEncounterCatalogModule module,
            Node unavailableControls,
            Node unavailableMain
    ) {
        return module == null
                ? new CatalogWorkspaceView.Content(unavailableControls, unavailableMain)
                : new CatalogWorkspaceView.Content(module.controls(), module.main());
    }

    private static CatalogWorkspaceView.Content worldContent(
            @Nullable CatalogModule module,
            Node unavailableControls,
            Node unavailableMain
    ) {
        return module == null
                ? new CatalogWorkspaceView.Content(unavailableControls, unavailableMain)
                : new CatalogWorkspaceView.Content(module.controls(), module.main());
    }

    private static void activateWorldSection(CatalogModule module, CatalogSection section) {
        if (section == CatalogSection.NPCS) {
            module.activateNpcs();
        } else if (section == CatalogSection.FACTIONS) {
            module.activateFactions();
        } else if (section == CatalogSection.LOCATIONS) {
            module.activateLocations();
        }
    }

    private static Node unavailable(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        return new VBox(label);
    }

}
