package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.api.ItemsCatalogApi;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;

final class ItemsCatalogDefinitionTest {

    private static final CatalogSortOrder NAME_ASCENDING = new CatalogSortOrder(
            "name", CatalogSortOrder.Direction.ASCENDING);

    @Test
    void successfulFilterOptionsAreRetainedAndProviderSortComesFromBrowseRequest() {
        FakeItemsProvider provider = new FakeItemsProvider();
        provider.options.add(successfulOptions());
        ItemsCatalogDefinition definition = new ItemsCatalogDefinition(provider, ignored -> { });

        CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow> first = query(
                definition, ItemsCatalogQuery.initial(),
                new CatalogSortOrder("category", CatalogSortOrder.Direction.DESCENDING));
        CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow> second = query(
                definition, first.acceptedQuery(), NAME_ASCENDING);

        assertTrue(first.acceptedQuery().filterOptionsResolved());
        assertTrue(second.acceptedQuery().filterOptionsResolved());
        assertEquals(1, provider.optionLoads);
        assertEquals(ItemsCatalogApi.SortField.CATEGORY, provider.queries.getFirst().sortField());
        assertFalse(provider.queries.getFirst().ascending());
        assertEquals(ItemsCatalogApi.SortField.NAME, provider.queries.getLast().sortField());
        assertTrue(provider.queries.getLast().ascending());
        assertEquals(2, provider.searches);
    }

    @Test
    void failedFilterOptionsRemainUnresolvedAndRetryOnNextQuery() {
        FakeItemsProvider provider = new FakeItemsProvider();
        provider.options.add(new ItemsCatalogApi.FilterOptionsResult(
                ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR, List.of(), List.of(), List.of()));
        provider.options.add(successfulOptions());
        ItemsCatalogDefinition definition = new ItemsCatalogDefinition(provider, ignored -> { });

        CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow> first =
                query(definition, ItemsCatalogQuery.initial(), NAME_ASCENDING);
        CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow> second =
                query(definition, first.acceptedQuery(), NAME_ASCENDING);

        assertFalse(first.acceptedQuery().filterOptionsResolved());
        assertEquals(CatalogResultState.Status.FAILED, first.result().status());
        assertEquals("Item-Filter konnten nicht geladen werden.", first.result().message());
        assertTrue(second.acceptedQuery().filterOptionsResolved());
        assertEquals(2, provider.optionLoads);
    }

    @Test
    void overlappingQueriesShareOneOptionLoadAndKeepItsSuccessOutsideRequestEpochs() {
        FakeItemsProvider provider = new FakeItemsProvider();
        CompletableFuture<ItemsCatalogApi.FilterOptionsResult> pending = provider.deferOptions();
        ItemsCatalogDefinition definition = new ItemsCatalogDefinition(provider, ignored -> { });

        CompletionStage<CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow>> first =
                queryAsync(definition, ItemsCatalogQuery.initial(), NAME_ASCENDING);
        CompletionStage<CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow>> second =
                queryAsync(definition, ItemsCatalogQuery.initial(), NAME_ASCENDING);

        assertEquals(1, provider.optionLoads);
        pending.complete(successfulOptions());
        assertTrue(first.toCompletableFuture().join().acceptedQuery().filterOptionsResolved());
        assertTrue(second.toCompletableFuture().join().acceptedQuery().filterOptionsResolved());
        assertTrue(query(definition, ItemsCatalogQuery.initial(), NAME_ASCENDING)
                .acceptedQuery().filterOptionsResolved());
        assertEquals(1, provider.optionLoads);
    }

    private static CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow> query(
            ItemsCatalogDefinition definition,
            ItemsCatalogQuery query,
            CatalogSortOrder sortOrder
    ) {
        return queryAsync(definition, query, sortOrder)
                .toCompletableFuture().join();
    }

    private static CompletionStage<CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow>> queryAsync(
            ItemsCatalogDefinition definition,
            ItemsCatalogQuery query,
            CatalogSortOrder sortOrder
    ) {
        return definition.query(new CatalogBrowseRequest<>(query, sortOrder, 50, 0, true));
    }

    private static ItemsCatalogApi.FilterOptionsResult successfulOptions() {
        return new ItemsCatalogApi.FilterOptionsResult(
                ItemsCatalogApi.CatalogStatus.SUCCESS,
                List.of("Armor"), List.of("Heavy"), List.of("Rare"));
    }

    private static final class FakeItemsProvider implements ItemsCatalogApi {
        private final Queue<FilterOptionsResult> options = new ArrayDeque<>();
        private int optionLoads;
        private int searches;
        private CompletableFuture<FilterOptionsResult> deferredOptions;
        private final List<ItemQuery> queries = new java.util.ArrayList<>();

        private CompletableFuture<FilterOptionsResult> deferOptions() {
            deferredOptions = new CompletableFuture<>();
            return deferredOptions;
        }

        @Override public CompletionStage<FilterOptionsResult> loadFilterOptions() {
            optionLoads++;
            if (deferredOptions != null) {
                return deferredOptions;
            }
            return CompletableFuture.completedFuture(options.remove());
        }

        @Override public CompletionStage<PageResult> search(ItemQuery query) {
            searches++;
            queries.add(query);
            return CompletableFuture.completedFuture(new PageResult(
                    CatalogStatus.SUCCESS, List.of(), 0, query.pageSize(), query.pageOffset()));
        }

        @Override public CompletionStage<DetailResult> loadDetail(String sourceKey) {
            return CompletableFuture.completedFuture(new DetailResult(CatalogStatus.NOT_FOUND, null));
        }
    }
}
