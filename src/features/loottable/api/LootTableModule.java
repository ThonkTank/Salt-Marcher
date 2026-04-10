package features.loottable.api;

import features.items.catalog.CatalogObject;
import features.items.catalog.input.LoadFilterOptionsInput;
import features.items.api.ItemCatalogService;
import javafx.concurrent.Task;
import features.loottable.ui.LootTableEditorView;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

@SuppressWarnings("unused")
public final class LootTableModule {
    private static final CatalogObject ITEM_CATALOG = new CatalogObject();

    private final LootTableEditorView editorView;

    public LootTableModule() {
        this.editorView = new LootTableEditorView();
    }

    public void start(DetailsNavigator detailsNavigator) {
        editorView.setDetailsNavigator(detailsNavigator);
        Task<LoadFilterOptionsInput.LoadedFilterOptionsInput> itemFilterTask = new Task<>() {
            @Override protected LoadFilterOptionsInput.LoadedFilterOptionsInput call() {
                return ITEM_CATALOG.loadFilterOptions(new LoadFilterOptionsInput());
            }
        };
        UiAsyncTasks.submit(
                itemFilterTask,
                result -> {
                    if (!result.success()) {
                        UiErrorReporter.reportBackgroundFailure(
                                "LootTableModule.start() loadItemFilterOptions failed",
                                new IllegalStateException("CatalogObject.loadFilterOptions() failed"));
                    }
                    ItemCatalogService.FilterOptions filterData = new ItemCatalogService.FilterOptions(
                            result.categories(),
                            result.subcategories(),
                            result.rarities(),
                            result.tags(),
                            result.sources());
                    if (filterData == null) {
                        UiErrorReporter.reportBackgroundFailure(
                                "LootTableModule.start() loadItemFilterOptions returned null value",
                                null);
                        return;
                    }
                    editorView.setFilterData(filterData);
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("LootTableModule.start()", throwable));
    }

    public AppView view() {
        return editorView;
    }
}
