package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.creatures.published.LoadCreatureFilterOptionsQuery;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.LoadEncounterBuilderInputsQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;

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
                encounters.loadBuilderInputsModel(new LoadEncounterBuilderInputsQuery());
        var filterOptionsModel = creatures.loadFilterOptionsModel(new LoadCreatureFilterOptionsQuery());
        var catalogModel = creatures.loadCatalogModel(CreatureCatalogQuery.defaults());
        var encounterTableModel = encounterTables.loadCatalogModel(new LoadEncounterTableSummariesQuery());
        var tuningPreviewModel = encounters.loadTuningPreviewModel(new LoadEncounterTuningPreviewQuery());

        CatalogContributionModel presentationModel = new CatalogContributionModel();
        CatalogIntentHandler intentHandler = new CatalogIntentHandler(presentationModel);
        CatalogControlsView controls = new CatalogControlsView(presentationModel);
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls, encounters);
        bindMain(main, presentationModel, intentHandler);

        presentationModel.searchCycleProperty().addListener((obs, before, after) -> runSearch(creatures, presentationModel));
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, after.longValue());
            presentationModel.setCreatureDetailSelection(0L);
        });

        filterOptionsModel.subscribe(presentationModel::applyCreatureFilterOptions);
        catalogModel.subscribe(presentationModel::applySearchResult);
        encounterTableModel.subscribe(presentationModel::applyEncounterTables);
        tuningPreviewModel.subscribe(result -> presentationModel.applyEncounterTuningPreview(result.labels()));
        builderInputsModel.subscribe(builderInputs -> {
            if (presentationModel.applyEncounterBuilderInputs(builderInputs)) {
                presentationModel.requestSearch();
            }
        });

        presentationModel.applyCreatureFilterOptions(filterOptionsModel.current());
        presentationModel.applyEncounterTables(encounterTableModel.current());
        presentationModel.applyEncounterTuningPreview(tuningPreviewModel.current().labels());
        presentationModel.applyEncounterBuilderInputs(builderInputsModel.current());

        creatures.loadFilterOptions(new LoadCreatureFilterOptionsQuery());
        encounterTables.loadSummaries(new LoadEncounterTableSummariesQuery());
        encounters.loadTuningPreview(new LoadEncounterTuningPreviewQuery());
        presentationModel.requestSearch();
        return new Binding(controls, main);
    }

    private static void bindControls(
            CatalogIntentHandler intentHandler,
            CatalogControlsView controls,
            EncounterApplicationService encounters
    ) {
        controls.onViewInputEvent(intentHandler::consume);
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(encounters, event));
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
            long creatureId
    ) {
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                id -> creatures.loadCreatureDetail(new LoadCreatureDetailQuery(id))));
    }

    private static void runSearch(
            CreaturesApplicationService creatures,
            CatalogContributionModel presentationModel
    ) {
        CatalogContributionModel.SearchRequest request = presentationModel.currentSearchRequest();
        creatures.searchCatalog(new CreatureCatalogQuery(
                request.nameQuery(),
                request.challengeRatingMin(),
                request.challengeRatingMax(),
                request.sizes(),
                request.types(),
                request.subtypes(),
                request.biomes(),
                request.alignments(),
                request.sortField(),
                request.sortDirection(),
                request.pageSize(),
                request.pageOffset()));
    }

    private static void updateBuilderInputs(
            EncounterApplicationService encounters,
            CatalogPublishedEvent event
    ) {
        encounters.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(
                new EncounterBuilderInputs(
                        event.creatureTypes(),
                        event.creatureSubtypes(),
                        event.biomes(),
                        event.difficultyAuto(),
                        toDifficultyLevel(event.difficultyValue()),
                        event.balanceAuto(),
                        toBalanceLevel(event.balanceValue()),
                        event.amountAuto(),
                        event.amountValue(),
                        event.diversityAuto(),
                        toDiversityLevel(event.diversityValue()),
                        event.encounterTableIds())));
    }

    private static void applyPublishedEvent(
            EncounterApplicationService encounters,
            CatalogPublishedEvent event
    ) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case UPDATE_BUILDER_INPUTS -> updateBuilderInputs(encounters, event);
            case ADD_CREATURE -> encounters.applyState(new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADD_CREATURE,
                    event.creatureId(),
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false));
        }
    }

    private static int toDifficultyLevel(double value) {
        int rounded = (int) Math.round(value);
        if (rounded <= 1) {
            return 1;
        }
        if (rounded == 3) {
            return 3;
        }
        if (rounded >= 4) {
            return 4;
        }
        return 2;
    }

    private static int toBalanceLevel(double value) {
        return (int) Math.round(value);
    }

    private static int toDiversityLevel(double value) {
        return (int) Math.round(value);
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
