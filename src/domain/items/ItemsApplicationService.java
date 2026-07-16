package src.domain.items;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;
import org.jspecify.annotations.Nullable;
import src.domain.items.ItemsCatalogApi.ItemDetail;
import src.domain.items.ItemsCatalogApi.ItemDetailResult;
import src.domain.items.ItemsCatalogApi.ItemFilterOptions;
import src.domain.items.ItemsCatalogApi.ItemPageResult;
import src.domain.items.ItemsCatalogApi.ItemQuery;
import src.domain.items.ItemsCatalogApi.ItemRow;
import src.domain.items.ItemsCatalogApi.Status;
import src.domain.items.model.ItemCatalogData;
import src.domain.items.model.ItemCatalogData.Detail;
import src.domain.items.model.ItemCatalogPort;

public final class ItemsApplicationService implements ItemsCatalogApi {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private final ItemCatalogPort catalog;
    private final Executor executor;

    public ItemsApplicationService(ItemCatalogPort catalog) {
        this(catalog, ForkJoinPool.commonPool());
    }

    public ItemsApplicationService(ItemCatalogPort catalog, Executor executor) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.executor = Objects.requireNonNull(executor, "executor");
    }

    @Override
    public CompletionStage<ItemFilterOptions> loadFilterOptions() {
        return CompletableFuture.supplyAsync(this::loadFilterOptionsNow, executor);
    }

    private ItemFilterOptions loadFilterOptionsNow() {
        try {
            if (!catalog.isAvailable()) {
                return new ItemFilterOptions(Status.UNAVAILABLE, List.of(), List.of(), List.of());
            }
            ItemCatalogData.FilterValues values = catalog.loadFilterValues();
            return new ItemFilterOptions(Status.SUCCESS,
                    values.categories(), values.subcategories(), values.rarities());
        } catch (IllegalStateException exception) {
            return new ItemFilterOptions(Status.STORAGE_ERROR, List.of(), List.of(), List.of());
        }
    }

    @Override
    public CompletionStage<ItemPageResult> search(@Nullable ItemQuery query) {
        return CompletableFuture.supplyAsync(() -> searchNow(query), executor);
    }

    private ItemPageResult searchNow(@Nullable ItemQuery query) {
        ItemQuery normalized = normalize(query);
        if (!valid(normalized)) {
            return empty(Status.INVALID_QUERY, normalized);
        }
        try {
            if (!catalog.isAvailable()) {
                return empty(Status.UNAVAILABLE, normalized);
            }
            ItemCatalogData.CatalogPage page = catalog.search(toSpec(normalized));
            return new ItemPageResult(Status.SUCCESS, page.rows().stream().map(ItemsApplicationService::toRow).toList(),
                    page.totalCount(), page.pageSize(), page.pageOffset());
        } catch (IllegalStateException exception) {
            return empty(Status.STORAGE_ERROR, normalized);
        }
    }

    @Override
    public CompletionStage<ItemDetailResult> loadDetail(@Nullable String sourceKey) {
        return CompletableFuture.supplyAsync(() -> loadDetailNow(sourceKey), executor);
    }

    private ItemDetailResult loadDetailNow(@Nullable String sourceKey) {
        if (sourceKey == null || sourceKey.isBlank()) {
            return new ItemDetailResult(Status.NOT_FOUND, null);
        }
        try {
            if (!catalog.isAvailable()) {
                return new ItemDetailResult(Status.UNAVAILABLE, null);
            }
            Detail detail = catalog.loadDetail(sourceKey.trim());
            return new ItemDetailResult(detail == null ? Status.NOT_FOUND : Status.SUCCESS, toDetail(detail));
        } catch (IllegalStateException exception) {
            return new ItemDetailResult(Status.STORAGE_ERROR, null);
        }
    }

    private static ItemQuery normalize(@Nullable ItemQuery query) {
        if (query == null) {
            return ItemQuery.firstPage();
        }
        int pageSize = query.pageSize() <= 0 ? DEFAULT_PAGE_SIZE : Math.min(query.pageSize(), MAX_PAGE_SIZE);
        return new ItemQuery(trim(query.name()), trim(query.category()), trim(query.subcategory()), trim(query.rarity()),
                query.magic(), query.attunement(), query.minimumCostCp(), query.maximumCostCp(), query.sortField(),
                query.ascending(), pageSize, Math.max(0, query.pageOffset()));
    }

    private static boolean valid(ItemQuery query) {
        if (query.minimumCostCp() != null && query.minimumCostCp() < 0) {
            return false;
        }
        if (query.maximumCostCp() != null && query.maximumCostCp() < 0) {
            return false;
        }
        return query.minimumCostCp() == null || query.maximumCostCp() == null
                || query.minimumCostCp() <= query.maximumCostCp();
    }

    private static ItemCatalogData.SearchSpec toSpec(ItemQuery query) {
        return new ItemCatalogData.SearchSpec(query.name(), query.category(), query.subcategory(), query.rarity(),
                query.magic(), query.attunement(), query.minimumCostCp(), query.maximumCostCp(),
                query.sortField().name(), query.ascending(), query.pageSize(), query.pageOffset());
    }

    private static ItemPageResult empty(Status status, ItemQuery query) {
        return new ItemPageResult(status, List.of(), 0, query.pageSize(), query.pageOffset());
    }

    private static ItemRow toRow(ItemCatalogData.CatalogRow row) {
        return new ItemRow(row.sourceKey(), row.name(), row.category(), row.subcategory(), row.magic(), row.rarity(),
                row.attunement(), row.costCp(), row.costDisplay());
    }

    private static @Nullable ItemDetail toDetail(@Nullable Detail detail) {
        if (detail == null) {
            return null;
        }
        ItemRow row = toRow(detail.row());
        return new ItemDetail(row.sourceKey(), row.name(), row.category(), row.subcategory(), row.magic(), row.rarity(),
                row.attunement(), row.costCp(), row.costDisplay(), detail.weight(), detail.damage(), detail.armorClass(),
                detail.properties(), detail.description(), detail.sourceVersion(), detail.sourceUrl());
    }

    private static @Nullable String trim(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
