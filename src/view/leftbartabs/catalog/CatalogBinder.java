package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;
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
        EncounterRuntimeViewModel encounterSession = runtimeContext.session(
                EncounterRuntimeViewModel.class,
                EncounterRuntimeViewModel::new);
        CatalogViewModel viewModel = new CatalogViewModel(creatures);
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();
        bindControls(viewModel, controls, encounterSession, encounterTables);
        bindMain(runtimeContext.inspector(), creatures, encounterSession, viewModel, main);
        viewModel.loadInitial();
        return new Binding(controls, main);
    }

    private static void bindControls(
            CatalogViewModel viewModel,
            CatalogControlsView controls,
            EncounterRuntimeViewModel encounterSession,
            EncounterTableApplicationService encounterTables
    ) {
        controls.setContents(viewModel.contents().stream().map(CatalogBinder::toControlContent).toList());
        controls.setSortOptions(viewModel.sortOptions().stream().map(CatalogBinder::toControlSort).toList());
        controls.selectSort(viewModel.selectedSortKeyProperty().get());
        controls.selectContent(viewModel.selectedContentProperty().get().key());
        controls.setCreatureFilterData(toControlFilterData(viewModel.creatureFilterDataProperty().get()));
        controls.setChips(toControlChips(viewModel.chips()));
        controls.setEncounterTables(loadEncounterTableSelections(encounterTables));
        controls.selectEncounterTables(encounterSession.encounterTableIds());

        controls.countTextProperty().bind(viewModel.countLabelProperty());
        controls.pageTextProperty().bind(viewModel.pageLabelProperty());
        controls.previousDisableProperty().bind(viewModel.previousPageAvailableProperty().not());
        controls.nextDisableProperty().bind(viewModel.nextPageAvailableProperty().not());
        controls.setOnContentSelected(viewModel::selectContent);
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
        controls.setOnSortChanged(viewModel::selectSort);
        controls.setOnEncounterDifficultyChanged(key -> encounterSession.selectDifficulty(toDifficultyBand(key)));
        controls.setOnEncounterTuningChanged(selection -> encounterSession.updateTuning(
                selection.balanceLevel(),
                selection.amountValue(),
                selection.diversityLevel()));
        controls.setOnEncounterTablesChanged(encounterSession::updateEncounterTables);
        controls.setOnPreviousPage(viewModel::previousPage);
        controls.setOnNextPage(viewModel::nextPage);

        viewModel.selectedContentProperty().addListener((obs, oldValue, newValue) -> controls.selectContent(newValue.key()));
        viewModel.selectedSortKeyProperty().addListener((obs, oldValue, newValue) -> controls.selectSort(newValue));
        viewModel.creatureFilterDataProperty().addListener((obs, oldValue, newValue) ->
                controls.setCreatureFilterData(toControlFilterData(newValue)));
        viewModel.chips().addListener((ListChangeListener<CatalogViewModel.FilterChip>) change ->
                controls.setChips(toControlChips(viewModel.chips())));
    }

    private static void bindMain(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            EncounterRuntimeViewModel encounterSession,
            CatalogViewModel viewModel,
            CatalogMainView main
    ) {
        main.setRowAction("+Add", "Zum Encounter hinzufuegen", encounterSession::requestCreatureAdd);
        main.setColumns(viewModel.columns().stream().map(CatalogBinder::toMainColumn).toList());
        main.setRows(viewModel.rows().stream().map(CatalogBinder::toMainRow).toList());
        main.setPlaceholderText(viewModel.placeholderTextProperty().get());
        main.setOnRowOpen(creatureId -> openCreatureDetails(inspector, creatures, creatureId));
        viewModel.rows().addListener((ListChangeListener<CatalogViewModel.CatalogRow>) change ->
                main.setRows(viewModel.rows().stream().map(CatalogBinder::toMainRow).toList()));
        viewModel.placeholderTextProperty().addListener((obs, oldValue, newValue) -> main.setPlaceholderText(newValue));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        inspector.push(CreatureDetailsInspectorEntry.create(creatureId, creatures::loadCreatureDetail));
    }

    private static CatalogControlsView.ContentItem toControlContent(CatalogViewModel.CatalogContent content) {
        return new CatalogControlsView.ContentItem(content.key(), content.label(), content.enabled());
    }

    private static CatalogControlsView.SortSelection toControlSort(CatalogViewModel.SortSelection selection) {
        return new CatalogControlsView.SortSelection(selection.key(), selection.label());
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

    private static CatalogMainView.ColumnItem toMainColumn(CatalogViewModel.CatalogColumn column) {
        return new CatalogMainView.ColumnItem(column.key(), column.label());
    }

    private static CatalogMainView.RowItem toMainRow(CatalogViewModel.CatalogRow row) {
        return new CatalogMainView.RowItem(row.id(), row.cells());
    }

    private static EncounterDifficultyBand toDifficultyBand(String key) {
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
            return "Catalog";
        }

        @Override
        public String navigationLabel() {
            return "Catalog";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
