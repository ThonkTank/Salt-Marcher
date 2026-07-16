package features.items.api;

import java.util.List;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;

/** Read-only local item-reference capability. */
public interface ItemsCatalogApi {

    CompletionStage<FilterOptionsResult> loadFilterOptions();

    CompletionStage<PageResult> search(ItemQuery query);

    CompletionStage<DetailResult> loadDetail(String sourceKey);

    enum CatalogStatus {
        SUCCESS,
        INVALID_QUERY,
        UNAVAILABLE,
        NOT_FOUND,
        STORAGE_ERROR,
        EXECUTION_ERROR
    }

    enum SortField {
        NAME,
        CATEGORY,
        RARITY,
        COST
    }

    record ItemQuery(
            @Nullable String name,
            @Nullable String category,
            @Nullable String subcategory,
            @Nullable String rarity,
            @Nullable Boolean magic,
            @Nullable Boolean attunement,
            @Nullable Integer minimumCostCp,
            @Nullable Integer maximumCostCp,
            SortField sortField,
            boolean ascending,
            int pageSize,
            int pageOffset
    ) {
        public ItemQuery {
            sortField = sortField == null ? SortField.NAME : sortField;
        }

        public static ItemQuery firstPage() {
            return new ItemQuery(
                    null, null, null, null, null, null, null, null,
                    SortField.NAME, true, 50, 0);
        }
    }

    record FilterOptionsResult(
            CatalogStatus status,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities
    ) {
        public FilterOptionsResult {
            status = status == null ? CatalogStatus.STORAGE_ERROR : status;
            categories = copy(categories);
            subcategories = copy(subcategories);
            rarities = copy(rarities);
        }
    }

    record ItemRow(
            String sourceKey,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean attunement,
            @Nullable Integer costCp,
            String costDisplay
    ) {
        public ItemRow {
            sourceKey = safe(sourceKey);
            name = safe(name);
            category = safe(category);
            subcategory = safe(subcategory);
            rarity = safe(rarity);
            costDisplay = safe(costDisplay);
        }
    }

    record PageResult(
            CatalogStatus status,
            List<ItemRow> rows,
            int totalCount,
            int pageSize,
            int pageOffset
    ) {
        public PageResult {
            status = status == null ? CatalogStatus.STORAGE_ERROR : status;
            rows = copy(rows);
        }
    }

    record DetailResult(CatalogStatus status, @Nullable ItemDetail detail) {
        public DetailResult {
            status = status == null ? CatalogStatus.STORAGE_ERROR : status;
        }
    }

    record ItemDetail(
            String sourceKey,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean attunement,
            @Nullable Integer costCp,
            String costDisplay,
            @Nullable Double weight,
            String damage,
            String armorClass,
            List<String> properties,
            String description,
            String sourceVersion,
            String sourceUrl
    ) {
        public ItemDetail {
            sourceKey = safe(sourceKey);
            name = safe(name);
            category = safe(category);
            subcategory = safe(subcategory);
            rarity = safe(rarity);
            costDisplay = safe(costDisplay);
            damage = safe(damage);
            armorClass = safe(armorClass);
            properties = copy(properties);
            description = safe(description);
            sourceVersion = safe(sourceVersion);
            sourceUrl = safe(sourceUrl);
        }
    }

    private static <T> List<T> copy(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }
}
