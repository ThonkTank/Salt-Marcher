package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;
import java.util.Objects;

public final class SearchCreatureCatalogUseCase {

    public record SearchResult(
            ValidationStatus status,
            CreatureCatalogLookup.CatalogPage page,
            int pageSize,
            int pageOffset
    ) {
        public boolean invalidQuery() {
            return status == ValidationStatus.INVALID_QUERY;
        }
    }

    public static final class CatalogQueryInput {

        private final @Nullable String nameQuery;
        private final @Nullable String challengeRatingMin;
        private final @Nullable String challengeRatingMax;
        private final List<String> sizes;
        private final List<String> types;
        private final List<String> subtypes;
        private final List<String> biomes;
        private final List<String> alignments;
        private final CreatureCatalogLookup.SortField sortField;
        private final CreatureCatalogLookup.SortDirection sortDirection;
        private final int pageSize;
        private final int pageOffset;

        public CatalogQueryInput(
                @Nullable String nameQuery,
                @Nullable String challengeRatingMin,
                @Nullable String challengeRatingMax,
                @Nullable List<String> sizes,
                @Nullable List<String> types,
                @Nullable List<String> subtypes,
                @Nullable List<String> biomes,
                @Nullable List<String> alignments,
                CreatureCatalogLookup.SortField sortField,
                CreatureCatalogLookup.SortDirection sortDirection,
                int pageSize,
                int pageOffset
        ) {
            this.nameQuery = nameQuery;
            this.challengeRatingMin = challengeRatingMin;
            this.challengeRatingMax = challengeRatingMax;
            this.sizes = immutableValues(sizes);
            this.types = immutableValues(types);
            this.subtypes = immutableValues(subtypes);
            this.biomes = immutableValues(biomes);
            this.alignments = immutableValues(alignments);
            this.sortField = sortField == null ? CreatureCatalogLookup.SortField.NAME : sortField;
            this.sortDirection = sortDirection == null ? CreatureCatalogLookup.SortDirection.ASCENDING : sortDirection;
            this.pageSize = pageSize;
            this.pageOffset = pageOffset;
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
            return immutableValues(sizes);
        }

        public List<String> types() {
            return immutableValues(types);
        }

        public List<String> subtypes() {
            return immutableValues(subtypes);
        }

        public List<String> biomes() {
            return immutableValues(biomes);
        }

        public List<String> alignments() {
            return immutableValues(alignments);
        }

        public CreatureCatalogLookup.SortField sortField() {
            return sortField;
        }

        public CreatureCatalogLookup.SortDirection sortDirection() {
            return sortDirection;
        }

        public int pageSize() {
            return pageSize;
        }

        public int pageOffset() {
            return pageOffset;
        }
    }

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final CreatureCatalogLookup lookup;

    public SearchCreatureCatalogUseCase(CreatureCatalogLookup lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public SearchResult execute(CatalogQueryInput query) {
        NormalizedCatalogQuery normalizedQuery = normalize(query);
        if (!normalizedQuery.valid()) {
            return new SearchResult(
                    ValidationStatus.INVALID_QUERY,
                    new CreatureCatalogLookup.CatalogPage(
                            List.of(),
                            0,
                            normalizedQuery.pageSize(),
                            normalizedQuery.pageOffset()),
                    normalizedQuery.pageSize(),
                    normalizedQuery.pageOffset()
            );
        }
        return new SearchResult(
                ValidationStatus.SUCCESS,
                lookup.searchCatalog(normalizedQuery.toSearchSpec()),
                normalizedQuery.pageSize(),
                normalizedQuery.pageOffset()
        );
    }

    private static NormalizedCatalogQuery normalize(CatalogQueryInput query) {
        CatalogQueryInput effectiveQuery = query == null ? defaults() : query;
        String minimumChallengeRating = trimmedOrNull(effectiveQuery.challengeRatingMin());
        String maximumChallengeRating = trimmedOrNull(effectiveQuery.challengeRatingMax());
        Integer minimumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(minimumChallengeRating);
        Integer maximumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(maximumChallengeRating);
        return new NormalizedCatalogQuery(
                trimmedOrNull(effectiveQuery.nameQuery()),
                minimumXp,
                maximumXp,
                normalizeValues(effectiveQuery.sizes()),
                normalizeValues(effectiveQuery.types()),
                normalizeValues(effectiveQuery.subtypes()),
                normalizeValues(effectiveQuery.biomes()),
                normalizeValues(effectiveQuery.alignments()),
                effectiveQuery.sortField(),
                effectiveQuery.sortDirection(),
                normalizePageSize(effectiveQuery.pageSize()),
                Math.max(0, effectiveQuery.pageOffset()),
                isValidChallengeRatingRange(minimumChallengeRating, maximumChallengeRating, minimumXp, maximumXp)
        );
    }

    private static boolean isValidChallengeRatingRange(
            @Nullable String minimumChallengeRating,
            @Nullable String maximumChallengeRating,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp
    ) {
        if (minimumChallengeRating != null && minimumXp == null) {
            return false;
        }
        if (maximumChallengeRating != null && maximumXp == null) {
            return false;
        }
        return minimumXp == null || maximumXp == null || minimumXp <= maximumXp;
    }

    private static int normalizePageSize(int pageSize) {
        if (pageSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private static List<String> immutableValues(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static @Nullable String trimmedOrNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static List<String> normalizeValues(@Nullable List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .map(SearchCreatureCatalogUseCase::trimmedOrNull)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private record NormalizedCatalogQuery(
            @Nullable String nameQuery,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            CreatureCatalogLookup.SortField sortField,
            CreatureCatalogLookup.SortDirection sortDirection,
            int pageSize,
            int pageOffset,
            boolean valid
    ) {

        private CreatureCatalogLookup.CatalogSearchSpec toSearchSpec() {
            return new CreatureCatalogLookup.CatalogSearchSpec(
                    nameQuery,
                    minimumXp,
                    maximumXp,
                    sizes,
                    types,
                    subtypes,
                    biomes,
                    alignments,
                    sortField,
                    sortDirection,
                    pageSize,
                    pageOffset
            );
        }
    }

    private static CatalogQueryInput defaults() {
        return new CatalogQueryInput(
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                CreatureCatalogLookup.SortField.NAME,
                CreatureCatalogLookup.SortDirection.ASCENDING,
                DEFAULT_PAGE_SIZE,
                0);
    }
}
