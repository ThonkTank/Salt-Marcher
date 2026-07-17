package features.creatures.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

/** One independent creature-catalog request. */
public record CreatureCatalogQuery(
        @Nullable String nameQuery,
        @Nullable String challengeRatingMin,
        @Nullable String challengeRatingMax,
        List<String> sizes,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        List<String> alignments,
        @Nullable String sortFieldName,
        @Nullable String sortDirectionName,
        int pageSize,
        int pageOffset
) {
    private static final String DEFAULT_SORT_FIELD = "NAME";
    private static final String DEFAULT_SORT_DIRECTION = "ASCENDING";

    public CreatureCatalogQuery {
        sizes = copy(sizes);
        creatureTypes = copy(creatureTypes);
        creatureSubtypes = copy(creatureSubtypes);
        biomes = copy(biomes);
        alignments = copy(alignments);
        sortFieldName = sortFieldName == null ? DEFAULT_SORT_FIELD : sortFieldName;
        sortDirectionName = sortDirectionName == null ? DEFAULT_SORT_DIRECTION : sortDirectionName;
    }

    private static List<String> copy(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
