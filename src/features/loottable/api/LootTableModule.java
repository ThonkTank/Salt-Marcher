package features.loottable.api;

import features.items.api.ItemCatalogService;
import javafx.concurrent.Task;
import features.loottable.ui.LootTableEditorView;
import javafx.scene.Node;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppView;

import java.util.function.BiConsumer;

public final class LootTableModule {

    private final LootTableEditorView editorView;

    public LootTableModule() {
        this.editorView = new LootTableEditorView();
    }

    public void start(BiConsumer<String, Node> inspectorContentHandler) {
        setInspectorContentHandler(inspectorContentHandler);
        Task<ItemCatalogService.ServiceResult<ItemCatalogService.FilterOptions>> itemFilterTask = new Task<>() {
            @Override protected ItemCatalogService.ServiceResult<ItemCatalogService.FilterOptions> call() {
                return ItemCatalogService.loadFilterOptions();
            }
        };
        UiAsyncTasks.submit(
                itemFilterTask,
                result -> {
                    if (!result.isOk()) {
                        UiErrorReporter.reportBackgroundFailure(
                                "LootTableModule.start() loadItemFilterOptions failed",
                                new IllegalStateException("ItemCatalogService status: " + result.status()));
                    }
                    ItemCatalogService.FilterOptions filterData = result.value();
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

    public void setInspectorContentHandler(BiConsumer<String, Node> handler) {
        editorView.setInspectorContentHandler(handler);
    }
}
