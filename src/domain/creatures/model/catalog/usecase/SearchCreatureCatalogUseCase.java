package src.domain.creatures.model.catalog.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.helper.CreatureCatalogTextHelper;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;

public final class SearchCreatureCatalogUseCase {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "NAME";
    private static final String DESCENDING_SORT_DIRECTION = "DESCENDING";

    private final CreatureCatalogPort lookup;
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public SearchCreatureCatalogUseCase(
            CreatureCatalogPort lookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(SearchRequest request) {
        SearchRequest safeRequest = request == null ? emptyRequest() : request;
        int pageSize = normalizePageSize(safeRequest.requestedPageSize());
        int pageOffset = Math.max(0, safeRequest.requestedPageOffset());
        try {
            String minimumChallengeRating = CreatureCatalogTextHelper.trimmedOrNull(safeRequest.challengeRatingMin());
            String maximumChallengeRating = CreatureCatalogTextHelper.trimmedOrNull(safeRequest.challengeRatingMax());
            Integer minimumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(minimumChallengeRating);
            Integer maximumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(maximumChallengeRating);
            if (!hasValidChallengeRatingRange(minimumChallengeRating, maximumChallengeRating, minimumXp, maximumXp)) {
                publish(
                        CreaturesPublishedStateRepository.INVALID_QUERY,
                        CreatureCatalogData.emptyCatalogPage(pageSize, pageOffset));
                return;
            }
            publish(CreaturesPublishedStateRepository.SUCCESS, lookup.searchCatalog(new CreatureCatalogData.CatalogSearchSpec(
                    CreatureCatalogTextHelper.trimmedOrNull(safeRequest.nameQuery()),
                    minimumXp,
                    maximumXp,
                    CreatureCatalogTextHelper.normalizeValues(safeRequest.sizes()),
                    CreatureCatalogTextHelper.normalizeValues(safeRequest.creatureTypes()),
                    CreatureCatalogTextHelper.normalizeValues(safeRequest.creatureSubtypes()),
                    CreatureCatalogTextHelper.normalizeValues(safeRequest.biomes()),
                    CreatureCatalogTextHelper.normalizeValues(safeRequest.alignments()),
                    safeRequest.sortFieldName() == null ? DEFAULT_SORT_FIELD : safeRequest.sortFieldName(),
                    !DESCENDING_SORT_DIRECTION.equals(safeRequest.sortDirectionName()),
                    pageSize,
                    pageOffset)));
        } catch (IllegalStateException exception) {
            publish(
                    CreaturesPublishedStateRepository.STORAGE_ERROR,
                    CreatureCatalogData.emptyCatalogPage(pageSize, pageOffset));
        }
    }

    private void publish(String status, CreatureCatalogData.CatalogPageData page) {
        publishedStateRepository.publishCatalogPage(
                new CreaturesPublishedStateRepository.CatalogPagePublication(status, page));
    }

    private static SearchRequest emptyRequest() {
        return new SearchRequest(
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
                DEFAULT_PAGE_SIZE,
                0);
    }

    private static boolean hasValidChallengeRatingRange(
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

    public record SearchRequest(
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
            int requestedPageSize,
            int requestedPageOffset
    ) {

        public SearchRequest {
            sizes = copyValues(sizes);
            creatureTypes = copyValues(creatureTypes);
            creatureSubtypes = copyValues(creatureSubtypes);
            biomes = copyValues(biomes);
            alignments = copyValues(alignments);
        }

        @Override
        public List<String> sizes() {
            return List.copyOf(sizes);
        }

        @Override
        public List<String> creatureTypes() {
            return List.copyOf(creatureTypes);
        }

        @Override
        public List<String> creatureSubtypes() {
            return List.copyOf(creatureSubtypes);
        }

        @Override
        public List<String> biomes() {
            return List.copyOf(biomes);
        }

        @Override
        public List<String> alignments() {
            return List.copyOf(alignments);
        }

        private static List<String> copyValues(@Nullable List<String> values) {
            return values == null ? List.of() : List.copyOf(values);
        }
    }
}
