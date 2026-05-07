package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

import java.util.List;

public final class CreatureCatalogQuery {

    private final @Nullable String nameQuery;
    private final @Nullable String challengeRatingMin;
    private final @Nullable String challengeRatingMax;
    private final List<String> sizes;
    private final List<String> types;
    private final List<String> subtypes;
    private final List<String> biomes;
    private final List<String> alignments;
    private final CreatureCatalogSortField sortField;
    private final CreatureSortDirection sortDirection;
    private final int pageSize;
    private final int pageOffset;

    public CreatureCatalogQuery(
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
        this.nameQuery = nameQuery;
        this.challengeRatingMin = challengeRatingMin;
        this.challengeRatingMax = challengeRatingMax;
        this.sizes = sizes == null ? List.of() : List.copyOf(sizes);
        this.types = types == null ? List.of() : List.copyOf(types);
        this.subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        this.biomes = biomes == null ? List.of() : List.copyOf(biomes);
        this.alignments = alignments == null ? List.of() : List.copyOf(alignments);
        this.sortField = sortField == null ? CreatureCatalogSortField.NAME : sortField;
        this.sortDirection = sortDirection == null ? CreatureSortDirection.ASCENDING : sortDirection;
        this.pageSize = pageSize;
        this.pageOffset = pageOffset;
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

    public @Nullable String nameQuery() {
        return nameQuery;
    }

    public @Nullable String challengeRatingMin() {
        return challengeRatingMin;
    }

    public @Nullable String challengeRatingMax() {
        return challengeRatingMax;
    }

    public List<String> sizes() {
        return sizes;
    }

    public List<String> types() {
        return types;
    }

    public List<String> subtypes() {
        return subtypes;
    }

    public List<String> biomes() {
        return biomes;
    }

    public List<String> alignments() {
        return alignments;
    }

    public CreatureCatalogSortField sortField() {
        return sortField;
    }

    public CreatureSortDirection sortDirection() {
        return sortDirection;
    }

    public int pageSize() {
        return pageSize;
    }

    public int pageOffset() {
        return pageOffset;
    }
}
