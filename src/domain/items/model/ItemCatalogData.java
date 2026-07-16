package src.domain.items.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class ItemCatalogData {

    private ItemCatalogData() {
    }

    public record SearchSpec(
            @Nullable String name,
            @Nullable String category,
            @Nullable String subcategory,
            @Nullable String rarity,
            @Nullable Boolean magic,
            @Nullable Boolean attunement,
            @Nullable Integer minimumCostCp,
            @Nullable Integer maximumCostCp,
            String sortField,
            boolean ascending,
            int pageSize,
            int pageOffset
    ) {
    }

    public record FilterValues(
            List<String> categories,
            List<String> subcategories,
            List<String> rarities
    ) {
        public FilterValues {
            categories = copy(categories);
            subcategories = copy(subcategories);
            rarities = copy(rarities);
        }
    }

    public record CatalogRow(
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
    }

    public record CatalogPage(List<CatalogRow> rows, int totalCount, int pageSize, int pageOffset) {
        public CatalogPage {
            rows = rows == null ? List.of() : List.copyOf(rows);
        }
    }

    public record Detail(
            CatalogRow row,
            @Nullable Double weight,
            String damage,
            String armorClass,
            List<String> properties,
            String description,
            String sourceVersion,
            String sourceUrl
    ) {
        public Detail {
            properties = copy(properties);
        }
    }

    private static List<String> copy(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
