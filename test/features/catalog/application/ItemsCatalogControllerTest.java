package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.api.ItemsCatalogApi;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class ItemsCatalogControllerTest {

    @Test
    void invalidDraftAvoidsIoAndAllPageStatusesUseTheCommonVocabulary() {
        ControllableItems provider = new ControllableItems();
        List<String> opened = new ArrayList<>();
        ItemsCatalogController controller = controller(provider, opened);
        controller.activate();
        controller.accept(new ItemsCatalogIntent.Refresh());
        assertEquals(1, provider.searches.size());

        controller.accept(new ItemsCatalogIntent.ChangeDraft(new ItemsCatalogFilterDraft(
                "blade", "", "", "", null, null, "not a number", "",
                ItemsCatalogApi.SortField.NAME, true)));
        controller.accept(new ItemsCatalogIntent.Search());
        assertEquals(1, provider.searches.size(), "invalid raw cost input must not call the provider");
        assertEquals(CatalogResultState.Status.INVALID_INPUT, controller.state().results().status());
        provider.searches.getFirst().future.complete(page(ItemsCatalogApi.CatalogStatus.SUCCESS, "stale"));
        assertEquals(CatalogResultState.Status.INVALID_INPUT, controller.state().results().status(),
                "an older page must not replace local validation");

        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.SUCCESS, CatalogResultState.Status.READY);
        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.INVALID_QUERY,
                CatalogResultState.Status.INVALID_INPUT);
        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.UNAVAILABLE,
                CatalogResultState.Status.UNAVAILABLE);
        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.NOT_FOUND,
                CatalogResultState.Status.EMPTY);
        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.STORAGE_ERROR,
                CatalogResultState.Status.FAILED);
        assertStatus(controller, provider, ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR,
                CatalogResultState.Status.FAILED);
    }

    @Test
    void newerPagesAndDetailsWinAndLifecycleOrSelectionChangesRejectLateDetail() {
        ControllableItems provider = new ControllableItems();
        List<String> opened = new ArrayList<>();
        ItemsCatalogController controller = controller(provider, opened);
        controller.activate();
        controller.accept(new ItemsCatalogIntent.Refresh());
        provider.options.getFirst().complete(options("Old"));
        provider.searches.getFirst().future.complete(page(ItemsCatalogApi.CatalogStatus.SUCCESS, "initial"));

        controller.accept(new ItemsCatalogIntent.Search());
        PendingPage older = provider.searches.getLast();
        controller.accept(new ItemsCatalogIntent.Search());
        PendingPage newer = provider.searches.getLast();
        newer.future.complete(page(ItemsCatalogApi.CatalogStatus.SUCCESS, "newer"));
        older.future.complete(page(ItemsCatalogApi.CatalogStatus.SUCCESS, "older"));
        assertEquals(List.of("newer"), controller.state().results().rows().stream()
                .map(ItemsCatalogApi.ItemRow::sourceKey).toList());

        controller.accept(new ItemsCatalogIntent.SelectItem("newer"));
        controller.accept(new ItemsCatalogIntent.OpenItem("newer"));
        CompletableFuture<ItemsCatalogApi.DetailResult> olderDetail = provider.details.getLast();
        controller.accept(new ItemsCatalogIntent.OpenItem("newer"));
        CompletableFuture<ItemsCatalogApi.DetailResult> newerDetail = provider.details.getLast();
        newerDetail.complete(detail("newer-response"));
        olderDetail.complete(detail("older-response"));
        assertEquals(List.of("newer-response"), opened);

        controller.accept(new ItemsCatalogIntent.OpenItem("newer"));
        CompletableFuture<ItemsCatalogApi.DetailResult> changedSelection = provider.details.getLast();
        controller.accept(new ItemsCatalogIntent.SelectItem("different"));
        changedSelection.complete(detail("wrong-selection"));
        assertEquals(List.of("newer-response"), opened);

        controller.accept(new ItemsCatalogIntent.SelectItem("newer"));
        controller.accept(new ItemsCatalogIntent.OpenItem("newer"));
        CompletableFuture<ItemsCatalogApi.DetailResult> postDeactivate = provider.details.getLast();
        controller.deactivate();
        postDeactivate.complete(detail("post-deactivate"));
        assertEquals(List.of("newer-response"), opened);

        controller.activate();
        assertEquals(2, provider.options.size());
        provider.options.get(1).complete(options("New"));
        assertEquals(List.of("New"), controller.state().filterOptions().categories());
    }

    private static void assertStatus(
            ItemsCatalogController controller,
            ControllableItems provider,
            ItemsCatalogApi.CatalogStatus providerStatus,
            CatalogResultState.Status expected
    ) {
        controller.accept(new ItemsCatalogIntent.ChangeDraft(ItemsCatalogFilterDraft.empty()));
        controller.accept(new ItemsCatalogIntent.Search());
        PendingPage pending = provider.searches.getLast();
        pending.future.complete(page(providerStatus, providerStatus == ItemsCatalogApi.CatalogStatus.SUCCESS
                ? "row" : ""));
        assertEquals(expected, controller.state().results().status());
    }

    private static ItemsCatalogController controller(ControllableItems provider, List<String> opened) {
        return new ItemsCatalogController(
                provider, detail -> opened.add(detail.sourceKey()), DirectUiDispatcher.INSTANCE, () -> { });
    }

    private static ItemsCatalogApi.PageResult page(ItemsCatalogApi.CatalogStatus status, String key) {
        List<ItemsCatalogApi.ItemRow> rows = status == ItemsCatalogApi.CatalogStatus.SUCCESS && !key.isBlank()
                ? List.of(row(key)) : List.of();
        return new ItemsCatalogApi.PageResult(status, rows, rows.size(), 50, 0);
    }

    private static ItemsCatalogApi.ItemRow row(String key) {
        return new ItemsCatalogApi.ItemRow(
                key, key, "Weapon", "Martial", false, "Common", false, 1, "1 cp");
    }

    private static ItemsCatalogApi.DetailResult detail(String key) {
        return new ItemsCatalogApi.DetailResult(
                ItemsCatalogApi.CatalogStatus.SUCCESS,
                new ItemsCatalogApi.ItemDetail(
                        key, key, "Weapon", "Martial", false, "Common", false, 1, "1 cp", 1.0,
                        "", "", List.of(), "", "test", ""));
    }

    private static ItemsCatalogApi.FilterOptionsResult options(String category) {
        return new ItemsCatalogApi.FilterOptionsResult(
                ItemsCatalogApi.CatalogStatus.SUCCESS, List.of(category), List.of(), List.of());
    }

    private static final class ControllableItems implements ItemsCatalogApi {
        private final List<CompletableFuture<FilterOptionsResult>> options = new ArrayList<>();
        private final List<PendingPage> searches = new ArrayList<>();
        private final List<CompletableFuture<DetailResult>> details = new ArrayList<>();

        @Override public CompletionStage<FilterOptionsResult> loadFilterOptions() {
            CompletableFuture<FilterOptionsResult> future = new CompletableFuture<>();
            options.add(future);
            return future;
        }

        @Override public CompletionStage<PageResult> search(ItemQuery query) {
            CompletableFuture<PageResult> future = new CompletableFuture<>();
            searches.add(new PendingPage(query, future));
            return future;
        }

        @Override public CompletionStage<DetailResult> loadDetail(String sourceKey) {
            CompletableFuture<DetailResult> future = new CompletableFuture<>();
            details.add(future);
            return future;
        }
    }

    private record PendingPage(
            ItemsCatalogApi.ItemQuery query,
            CompletableFuture<ItemsCatalogApi.PageResult> future
    ) {
    }
}
