package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;
import src.domain.party.PartyApplicationService;
import src.view.slotcontent.controls.catalog.CatalogControlsView;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;
import src.view.slotcontent.main.catalog.CatalogMainView;
import src.view.slotcontent.state.encounter.EncounterRuntimeViewModel;

final class CatalogBinder {

    private final ShellRuntimeContext runtimeContext;

    CatalogBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterTableApplicationService encounterTables =
                runtimeContext.services().require(EncounterTableApplicationService.class);
        EncounterApplicationService encounters = encounterService(creatures, encounterTables);
        EncounterRuntimeViewModel encounterSession = encounterSession();
        CatalogViewModel viewModel = new CatalogViewModel(creatures);
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();
        bindControls(viewModel, controls, encounterSession, encounterTables, encounters);
        bindMain(runtimeContext.inspector(), creatures, encounterSession, viewModel, main);
        viewModel.loadInitial();
        return new Binding(controls, main);
    }

    private EncounterApplicationService encounterService(
            CreaturesApplicationService creatures,
            EncounterTableApplicationService encounterTables
    ) {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        return new EncounterApplicationService(party, creatures, encounterTables);
    }

    private EncounterRuntimeViewModel encounterSession() {
        return runtimeContext.session(
                EncounterRuntimeViewModel.class,
                EncounterRuntimeViewModel::new);
    }

    private static void bindControls(
            CatalogViewModel viewModel,
            CatalogControlsView controls,
            EncounterRuntimeViewModel encounterSession,
            EncounterTableApplicationService encounterTables,
            EncounterApplicationService encounters
    ) {
        controls.setCreatureFilterData(toControlFilterData(viewModel.creatureFilterDataProperty().get()));
        ObservableList<CatalogViewModel.FilterChip> chips = viewModel.chips();
        controls.setChips(toControlChips(chips));
        controls.setEncounterTables(loadEncounterTableSelections(encounterTables));
        controls.selectEncounterTables(encounterSession.encounterTableIds());
        refreshTuningPreview(controls, encounters);

        controls.setOnCreatureFiltersChanged(filter -> {
            encounterSession.updateFilters(filter.types(), filter.subtypes(), filter.biomes());
            viewModel.applyCreatureFilters(new CatalogViewModel.CreatureFilters(
                        filter.nameQuery(),
                        filter.challengeRatingMin(),
                        filter.challengeRatingMax(),
                        filter.sizes(),
                        filter.types(),
                        filter.subtypes(),
                        filter.biomes(),
                        filter.alignments()));
        });
        controls.setOnEncounterDifficultyChanged(key -> encounterSession.selectDifficulty(toDifficultyBand(key)));
        controls.setOnEncounterTuningChanged(selection -> encounterSession.updateTuning(
                selection.balanceLevel(),
                selection.amountValue(),
                selection.diversityLevel()));
        controls.setOnEncounterTablesChanged(encounterSession::updateEncounterTables);

        viewModel.creatureFilterDataProperty().addListener((obs, oldValue, newValue) ->
                controls.setCreatureFilterData(toControlFilterData(newValue)));
        chips.addListener((ListChangeListener<CatalogViewModel.FilterChip>) change ->
                controls.setChips(toControlChips(chips)));
        encounterSession.partyRefreshTokenProperty().addListener((obs, oldValue, newValue) ->
                refreshTuningPreview(controls, encounters));
    }

    private static void bindMain(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            EncounterRuntimeViewModel encounterSession,
            CatalogViewModel viewModel,
            CatalogMainView main
    ) {
        main.setRowAction("+Add", "Zum Encounter hinzufuegen", encounterSession::requestCreatureAdd);
        main.setSortOptions(viewModel.sortOptions().stream().map(CatalogBinder::toMainSort).toList());
        main.selectSort(viewModel.selectedSortKeyProperty().get());
        main.setColumns(viewModel.columns().stream().map(CatalogBinder::toMainColumn).toList());
        ObservableList<CatalogViewModel.CatalogRow> rows = viewModel.rows();
        main.setRows(rows.stream().map(CatalogBinder::toMainRow).toList());
        main.setPlaceholderText(viewModel.placeholderTextProperty().get());
        main.setOnRowOpen(creatureId -> openCreatureDetails(inspector, creatures, creatureId));
        main.countTextProperty().bind(viewModel.countLabelProperty());
        main.pageTextProperty().bind(viewModel.pageLabelProperty());
        main.previousDisableProperty().bind(viewModel.previousPageAvailableProperty().not());
        main.nextDisableProperty().bind(viewModel.nextPageAvailableProperty().not());
        main.setOnSortChanged(viewModel::selectSort);
        main.setOnPreviousPage(viewModel::previousPage);
        main.setOnNextPage(viewModel::nextPage);
        rows.addListener((ListChangeListener<CatalogViewModel.CatalogRow>) change ->
                main.setRows(rows.stream().map(CatalogBinder::toMainRow).toList()));
        viewModel.placeholderTextProperty().addListener((obs, oldValue, newValue) -> main.setPlaceholderText(newValue));
        viewModel.selectedSortKeyProperty().addListener((obs, oldValue, newValue) -> main.selectSort(newValue));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        inspector.push(CreatureDetailsInspectorEntry.create(creatureId, creatures::loadCreatureDetail));
    }

    private static CatalogControlsView.CreatureFilterData toControlFilterData(CatalogViewModel.CreatureFilterData options) {
        CatalogViewModel.CreatureFilterData safeOptions = options == null
                ? CatalogViewModel.CreatureFilterData.empty()
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
            List<CatalogViewModel.FilterChip> chips
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

    private static CatalogMainView.ColumnItem toMainColumn(CatalogViewModel.CatalogColumn column) {
        return new CatalogMainView.ColumnItem(column.key(), column.label());
    }

    private static CatalogMainView.SortSelection toMainSort(CatalogViewModel.SortSelection selection) {
        return new CatalogMainView.SortSelection(selection.key(), selection.label());
    }

    private static CatalogMainView.RowItem toMainRow(CatalogViewModel.CatalogRow row) {
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
