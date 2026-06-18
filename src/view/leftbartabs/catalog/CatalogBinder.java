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
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
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
                new CatalogIntentHandler(
                        presentationModel,
                        services.creatures(),
                        services.encounterTables(),
                        services.encounters());
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls, presentationModel.controlsContentModel());
        bindMain(main, presentationModel.mainContentModel(), intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), models.detail(), after.longValue());
            presentationModel.setCreatureDetailSelection(0L);
        });

        models.filterOptions().subscribe(presentationModel.controlsContentModel()::applyCreatureFilterOptions);
        models.catalog().subscribe(presentationModel.mainContentModel()::applySearchResult);
        models.encounterTables().subscribe(presentationModel.controlsContentModel()::applyEncounterTables);
        models.tuningPreview().subscribe(result ->
                presentationModel.controlsContentModel().applyEncounterTuningPreview(result.labels()));
        models.builderInputs().subscribe(intentHandler::applyEncounterBuilderInputs);

        presentationModel.controlsContentModel().applyCreatureFilterOptions(models.filterOptions().current());
        presentationModel.mainContentModel().applySearchResult(models.catalog().current());
        presentationModel.controlsContentModel().applyEncounterTables(models.encounterTables().current());
        presentationModel.controlsContentModel().applyEncounterTuningPreview(models.tuningPreview().current().labels());
        intentHandler.applyEncounterBuilderInputs(models.builderInputs().current());
        return new Binding(controls, main);
    }

    private static void bindControls(
            CatalogIntentHandler intentHandler,
            CatalogControlsView controls,
            CatalogControlsContentModel contentModel
    ) {
        controls.bind(contentModel);
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
            CreatureDetailModel detailModel,
            long creatureId
    ) {
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
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
