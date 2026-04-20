package src.view.tabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureFilterOptions;
import src.view.details.creature.CreatureDetailsView;
import src.view.details.creature.CreatureDetailsViewModel;

public final class CatalogContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public CatalogContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                null,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        ShellRuntimeContext safeRuntimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
        CreaturesApplicationService creatures = safeRuntimeContext.services().require(CreaturesApplicationService.class);
        CatalogViewModel viewModel = new CatalogViewModel(creatures);
        CatalogControlsView controls = new CatalogControlsView();
        CatalogMainView main = new CatalogMainView();
        bindControls(viewModel, controls);
        bindMain(safeRuntimeContext.inspector(), creatures, viewModel, main);
        viewModel.loadInitial();
        return new Binding(controls, main);
    }

    private static void bindControls(CatalogViewModel viewModel, CatalogControlsView controls) {
        controls.setContents(viewModel.contents().stream().map(CatalogContribution::toControlContent).toList());
        controls.setSortOptions(viewModel.sortOptions().stream().map(CatalogContribution::toControlSort).toList());
        controls.selectSort(viewModel.selectedSortKeyProperty().get());
        controls.selectContent(viewModel.selectedContentProperty().get().key());
        controls.setCreatureFilterData(toControlFilterData(viewModel.creatureFilterOptionsProperty().get()));
        controls.setChips(toControlChips(viewModel.chips()));

        controls.countTextProperty().bind(viewModel.countLabelProperty());
        controls.pageTextProperty().bind(viewModel.pageLabelProperty());
        controls.previousDisableProperty().bind(viewModel.previousPageAvailableProperty().not());
        controls.nextDisableProperty().bind(viewModel.nextPageAvailableProperty().not());
        controls.setOnContentSelected(viewModel::selectContent);
        controls.setOnCreatureFiltersChanged(filter ->
                viewModel.applyCreatureFilters(new CatalogViewModel.CreatureFilters(
                        filter.nameQuery(),
                        filter.challengeRatingMin(),
                        filter.challengeRatingMax(),
                        filter.sizes(),
                        filter.types(),
                        filter.subtypes(),
                        filter.biomes(),
                        filter.alignments())));
        controls.setOnSortChanged(viewModel::selectSort);
        controls.setOnPreviousPage(viewModel::previousPage);
        controls.setOnNextPage(viewModel::nextPage);

        viewModel.selectedContentProperty().addListener((obs, oldValue, newValue) -> controls.selectContent(newValue.key()));
        viewModel.selectedSortKeyProperty().addListener((obs, oldValue, newValue) -> controls.selectSort(newValue));
        viewModel.creatureFilterOptionsProperty().addListener((obs, oldValue, newValue) ->
                controls.setCreatureFilterData(toControlFilterData(newValue)));
        viewModel.chips().addListener((ListChangeListener<CatalogViewModel.FilterChip>) change ->
                controls.setChips(toControlChips(viewModel.chips())));
    }

    private static void bindMain(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            CatalogViewModel viewModel,
            CatalogMainView main
    ) {
        main.setColumns(viewModel.columns().stream().map(CatalogContribution::toMainColumn).toList());
        main.setRows(viewModel.rows().stream().map(CatalogContribution::toMainRow).toList());
        main.setPlaceholderText(viewModel.placeholderTextProperty().get());
        main.setOnRowOpen(creatureId -> openCreatureDetails(inspector, creatures, creatureId));
        viewModel.rows().addListener((ListChangeListener<CatalogViewModel.CatalogRow>) change ->
                main.setRows(viewModel.rows().stream().map(CatalogContribution::toMainRow).toList()));
        viewModel.placeholderTextProperty().addListener((obs, oldValue, newValue) -> main.setPlaceholderText(newValue));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        inspector.push(new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> detailNode(creatures, creatureId),
                null));
    }

    private static Node detailNode(CreaturesApplicationService creatures, long creatureId) {
        CreatureDetailsViewModel viewModel = new CreatureDetailsViewModel(creatures, creatureId);
        CreatureDetailsView view = new CreatureDetailsView();
        view.setLoadingText(viewModel.loadingTextProperty().get());
        view.setErrorText(viewModel.errorTextProperty().get());
        viewModel.detailProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue != null) {
                view.showDetail(toViewDetail(newValue));
            }
        });
        viewModel.errorTextProperty().addListener((obs, oldValue, newValue) -> view.setErrorText(newValue));
        viewModel.loadingTextProperty().addListener((obs, oldValue, newValue) -> view.setLoadingText(newValue));
        viewModel.load();
        CreatureDetailsViewModel.DetailPresentation detail = viewModel.detailProperty().get();
        if (detail != null) {
            view.showDetail(toViewDetail(detail));
        }
        return view;
    }

    private static CatalogControlsView.ContentItem toControlContent(CatalogViewModel.CatalogContent content) {
        return new CatalogControlsView.ContentItem(content.key(), content.label(), content.enabled());
    }

    private static CatalogControlsView.SortSelection toControlSort(CatalogViewModel.SortSelection selection) {
        return new CatalogControlsView.SortSelection(selection.key(), selection.label());
    }

    private static CatalogControlsView.CreatureFilterData toControlFilterData(CreatureFilterOptions options) {
        CreatureFilterOptions safeOptions = options == null ? CreatureFilterOptions.empty() : options;
        return new CatalogControlsView.CreatureFilterData(
                safeOptions.sizes(),
                safeOptions.types(),
                safeOptions.subtypes(),
                safeOptions.biomes(),
                safeOptions.alignments(),
                safeOptions.challengeRatings());
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

    private static CreatureDetailsView.DetailContent toViewDetail(CreatureDetailsViewModel.DetailPresentation detail) {
        return new CreatureDetailsView.DetailContent(
                detail.name(),
                detail.meta(),
                detail.coreProperties().stream()
                        .map(line -> new CreatureDetailsView.PropertyLine(line.label(), line.text()))
                        .toList(),
                detail.abilities().stream()
                        .map(ability -> new CreatureDetailsView.AbilityScore(ability.shortName(), ability.scoreText()))
                        .toList(),
                detail.properties().stream()
                        .map(line -> new CreatureDetailsView.PropertyLine(line.label(), line.text()))
                        .toList(),
                detail.sections().stream()
                        .map(section -> new CreatureDetailsView.ActionSection(
                                section.heading(),
                                section.leadText(),
                                section.actions().stream()
                                        .map(action -> new CreatureDetailsView.ActionLine(
                                                action.displayName(),
                                                action.bodyText()))
                                        .toList()))
                        .toList());
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
