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
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
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
        EncounterSessionModel sessionModel = encounters.loadSession(new LoadEncounterSessionQuery());
        var filterOptionsModel = creatures.loadFilterOptionsModel(new LoadCreatureFilterOptionsQuery());
        var catalogModel = creatures.loadCatalogModel(CreatureCatalogQuery.defaults());
        var encounterTableModel = encounterTables.loadCatalogModel(new LoadEncounterTableSummariesQuery());
        var tuningPreviewModel = encounters.loadTuningPreviewModel(new LoadEncounterTuningPreviewQuery());

        CatalogContributionModel presentationModel = new CatalogContributionModel();
        CatalogIntentHandler intentHandler = new CatalogIntentHandler(presentationModel);
        CatalogControlsView controls = new CatalogControlsView(presentationModel);
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls, sessionModel, encounters);
        bindMain(main, presentationModel, intentHandler);

        presentationModel.searchCycleProperty().addListener((obs, before, after) -> runSearch(creatures, presentationModel));
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, after.longValue());
            presentationModel.clearCreatureDetailSelection();
        });

        filterOptionsModel.subscribe(presentationModel::applyCreatureFilterOptions);
        catalogModel.subscribe(presentationModel::applySearchResult);
        encounterTableModel.subscribe(presentationModel::applyEncounterTables);
        tuningPreviewModel.subscribe(result -> presentationModel.applyEncounterTuningPreview(result.labels()));
        sessionModel.subscribe(snapshot -> {
            if (presentationModel.applyEncounterBuilderInputs(builderInputs(snapshot))) {
                presentationModel.beginSearch();
                presentationModel.advanceSearchCycle();
            }
        });

        presentationModel.applyCreatureFilterOptions(filterOptionsModel.current());
        presentationModel.applyEncounterTables(encounterTableModel.current());
        presentationModel.applyEncounterTuningPreview(tuningPreviewModel.current().labels());
        presentationModel.applyEncounterBuilderInputs(currentBuilderInputs(sessionModel));

        creatures.loadFilterOptions(new LoadCreatureFilterOptionsQuery());
        encounterTables.loadSummaries(new LoadEncounterTableSummariesQuery());
        encounters.loadTuningPreview(new LoadEncounterTuningPreviewQuery());
        presentationModel.beginSearch();
        presentationModel.advanceSearchCycle();
        return new Binding(controls, main);
    }

    private static void bindControls(
            CatalogIntentHandler intentHandler,
            CatalogControlsView controls,
            EncounterSessionModel sessionModel,
            EncounterApplicationService encounters
    ) {
        controls.onViewInputEvent(intentHandler::consume);
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(encounters, sessionModel, event));
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
        CatalogContributionModel.CreatureFilters filters = presentationModel.currentFilters();
        CatalogContributionModel.SortOption sortOption = presentationModel.currentSortOption();
        creatures.searchCatalog(new CreatureCatalogQuery(
                filters.nameQuery(),
                filters.challengeRatingMin(),
                filters.challengeRatingMax(),
                filters.sizes(),
                filters.types(),
                filters.subtypes(),
                filters.biomes(),
                filters.alignments(),
                sortOption.field(),
                sortOption.direction(),
                presentationModel.currentPageSize(),
                presentationModel.currentPageOffset()));
    }

    private static EncounterSessionSnapshot.BuilderInputs currentBuilderInputs(
            EncounterSessionModel sessionModel
    ) {
        return builderInputs(sessionModel.current());
    }

    private static EncounterSessionSnapshot.BuilderInputs builderInputs(
            EncounterSessionSnapshot snapshot
    ) {
        EncounterSessionSnapshot safeSnapshot = snapshot == null ? EncounterSessionSnapshot.empty("") : snapshot;
        EncounterSessionSnapshot.BuilderState builderState = safeSnapshot.builderState();
        return builderState == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderState.builderInputs();
    }

    private static void updateBuilderInputs(
            EncounterApplicationService encounters,
            CatalogPublishedEvent event
    ) {
        encounters.applySession(new ApplyEncounterSessionCommand(
                ApplyEncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS,
                null,
                new EncounterSessionSnapshot.BuilderInputs(
                        event.creatureTypes(),
                        event.creatureSubtypes(),
                        event.biomes(),
                        toDifficultyBand(event.difficultyAuto(), event.difficultyValue()),
                        new EncounterGenerationTuning(
                                toBalanceLevel(event.balanceAuto(), event.balanceValue()),
                                toAmountValue(event.amountAuto(), event.amountValue()),
                                toDiversityLevel(event.diversityAuto(), event.diversityValue())),
                        event.encounterTableIds()),
                0L,
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

    private static void applyPublishedEvent(
            EncounterApplicationService encounters,
            EncounterSessionModel sessionModel,
            CatalogPublishedEvent event
    ) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case UPDATE_BUILDER_INPUTS -> updateBuilderInputs(encounters, event);
            case ADD_CREATURE -> encounters.applySession(
                    new ApplyEncounterSessionCommand(
                            ApplyEncounterSessionCommand.Action.ADD_CREATURE,
                            null,
                            currentBuilderInputs(sessionModel),
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

    private static EncounterDifficultyBand toDifficultyBand(boolean auto, double value) {
        if (auto) {
            return EncounterDifficultyBand.AUTO;
        }
        int rounded = (int) Math.round(value);
        if (rounded <= 1) {
            return EncounterDifficultyBand.EASY;
        }
        if (rounded == 3) {
            return EncounterDifficultyBand.HARD;
        }
        if (rounded >= 4) {
            return EncounterDifficultyBand.DEADLY;
        }
        return EncounterDifficultyBand.MEDIUM;
    }

    private static int toBalanceLevel(boolean auto, double value) {
        return auto ? EncounterGenerationTuning.AUTO_BALANCE_LEVEL : (int) Math.round(value);
    }

    private static double toAmountValue(boolean auto, double value) {
        return auto ? EncounterGenerationTuning.AUTO_AMOUNT_VALUE : value;
    }

    private static int toDiversityLevel(boolean auto, double value) {
        return auto ? EncounterGenerationTuning.AUTO_DIVERSITY_LEVEL : (int) Math.round(value);
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
