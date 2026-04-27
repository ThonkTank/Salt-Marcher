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
import src.view.slotcontent.controls.catalog.CatalogControlsView;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;
import src.view.slotcontent.main.catalog.CatalogMainView;

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
        CatalogPresentationModel presentationModel = new CatalogPresentationModel();
        CatalogIntentHandler intentHandler = new CatalogIntentHandler(presentationModel);
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();
        bindCatalogRequests(creatures, intentHandler, presentationModel);
        bindControls(presentationModel, intentHandler, controls, sessionModel, encounterTables, encounters);
        bindMain(runtimeContext.inspector(), creatures, encounters, presentationModel, intentHandler, main);
        intentHandler.loadInitial();
        applySessionCreatureFilters(intentHandler, currentBuilderInputs(sessionModel));
        return new Binding(controls, main);
    }

    private static void bindCatalogRequests(
            CreaturesApplicationService creatures,
            CatalogIntentHandler intentHandler,
            CatalogPresentationModel presentationModel
    ) {
        intentHandler.onLoadFilterOptions(() -> presentationModel.applyCreatureFilterOptions(
                creatures.loadFilterOptions(new LoadCreatureFilterOptionsQuery())));
        intentHandler.onSearchRequested(searchInput -> {
            CatalogPresentationModel.SearchInput safeInput = searchInput == null
                    ? new CatalogPresentationModel.SearchInput(
                            CatalogPresentationModel.CreatureFilters.empty(),
                            CatalogPresentationModel.SortOption.NAME_ASC,
                            50,
                            0)
                    : searchInput;
            CatalogPresentationModel.CreatureFilters filters = safeInput.filters();
            CatalogPresentationModel.SortOption sortOption = safeInput.sortOption();
            presentationModel.applySearchResult(creatures.searchCatalog(new CreatureCatalogQuery(
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
                    safeInput.pageSize(),
                    safeInput.pageOffset())));
        });
    }

    private static void bindControls(
            CatalogPresentationModel presentationModel,
            CatalogIntentHandler intentHandler,
            CatalogControlsView controls,
            EncounterSessionModel sessionModel,
            EncounterTableApplicationService encounterTables,
            EncounterApplicationService encounters
    ) {
        controls.setCreatureFilterData(toControlFilterData(presentationModel.creatureFilterDataProperty().get()));
        ObservableList<CatalogPresentationModel.FilterChip> chips = presentationModel.chips();
        controls.setChips(toControlChips(chips));
        controls.setEncounterTables(loadEncounterTableSelections(encounterTables));
        applyEncounterBuilderInputs(controls, currentBuilderInputs(sessionModel));
        refreshTuningPreview(controls, encounters);

        controls.setOnCreatureFiltersChanged(filter -> {
            updateBuilderInputs(encounters, sessionModel, current -> new EncounterSessionSnapshot.BuilderInputs(
                    filter.types(),
                    filter.subtypes(),
                    filter.biomes(),
                    current.targetDifficulty(),
                    current.tuning(),
                    current.encounterTableIds()));
            intentHandler.applyCreatureFilters(new CatalogPresentationModel.CreatureFilters(
                        filter.nameQuery(),
                        filter.challengeRatingMin(),
                        filter.challengeRatingMax(),
                        filter.sizes(),
                        filter.types(),
                        filter.subtypes(),
                        filter.biomes(),
                        filter.alignments()));
        });
        controls.setOnEncounterDifficultyChanged(key -> updateBuilderInputs(
                encounters,
                sessionModel,
                current -> new EncounterSessionSnapshot.BuilderInputs(
                        current.creatureTypes(),
                        current.creatureSubtypes(),
                        current.biomes(),
                        toDifficultyBand(key),
                        current.tuning(),
                        current.encounterTableIds())));
        controls.setOnEncounterTuningChanged(selection -> updateBuilderInputs(
                encounters,
                sessionModel,
                current -> new EncounterSessionSnapshot.BuilderInputs(
                        current.creatureTypes(),
                        current.creatureSubtypes(),
                        current.biomes(),
                        current.targetDifficulty(),
                        new src.domain.encounter.published.EncounterGenerationTuning(
                                selection.balanceLevel(),
                                selection.amountValue(),
                                selection.diversityLevel()),
                        current.encounterTableIds())));
        controls.setOnEncounterTablesChanged(tableIds -> updateBuilderInputs(
                encounters,
                sessionModel,
                current -> new EncounterSessionSnapshot.BuilderInputs(
                        current.creatureTypes(),
                        current.creatureSubtypes(),
                        current.biomes(),
                        current.targetDifficulty(),
                        current.tuning(),
                        tableIds)));

        presentationModel.creatureFilterDataProperty().addListener((obs, oldValue, newValue) -> {
            controls.setCreatureFilterData(toControlFilterData(newValue));
            applyEncounterBuilderInputs(controls, currentBuilderInputs(sessionModel));
        });
        chips.addListener((ListChangeListener<CatalogPresentationModel.FilterChip>) change ->
                controls.setChips(toControlChips(chips)));
        sessionModel.subscribe(snapshot -> {
            applyEncounterBuilderInputs(controls, builderInputs(snapshot));
            refreshTuningPreview(controls, encounters);
        });
    }

    private static void bindMain(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            EncounterApplicationService encounters,
            CatalogPresentationModel presentationModel,
            CatalogIntentHandler intentHandler,
            CatalogMainView main
    ) {
        main.setRowAction("+Add", "Zum Encounter hinzufuegen", creatureId -> encounters.applySession(
                new ApplyEncounterSessionCommand(
                        ApplyEncounterSessionCommand.Action.ADD_CREATURE,
                        null,
                        EncounterSessionSnapshot.BuilderInputs.empty(),
                        creatureId,
                        0L,
                        0,
                        0L,
                        List.of(),
                        "",
                        0,
                        0L,
                        0,
                        false)));
        main.setSortOptions(presentationModel.sortOptions().stream().map(CatalogBinder::toMainSort).toList());
        main.selectSort(presentationModel.selectedSortKeyProperty().get());
        main.setColumns(presentationModel.columns().stream().map(CatalogBinder::toMainColumn).toList());
        ObservableList<CatalogPresentationModel.CatalogRow> rows = presentationModel.rows();
        main.setRows(rows.stream().map(CatalogBinder::toMainRow).toList());
        main.setPlaceholderText(presentationModel.placeholderTextProperty().get());
        main.setOnRowOpen(creatureId -> openCreatureDetails(inspector, creatures, creatureId));
        main.countTextProperty().bind(presentationModel.countLabelProperty());
        main.pageTextProperty().bind(presentationModel.pageLabelProperty());
        main.previousDisableProperty().bind(presentationModel.previousPageAvailableProperty().not());
        main.nextDisableProperty().bind(presentationModel.nextPageAvailableProperty().not());
        main.setOnSortChanged(intentHandler::selectSort);
        main.setOnPreviousPage(intentHandler::previousPage);
        main.setOnNextPage(intentHandler::nextPage);
        rows.addListener((ListChangeListener<CatalogPresentationModel.CatalogRow>) change ->
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
            CatalogPresentationModel.CreatureFilterData options
    ) {
        CatalogPresentationModel.CreatureFilterData safeOptions = options == null
                ? CatalogPresentationModel.CreatureFilterData.empty()
                : options;
        return new CatalogControlsView.CreatureFilterData(
                safeOptions.sizes(),
                safeOptions.types(),
                safeOptions.subtypes(),
                safeOptions.biomes(),
                safeOptions.alignments(),
                safeOptions.challengeRatings());
    }

    private static List<CatalogControlsView.EncounterTableSelection> loadEncounterTableSelections(
            EncounterTableApplicationService encounterTables
    ) {
        EncounterTableCatalogResult result = encounterTables.loadSummaries(new LoadEncounterTableSummariesQuery());
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
            List<CatalogPresentationModel.FilterChip> chips
    ) {
        return chips.stream()
                .map(chip -> new CatalogControlsView.FilterChipView(chip.key(), chip.label(), chip.styleClass()))
                .toList();
    }

    private static void refreshTuningPreview(
            CatalogControlsView controls,
            EncounterApplicationService encounters
    ) {
        controls.setEncounterTuningPreview(toControlTuningPreview(
                encounters.loadTuningPreview(new LoadEncounterTuningPreviewQuery()).labels()));
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
            CatalogIntentHandler intentHandler,
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        intentHandler.applyCreatureFilters(new CatalogPresentationModel.CreatureFilters(
                null,
                null,
                null,
                List.of(),
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                List.of()));
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

    private static CatalogMainView.ColumnItem toMainColumn(CatalogPresentationModel.CatalogColumn column) {
        return new CatalogMainView.ColumnItem(column.key(), column.label());
    }

    private static CatalogMainView.SortSelection toMainSort(CatalogPresentationModel.SortSelection selection) {
        return new CatalogMainView.SortSelection(selection.key(), selection.label());
    }

    private static CatalogMainView.RowItem toMainRow(CatalogPresentationModel.CatalogRow row) {
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
