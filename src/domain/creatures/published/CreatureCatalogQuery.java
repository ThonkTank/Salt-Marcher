package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record CreatureCatalogQuery(
        @Nullable String nameQuery,
        @Nullable String challengeRatingMin,
        @Nullable String challengeRatingMax,
        List<String> sizes,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> alignments,
        CreatureCatalogSortField sortField,
        CreatureSortDirection sortDirection,
        int pageSize,
        int pageOffset
) {
    public CreatureCatalogQuery {
        sizes = sizes == null ? List.of() : List.copyOf(sizes);
        types = types == null ? List.of() : List.copyOf(types);
        subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        alignments = alignments == null ? List.of() : List.copyOf(alignments);
    }

    public static CreatureCatalogQuery defaults() {
        return new CreatureCatalogQuery(
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                CreatureCatalogSortField.NAME,
                CreatureSortDirection.ASCENDING,
                50,
                0
        );
    }
}
