package features.creatures.adapter.sqlite.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record CreatureCatalogSearchCriteriaRecord(
        @Nullable String nameQuery,
        @Nullable Integer minimumXp,
        @Nullable Integer maximumXp,
        List<String> sizes,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> alignments,
        @Nullable SortField sortField,
        @Nullable SortDirection sortDirection,
        int pageSize,
        int pageOffset
) {
    public CreatureCatalogSearchCriteriaRecord {
        sizes = copyStrings(sizes);
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    public enum SortField {
        NAME,
        CHALLENGE_RATING,
        XP,
        TYPE,
        SIZE
    }

    public enum SortDirection {
        ASCENDING,
        DESCENDING
    }

    public static SortDirection sortDirection(boolean ascending) {
        return ascending ? SortDirection.ASCENDING : SortDirection.DESCENDING;
    }
}
