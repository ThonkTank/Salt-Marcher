package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogSortField;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureSortDirection;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.List;
import java.util.Objects;

final class SearchCreatureCatalogUseCase {

    enum SearchStatus {
        SUCCESS,
        INVALID_QUERY
    }

    record SearchResult(
            SearchStatus status,
            CreatureCatalogPage page,
            int pageSize,
            int pageOffset
    ) {
        boolean invalidQuery() {
            return status == SearchStatus.INVALID_QUERY;
        }
    }

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final CreatureCatalogQueryPort queryPort;

    SearchCreatureCatalogUseCase(CreatureCatalogQueryPort queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    SearchResult execute(CreatureCatalogQuery query) {
        NormalizedCatalogQuery normalizedQuery = normalize(query);
        if (!normalizedQuery.valid()) {
            return new SearchResult(
                    SearchStatus.INVALID_QUERY,
                    CreatureCatalogPage.empty(normalizedQuery.pageSize(), normalizedQuery.pageOffset()),
                    normalizedQuery.pageSize(),
                    normalizedQuery.pageOffset()
            );
        }
        return new SearchResult(
                SearchStatus.SUCCESS,
                queryPort.searchCatalog(normalizedQuery.toSearchSpec()),
                normalizedQuery.pageSize(),
                normalizedQuery.pageOffset()
        );
    }

    private static NormalizedCatalogQuery normalize(CreatureCatalogQuery query) {
        CreatureCatalogQuery effectiveQuery = query == null ? CreatureCatalogQuery.defaults() : query;
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
                effectiveQuery.sortField() == null ? CreatureCatalogSortField.NAME : effectiveQuery.sortField(),
                effectiveQuery.sortDirection() == null ? CreatureSortDirection.ASCENDING : effectiveQuery.sortDirection(),
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

    private static @Nullable String trimmedOrNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static List<String> normalizeValues(List<String> values) {
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
            CreatureCatalogSortField sortField,
            CreatureSortDirection sortDirection,
            int pageSize,
            int pageOffset,
            boolean valid
    ) {

        private CreatureCatalogQueryPort.CatalogSearchSpec toSearchSpec() {
            return new CreatureCatalogQueryPort.CatalogSearchSpec(
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
}
