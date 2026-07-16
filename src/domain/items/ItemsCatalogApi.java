package src.domain.items;

import java.util.List;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;

/** Read-only item catalog capability consumed by the Catalog presentation. */
public interface ItemsCatalogApi {

    CompletionStage<ItemFilterOptions> loadFilterOptions();

    CompletionStage<ItemPageResult> search(ItemQuery query);

    CompletionStage<ItemDetailResult> loadDetail(String sourceKey);

    enum Status {
        SUCCESS,
        INVALID_QUERY,
        UNAVAILABLE,
        NOT_FOUND,
        STORAGE_ERROR
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
            return new ItemQuery(null, null, null, null, null, null, null, null,
                    SortField.NAME, true, 50, 0);
        }
    }

    record ItemFilterOptions(
            Status status,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities
    ) {
        public ItemFilterOptions {
            status = status == null ? Status.STORAGE_ERROR : status;
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

    record ItemPageResult(
            Status status,
            List<ItemRow> rows,
            int totalCount,
            int pageSize,
            int pageOffset
    ) {
        public ItemPageResult {
            status = status == null ? Status.STORAGE_ERROR : status;
            rows = rows == null ? List.of() : List.copyOf(rows);
        }
    }

    record ItemDetailResult(Status status, @Nullable ItemDetail detail) {
        public ItemDetailResult {
            status = status == null ? Status.STORAGE_ERROR : status;
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

    private static List<String> copy(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }
}
