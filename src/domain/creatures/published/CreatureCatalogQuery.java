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
        @Nullable CreatureCatalogSortField sortField,
        @Nullable CreatureSortDirection sortDirection,
        int pageSize,
        int pageOffset
) {

    public CreatureCatalogQuery {
        sizes = copyStrings(sizes);
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
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
                null,
                null,
                50,
                0
        );
    }

    @Override
    public List<String> sizes() {
        return copyStrings(sizes);
    }

    @Override
    public List<String> types() {
        return copyStrings(types);
    }

    @Override
    public List<String> subtypes() {
        return copyStrings(subtypes);
    }

    @Override
    public List<String> biomes() {
        return copyStrings(biomes);
    }

    @Override
    public List<String> alignments() {
        return copyStrings(alignments);
    }

    private static List<String> copyStrings(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
