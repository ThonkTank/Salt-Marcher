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

@SuppressWarnings("PMD.TooManyMethods")
final class CatalogBinder {

    private final ShellRuntimeContext runtimeContext;

    CatalogBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterTableApplicationService encounterTables =
                runtimeContext.services().require(EncounterTableApplicationService.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterBuilderInputsModel builderInputsModel =
                runtimeContext.services().require(EncounterBuilderInputsModel.class);
        CreatureFilterOptionsModel filterOptionsModel =
                runtimeContext.services().require(CreatureFilterOptionsModel.class);
        CreatureCatalogModel catalogModel = runtimeContext.services().require(CreatureCatalogModel.class);
        CreatureDetailModel detailModel = runtimeContext.services().require(CreatureDetailModel.class);
        EncounterTableCatalogModel encounterTableModel =
                runtimeContext.services().require(EncounterTableCatalogModel.class);
        EncounterTuningPreviewModel tuningPreviewModel =
                runtimeContext.services().require(EncounterTuningPreviewModel.class);

        CatalogContributionModel presentationModel = new CatalogContributionModel();
        CatalogIntentHandler intentHandler = new CatalogIntentHandler(presentationModel, creatures, encounters);
        CatalogControlsView controls = new CatalogControlsView(presentationModel);
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls);
        bindMain(main, presentationModel, intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, detailModel, after.longValue());
            presentationModel.setCreatureDetailSelection(0L);
        });

        filterOptionsModel.subscribe(presentationModel::applyCreatureFilterOptions);
        catalogModel.subscribe(presentationModel::applySearchResult);
        encounterTableModel.subscribe(presentationModel::applyEncounterTables);
        tuningPreviewModel.subscribe(result -> presentationModel.applyEncounterTuningPreview(result.labels()));
        builderInputsModel.subscribe(builderInputs -> {
            if (presentationModel.applyEncounterBuilderInputs(builderInputs)) {
                runSearch(creatures, presentationModel.currentSearchRequest());
            }
        });

        presentationModel.applyCreatureFilterOptions(filterOptionsModel.current());
        presentationModel.applyEncounterTables(encounterTableModel.current());
        presentationModel.applyEncounterTuningPreview(tuningPreviewModel.current().labels());
        presentationModel.applyEncounterBuilderInputs(builderInputsModel.current());

        creatures.refreshFilterOptions(new RefreshCreatureFilterOptionsCommand());
        encounterTables.refreshCatalog(new RefreshEncounterTableCatalogCommand());
        runSearch(creatures, presentationModel.currentSearchRequest());
        return new Binding(controls, main);
    }

    private static void bindControls(CatalogIntentHandler intentHandler, CatalogControlsView controls) {
        controls.onViewInputEvent(intentHandler::consume);
    }

    private static void bindMain(
            CatalogMainView main,
            CatalogContributionModel presentationModel,
            CatalogIntentHandler intentHandler
    ) {
        main.bind(presentationModel);
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
