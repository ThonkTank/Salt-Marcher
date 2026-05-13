package src.view.leftbartabs.catalog;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.view.slotcontent.details.creature.CreatureDetailsContentModel;
import src.view.slotcontent.details.creature.CreatureDetailsView;

final class CatalogBinder {

    private final ShellRuntimeContext runtimeContext;

    CatalogBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        RuntimeServices services = RuntimeLookup.services(runtimeContext);
        PublishedModels models = RuntimeLookup.models(runtimeContext);

        CatalogContributionModel presentationModel = new CatalogContributionModel();
        CatalogIntentHandler intentHandler =
                new CatalogIntentHandler(presentationModel, services.creatures(), services.encounters());
        CatalogControlsView controls = new CatalogControlsView(presentationModel.controlsContentModel());
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls);
        bindMain(main, presentationModel.mainContentModel(), intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), services.creatures(), models.detail(), after.longValue());
            presentationModel.setCreatureDetailSelection(0L);
        });

        models.filterOptions().subscribe(presentationModel::applyCreatureFilterOptions);
        models.catalog().subscribe(presentationModel::applySearchResult);
        models.encounterTables().subscribe(presentationModel::applyEncounterTables);
        models.tuningPreview().subscribe(result -> presentationModel.applyEncounterTuningPreview(result.labels()));
        models.builderInputs().subscribe(builderInputs -> {
            if (presentationModel.applyEncounterBuilderInputs(builderInputs)) {
                runSearch(services.creatures(), presentationModel.currentSearchRequest());
            }
        });

        presentationModel.applyCreatureFilterOptions(models.filterOptions().current());
        presentationModel.applyEncounterTables(models.encounterTables().current());
        presentationModel.applyEncounterTuningPreview(models.tuningPreview().current().labels());
        presentationModel.applyEncounterBuilderInputs(models.builderInputs().current());

        services.creatures().refreshFilterOptions(new RefreshCreatureFilterOptionsCommand());
        services.encounterTables().refreshCatalog(new RefreshEncounterTableCatalogCommand());
        runSearch(services.creatures(), presentationModel.currentSearchRequest());
        return new Binding(controls, main);
    }

    private static void bindControls(CatalogIntentHandler intentHandler, CatalogControlsView controls) {
        controls.onViewInputEvent(intentHandler::consume);
    }

    private static void bindMain(
            CatalogMainView main,
            CatalogMainContentModel contentModel,
            CatalogIntentHandler intentHandler
    ) {
        main.bind(contentModel);
        main.onViewInputEvent(intentHandler::consume);
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            CreatureDetailModel detailModel,
            long creatureId
    ) {
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        inspector.push(new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> creatureDetailsContent(detailModel.current()),
                null));
    }

    private static Node creatureDetailsContent(CreatureDetailResult detailResult) {
        CreatureDetailsView detailView = new CreatureDetailsView();
        CreatureDetailsContentModel contentModel = new CreatureDetailsContentModel(detailResult);
        detailView.bind(contentModel);
        contentModel.load();
        return detailView;
    }

    private static void runSearch(
            CreaturesApplicationService creatures,
            CatalogContributionModel.SearchRequest request
    ) {
        creatures.refreshCatalog(new RefreshCreatureCatalogCommand(
                request.nameQuery(),
                request.challengeRatingMin(),
                request.challengeRatingMax(),
                request.sizes(),
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                request.alignments(),
                request.sortField(),
                request.sortDirection(),
                50,
                request.pageOffset()));
    }

    private static final class RuntimeLookup {

        private static RuntimeServices services(ShellRuntimeContext runtimeContext) {
            return new RuntimeServices(
                    runtimeContext.services().require(CreaturesApplicationService.class),
                    runtimeContext.services().require(EncounterTableApplicationService.class),
                    runtimeContext.services().require(EncounterApplicationService.class));
        }

        private static PublishedModels models(ShellRuntimeContext runtimeContext) {
            return new PublishedModels(
                    runtimeContext.services().require(EncounterBuilderInputsModel.class),
                    runtimeContext.services().require(CreatureFilterOptionsModel.class),
                    runtimeContext.services().require(CreatureCatalogModel.class),
                    runtimeContext.services().require(CreatureDetailModel.class),
                    runtimeContext.services().require(EncounterTableCatalogModel.class),
                    runtimeContext.services().require(EncounterTuningPreviewModel.class));
        }
    }

    private record RuntimeServices(
            CreaturesApplicationService creatures,
            EncounterTableApplicationService encounterTables,
            EncounterApplicationService encounters
    ) {
    }

    private record PublishedModels(
            EncounterBuilderInputsModel builderInputs,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            CreatureDetailModel detail,
            EncounterTableCatalogModel encounterTables,
            EncounterTuningPreviewModel tuningPreview
    ) {
    }

    private record Binding(Node controls, Node main) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter-Planer";
        }

        @Override
        public String navigationLabel() {
            return "";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
