package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.beans.property.ReadOnlyListProperty;
import javafx.collections.ListChangeListener;
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

        bindControls(presentationModel, intentHandler, controls, sessionModel, encounters);
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
            encounters.loadTuningPreview(new LoadEncounterTuningPreviewQuery());
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
            CatalogContributionModel presentationModel,
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
        main.setRowAction("+Add", "Zum Encounter hinzufügen", true);
        main.setSortOptions(presentationModel.sortOptionsProperty().stream().map(CatalogBinder::toMainSort).toList());
        main.selectSort(presentationModel.selectedSortKeyProperty().get());
        main.setColumns(presentationModel.columnsProperty().stream().map(CatalogBinder::toMainColumn).toList());
        ReadOnlyListProperty<CatalogContributionModel.CatalogRow> rows = presentationModel.rowsProperty();
        main.setRows(rows.stream().map(CatalogBinder::toMainRow).toList());
        main.setPlaceholderText(presentationModel.placeholderTextProperty().get());
        main.onViewInputEvent(intentHandler::consume);
        main.countTextProperty().bind(presentationModel.countLabelProperty());
        main.pageTextProperty().bind(presentationModel.pageLabelProperty());
        main.previousDisableProperty().bind(presentationModel.previousPageAvailableProperty().not());
        main.nextDisableProperty().bind(presentationModel.nextPageAvailableProperty().not());
        rows.addListener((ListChangeListener<CatalogContributionModel.CatalogRow>) change ->
                main.setRows(rows.stream().map(CatalogBinder::toMainRow).toList()));
        presentationModel.placeholderTextProperty().addListener((obs, oldValue, newValue) -> main.setPlaceholderText(newValue));
        presentationModel.selectedSortKeyProperty().addListener((obs, oldValue, newValue) -> main.selectSort(newValue));
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
                        toDifficultyBand(event.difficultyKey()),
                        new EncounterGenerationTuning(
                                event.balanceLevel(),
                                event.amountValue(),
                                event.diversityLevel()),
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

    private static CatalogMainView.ColumnItem toMainColumn(CatalogContributionModel.CatalogColumn column) {
        return new CatalogMainView.ColumnItem(column.key(), column.label());
    }

    private static CatalogMainView.SortSelection toMainSort(CatalogContributionModel.SortSelection selection) {
        return new CatalogMainView.SortSelection(selection.key(), selection.label());
    }

    private static CatalogMainView.RowItem toMainRow(CatalogContributionModel.CatalogRow row) {
        return new CatalogMainView.RowItem(row.id(), row.cells());
    }

    private static EncounterDifficultyBand toDifficultyBand(String key) {
        if ("auto".equals(key)) {
            return EncounterDifficultyBand.AUTO;
        }
        if ("easy".equals(key)) {
            return EncounterDifficultyBand.EASY;
        }
        if ("hard".equals(key)) {
            return EncounterDifficultyBand.HARD;
        }
        if ("deadly".equals(key)) {
            return EncounterDifficultyBand.DEADLY;
        }
        return EncounterDifficultyBand.MEDIUM;
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
