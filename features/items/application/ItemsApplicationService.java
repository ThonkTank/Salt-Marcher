package features.items.application;

import features.items.api.ItemsCatalogApi;
import features.items.api.ItemsImportApi;
import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.catalog.ItemCatalogData.Detail;
import features.items.domain.catalog.ItemCatalogPort;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import features.items.domain.importing.ItemImportStore;
import features.items.domain.importing.PublicItemSource;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;

public final class ItemsApplicationService implements ItemsCatalogApi, ItemsImportApi {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final DiagnosticId READ_FAILURE = new DiagnosticId("items.catalog.storage-failure");
    private static final DiagnosticId SOURCE_FAILURE = new DiagnosticId("items.import.source-failure");
    private static final DiagnosticId VALIDATION_FAILURE = new DiagnosticId("items.import.validation-failure");
    private static final DiagnosticId BACKUP_FAILURE = new DiagnosticId("items.import.backup-failure");
    private static final DiagnosticId IMPORT_STORAGE_FAILURE = new DiagnosticId("items.import.storage-failure");
    private static final DiagnosticId EXECUTION_FAILURE = new DiagnosticId("items.execution.failure");

    private final ItemCatalogPort catalog;
    private final PublicItemSource publicSource;
    private final ItemImportStore importStore;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;

