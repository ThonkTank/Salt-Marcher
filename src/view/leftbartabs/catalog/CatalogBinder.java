package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
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
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
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
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();
        bindControls(
                presentationModel,
                intentHandler,
                controls,
                sessionModel,
                encounters);
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
        encounterTableModel.subscribe(result -> controls.setEncounterTables(toEncounterTableSelections(result)));
        tuningPreviewModel.subscribe(result ->
                controls.setEncounterTuningPreview(toControlTuningPreview(result.labels())));
        applySessionCreatureFilters(presentationModel, currentBuilderInputs(sessionModel));
        presentationModel.applyCreatureFilterOptions(filterOptionsModel.current());
        controls.setEncounterTables(toEncounterTableSelections(encounterTableModel.current()));
        controls.setEncounterTuningPreview(toControlTuningPreview(tuningPreviewModel.current().labels()));
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
        controls.setCreatureFilterData(toControlFilterData(presentationModel.creatureFilterDataProperty().get()));
        ObservableList<CatalogContributionModel.FilterChip> chips = presentationModel.chips();
        controls.setChips(toControlChips(chips));
        applyEncounterBuilderInputs(controls, currentBuilderInputs(sessionModel));
        controls.onViewInputEvent(intentHandler::consume);
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(encounters, sessionModel, event));

        presentationModel.creatureFilterDataProperty().addListener((obs, oldValue, newValue) -> {
            controls.setCreatureFilterData(toControlFilterData(newValue));
            applyEncounterBuilderInputs(controls, currentBuilderInputs(sessionModel));
        });
        chips.addListener((ListChangeListener<CatalogContributionModel.FilterChip>) change ->
                controls.setChips(toControlChips(chips)));
        sessionModel.subscribe(snapshot -> {
            applyEncounterBuilderInputs(controls, builderInputs(snapshot));
            requestTuningPreview(encounters);
        });
    }

    private static void bindMain(
            CatalogMainView main,
            CatalogContributionModel presentationModel,
            CatalogIntentHandler intentHandler
    ) {
        main.setRowAction("+Add", "Zum Encounter hinzufuegen", true);
        main.setSortOptions(presentationModel.sortOptions().stream().map(CatalogBinder::toMainSort).toList());
        main.selectSort(presentationModel.selectedSortKeyProperty().get());
        main.setColumns(presentationModel.columns().stream().map(CatalogBinder::toMainColumn).toList());
        ObservableList<CatalogContributionModel.CatalogRow> rows = presentationModel.rows();
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

    private static CatalogControlsView.CreatureFilterData toControlFilterData(
            CatalogContributionModel.CreatureFilterData options
    ) {
        CatalogContributionModel.CreatureFilterData safeOptions = options == null
                ? CatalogContributionModel.CreatureFilterData.empty()
                : options;
        return new CatalogControlsView.CreatureFilterData(
                safeOptions.sizes(),
                safeOptions.types(),
                safeOptions.subtypes(),
                safeOptions.biomes(),
                safeOptions.alignments(),
                safeOptions.challengeRatings());
    }

    private static List<CatalogControlsView.EncounterTableSelection> toEncounterTableSelections(
            EncounterTableCatalogResult result
    ) {
        if (result.status() != EncounterTableReadStatus.SUCCESS) {
            return List.of();
        }
        return result.tables().stream()
                .map(CatalogBinder::toEncounterTableSelection)
                .toList();
    }

    private static CatalogControlsView.EncounterTableSelection toEncounterTableSelection(
            EncounterTableSummary summary
    ) {
        return new CatalogControlsView.EncounterTableSelection(
                summary.tableId(),
                summary.name(),
                summary.linkedLootTableId());
    }

    private static List<CatalogControlsView.FilterChipView> toControlChips(
            List<CatalogContributionModel.FilterChip> chips
    ) {
        return chips.stream()
                .map(chip -> new CatalogControlsView.FilterChipView(chip.key(), chip.label(), chip.styleClass()))
                .toList();
    }

    private static void requestTuningPreview(
            EncounterApplicationService encounters
    ) {
        encounters.loadTuningPreview(new LoadEncounterTuningPreviewQuery());
    }

    private static void applyEncounterBuilderInputs(
            CatalogControlsView controls,
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        controls.applyEncounterBuilderInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                difficultyKey(safeInputs.targetDifficulty()),
                new CatalogControlsView.EncounterTuningSelection(
                        safeInputs.tuning().balanceLevel(),
                        safeInputs.tuning().amountValue(),
                        safeInputs.tuning().diversityLevel()),
                safeInputs.encounterTableIds());
    }

    private static void applySessionCreatureFilters(
            CatalogContributionModel presentationModel,
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        presentationModel.applyCreatureFilters(new CatalogContributionModel.CreatureFilters(
                "",
                "",
                "",
                List.of(),
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                List.of()));
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
            EncounterSessionModel sessionModel,
            UnaryOperator<EncounterSessionSnapshot.BuilderInputs> update
    ) {
        EncounterSessionSnapshot.BuilderInputs current = currentBuilderInputs(sessionModel);
        EncounterSessionSnapshot.BuilderInputs next = update.apply(current);
        encounters.applySession(new ApplyEncounterSessionCommand(
                ApplyEncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS,
                null,
                next,
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
            case UPDATE_CREATURE_FILTERS -> {
                updateBuilderInputs(encounters, sessionModel, current -> new EncounterSessionSnapshot.BuilderInputs(
                        event.creatureTypes(),
                        event.creatureSubtypes(),
                        event.biomes(),
                        current.targetDifficulty(),
                        current.tuning(),
                        current.encounterTableIds()));
            }
            case UPDATE_ENCOUNTER_DIFFICULTY -> updateBuilderInputs(
                    encounters,
                    sessionModel,
                    current -> new EncounterSessionSnapshot.BuilderInputs(
                            current.creatureTypes(),
                            current.creatureSubtypes(),
                            current.biomes(),
                            toDifficultyBand(event.difficultyKey()),
                            current.tuning(),
                            current.encounterTableIds()));
            case UPDATE_ENCOUNTER_TUNING -> updateBuilderInputs(
                    encounters,
                    sessionModel,
                    current -> new EncounterSessionSnapshot.BuilderInputs(
                            current.creatureTypes(),
                            current.creatureSubtypes(),
                            current.biomes(),
                            current.targetDifficulty(),
                            new src.domain.encounter.published.EncounterGenerationTuning(
                                    event.tuning().balanceLevel(),
                                    event.tuning().amountValue(),
                                    event.tuning().diversityLevel()),
                            current.encounterTableIds()));
            case UPDATE_ENCOUNTER_TABLES -> updateBuilderInputs(
                    encounters,
                    sessionModel,
                    current -> new EncounterSessionSnapshot.BuilderInputs(
                            current.creatureTypes(),
                            current.creatureSubtypes(),
                            current.biomes(),
                            current.targetDifficulty(),
                            current.tuning(),
                            event.encounterTableIds()));
            case ADD_CREATURE -> encounters.applySession(
                    new ApplyEncounterSessionCommand(
                            ApplyEncounterSessionCommand.Action.ADD_CREATURE,
                            null,
                            EncounterSessionSnapshot.BuilderInputs.empty(),
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

    private static CatalogControlsView.EncounterTuningPreview toControlTuningPreview(
            EncounterTuningPreviewLabels labels
    ) {
        EncounterTuningPreviewLabels safeLabels = labels == null
                ? new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of())
                : labels;
        return new CatalogControlsView.EncounterTuningPreview(
                toControlPreviewLabels(safeLabels.difficultyLabels()),
                toControlPreviewLabels(safeLabels.balanceLabels()),
                toControlPreviewLabels(safeLabels.amountLabels()),
                toControlPreviewLabels(safeLabels.diversityLabels()));
    }

    private static List<CatalogControlsView.SliderPreviewLabel> toControlPreviewLabels(
            List<EncounterTuningPreviewLabels.PreviewLabel> labels
    ) {
        return labels.stream()
                .map(label -> new CatalogControlsView.SliderPreviewLabel(label.value(), label.label()))
                .toList();
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

    private static String difficultyKey(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.AUTO : band) {
            case AUTO -> "auto";
            case EASY -> "easy";
            case MEDIUM -> "medium";
            case HARD -> "hard";
            case DEADLY -> "deadly";
        };
    }

    private record Binding(Node controls, Node main) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter Builder";
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
