package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;
import java.util.Objects;

public final class SearchCreatureCatalogUseCase {

    public enum SearchStatus {
        SUCCESS,
        INVALID_QUERY
    }

    public record SearchResult(
            SearchStatus status,
            CreatureCatalogLookup.CatalogPage page,
            int pageSize,
            int pageOffset
    ) {
        public boolean invalidQuery() {
            return status == SearchStatus.INVALID_QUERY;
        }
    }

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final CreatureCatalogLookup queryPort;

    public SearchCreatureCatalogUseCase(CreatureCatalogLookup queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    public SearchResult execute(CreatureCatalogQuery query) {
        NormalizedCatalogQuery normalizedQuery = normalize(query);
        if (!normalizedQuery.valid()) {
            return new SearchResult(
                    SearchStatus.INVALID_QUERY,
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
                toPortSortField(effectiveQuery.sortField() == null
                        ? CreatureCatalogSortField.NAME
                        : effectiveQuery.sortField()),
                toPortSortDirection(effectiveQuery.sortDirection() == null
                        ? CreatureSortDirection.ASCENDING
                        : effectiveQuery.sortDirection()),
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

    private static CreatureCatalogLookup.SortField toPortSortField(CreatureCatalogSortField sortField) {
        return switch (sortField) {
            case CHALLENGE_RATING -> CreatureCatalogLookup.SortField.CHALLENGE_RATING;
            case XP -> CreatureCatalogLookup.SortField.XP;
            case TYPE -> CreatureCatalogLookup.SortField.TYPE;
            case SIZE -> CreatureCatalogLookup.SortField.SIZE;
            case NAME -> CreatureCatalogLookup.SortField.NAME;
        };
    }

    private static CreatureCatalogLookup.SortDirection toPortSortDirection(CreatureSortDirection sortDirection) {
        return sortDirection == CreatureSortDirection.DESCENDING
                ? CreatureCatalogLookup.SortDirection.DESCENDING
                : CreatureCatalogLookup.SortDirection.ASCENDING;
    }
}