    public ItemsApplicationService(
            ItemCatalogPort catalog,
            PublicItemSource publicSource,
            ItemImportStore importStore,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.publicSource = Objects.requireNonNull(publicSource, "publicSource");
        this.importStore = Objects.requireNonNull(importStore, "importStore");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    @Override
    public CompletionStage<FilterOptionsResult> loadFilterOptions() {
        return execute(this::loadFilterOptionsNow, this::filterExecutionFailure);
    }

    @Override
    public CompletionStage<PageResult> search(@Nullable ItemQuery query) {
        ItemQuery normalized = normalize(query);
        return execute(() -> searchNow(normalized), () -> empty(CatalogStatus.EXECUTION_ERROR, normalized));
    }

    @Override
    public CompletionStage<DetailResult> loadDetail(@Nullable String sourceKey) {
        return execute(() -> loadDetailNow(sourceKey),
                () -> new DetailResult(CatalogStatus.EXECUTION_ERROR, null));
    }

    @Override
    public CompletionStage<ImportResult> importPublicSrd() {
        return execute(this::importNow, () -> ImportResult.failure(ImportStatus.EXECUTION_ERROR));
    }

    private FilterOptionsResult loadFilterOptionsNow() {
        try {
            if (!catalog.isAvailable()) {
                return new FilterOptionsResult(CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of());
            }
            ItemCatalogData.FilterValues values = catalog.loadFilterValues();
            return new FilterOptionsResult(
                    CatalogStatus.SUCCESS,
                    values.categories(),
                    values.subcategories(),
                    values.rarities());
        } catch (IllegalStateException exception) {
            diagnostics.failure(READ_FAILURE, exception.getClass());
            return new FilterOptionsResult(CatalogStatus.STORAGE_ERROR, List.of(), List.of(), List.of());
        }
    }

    private PageResult searchNow(ItemQuery query) {
        if (!valid(query)) {
            return empty(CatalogStatus.INVALID_QUERY, query);
        }
        try {
            if (!catalog.isAvailable()) {
                return empty(CatalogStatus.UNAVAILABLE, query);
            }
            ItemCatalogData.CatalogPage page = catalog.search(toSpec(query));
            return new PageResult(
                    CatalogStatus.SUCCESS,
                    page.rows().stream().map(ItemsApplicationService::toRow).toList(),
                    page.totalCount(),
                    page.pageSize(),
                    page.pageOffset());
        } catch (IllegalStateException exception) {
            diagnostics.failure(READ_FAILURE, exception.getClass());
            return empty(CatalogStatus.STORAGE_ERROR, query);
        }
    }

    private DetailResult loadDetailNow(@Nullable String sourceKey) {
        if (sourceKey == null || sourceKey.isBlank()) {
            return new DetailResult(CatalogStatus.NOT_FOUND, null);
        }
        try {
            if (!catalog.isAvailable()) {
                return new DetailResult(CatalogStatus.UNAVAILABLE, null);
            }
            Detail detail = catalog.loadDetail(sourceKey.trim());
            return new DetailResult(
                    detail == null ? CatalogStatus.NOT_FOUND : CatalogStatus.SUCCESS,
                    toDetail(detail));
        } catch (IllegalStateException exception) {
            diagnostics.failure(READ_FAILURE, exception.getClass());
            return new DetailResult(CatalogStatus.STORAGE_ERROR, null);
        }
    }

    private ImportResult importNow() {
        List<ImportedItem> fetched;
        try {
            fetched = publicSource.fetchAll();
        } catch (IllegalStateException exception) {
            diagnostics.failure(SOURCE_FAILURE, exception.getClass());
            return ImportResult.failure(ImportStatus.SOURCE_ERROR);
        }

        ItemImportBatch batch;
        try {
            batch = new ItemImportBatch(fetched);
        } catch (IllegalArgumentException exception) {
            diagnostics.failure(VALIDATION_FAILURE, exception.getClass());
            return ImportResult.failure(ImportStatus.VALIDATION_ERROR);
        }

        ItemImportStore.BackupReceipt backup;
        try {
            importStore.initialize();
            backup = importStore.createVerifiedBackup();
        } catch (IllegalStateException exception) {
            diagnostics.failure(BACKUP_FAILURE, exception.getClass());
            return ImportResult.failure(ImportStatus.BACKUP_ERROR);
        }

        try {
            importStore.replaceAll(batch);
            return new ImportResult(ImportStatus.SUCCESS, batch.items().size(), backup.createdAt());
        } catch (IllegalStateException exception) {
            diagnostics.failure(IMPORT_STORAGE_FAILURE, exception.getClass());
            return ImportResult.failure(ImportStatus.STORAGE_ERROR);
        }
    }

    private <T> CompletionStage<T> execute(Supplier<T> operation, Supplier<T> rejectedResult) {
        CompletableFuture<T> response = new CompletableFuture<>();
        try {
            executionLane.execute(() -> {
                try {
                    response.complete(operation.get());
                } catch (RuntimeException exception) {
                    diagnostics.failure(EXECUTION_FAILURE, exception.getClass());
                    response.complete(rejectedResult.get());
                }
            });
        } catch (RuntimeException exception) {
            diagnostics.failure(EXECUTION_FAILURE, exception.getClass());
            response.complete(rejectedResult.get());
        }
        return response;
    }

    private FilterOptionsResult filterExecutionFailure() {
        return new FilterOptionsResult(CatalogStatus.EXECUTION_ERROR, List.of(), List.of(), List.of());
    }

    private static ItemQuery normalize(@Nullable ItemQuery query) {
        if (query == null) {
            return ItemQuery.firstPage();
        }
        int pageSize = query.pageSize() <= 0 ? DEFAULT_PAGE_SIZE : Math.min(query.pageSize(), MAX_PAGE_SIZE);
        return new ItemQuery(
                trim(query.name()),
                trim(query.category()),
                trim(query.subcategory()),
                trim(query.rarity()),
                query.magic(),
                query.attunement(),
                query.minimumCostCp(),
                query.maximumCostCp(),
                query.sortField(),
                query.ascending(),
                pageSize,
                Math.max(0, query.pageOffset()));
    }

    private static boolean valid(ItemQuery query) {
        if (query.minimumCostCp() != null && query.minimumCostCp() < 0) {
            return false;
        }
        if (query.maximumCostCp() != null && query.maximumCostCp() < 0) {
            return false;
        }
        return query.minimumCostCp() == null
                || query.maximumCostCp() == null
                || query.minimumCostCp() <= query.maximumCostCp();
    }

    private static ItemCatalogData.SearchSpec toSpec(ItemQuery query) {
        return new ItemCatalogData.SearchSpec(
                query.name(),
                query.category(),
                query.subcategory(),
                query.rarity(),
                query.magic(),
                query.attunement(),
                query.minimumCostCp(),
                query.maximumCostCp(),
                toDomainSortField(query.sortField()),
                query.ascending(),
                query.pageSize(),
                query.pageOffset());
    }

    private static ItemCatalogData.SortField toDomainSortField(SortField sortField) {
        return switch (sortField == null ? SortField.NAME : sortField) {
            case NAME -> ItemCatalogData.SortField.NAME;
            case CATEGORY -> ItemCatalogData.SortField.CATEGORY;
            case RARITY -> ItemCatalogData.SortField.RARITY;
            case COST -> ItemCatalogData.SortField.COST;
        };
    }

    private static PageResult empty(CatalogStatus status, ItemQuery query) {
        return new PageResult(status, List.of(), 0, query.pageSize(), query.pageOffset());
    }

    private static ItemRow toRow(ItemCatalogData.CatalogRow row) {
        return new ItemRow(
                row.sourceKey(),
                row.name(),
                row.category(),
                row.subcategory(),
                row.magic(),
                row.rarity(),
                row.attunement(),
                row.costCp(),
                row.costDisplay());
    }

    private static @Nullable ItemDetail toDetail(@Nullable Detail detail) {
        if (detail == null) {
            return null;
        }
        ItemRow row = toRow(detail.row());
        return new ItemDetail(
                row.sourceKey(),
                row.name(),
                row.category(),
                row.subcategory(),
                row.magic(),
                row.rarity(),
                row.attunement(),
                row.costCp(),
                row.costDisplay(),
                detail.weight(),
                detail.damage(),
                detail.armorClass(),
                detail.properties(),
                detail.description(),
                detail.sourceVersion(),
                detail.sourceUrl());
    }

    private static @Nullable String trim(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
