package src.domain.creatures;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;

/**
 * Public backend facade for creature catalog publication.
 */
@SuppressWarnings({
        "PMD.AvoidCatchingGenericException"
})
public final class CreaturesApplicationService {

    private static final long NO_CREATURE_ID = 0L;
    private static final CreatureCatalogData.DistinctFilterValues EMPTY_FILTER_VALUES =
            new CreatureCatalogData.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of());

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public CreaturesApplicationService(
            CreatureCatalogPort creatureCatalogLookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        CreatureCatalogPort lookup = Objects.requireNonNull(creatureCatalogLookup, "creatureCatalogLookup");
        this.loadCreatureFilterOptionsUseCase = new LoadCreatureFilterOptionsUseCase(lookup);
        this.searchCreatureCatalogUseCase = new SearchCreatureCatalogUseCase(lookup);
        this.loadCreatureDetailUseCase = new LoadCreatureDetailUseCase(lookup);
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void refreshFilterOptions(RefreshCreatureFilterOptionsCommand command) {
        Objects.requireNonNull(command, "command");
        try {
            LoadCreatureFilterOptionsUseCase.FilterOptions options = loadCreatureFilterOptionsUseCase.execute();
            publishedStateRepository.publishFilterOptions(new CreaturesPublishedStateRepository.FilterOptionsPublication(
                    CreaturesPublishedStateRepository.SUCCESS,
                    options.values(),
                    options.challengeRatings()));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishFilterOptions(new CreaturesPublishedStateRepository.FilterOptionsPublication(
                    CreaturesPublishedStateRepository.STORAGE_ERROR,
                    EMPTY_FILTER_VALUES,
                    List.of()));
        }
    }

    public void refreshCatalog(RefreshCreatureCatalogCommand command) {
        NormalizedCatalogCommand normalizedQuery = NormalizedCatalogCommand.from(command);
        if (!normalizedQuery.valid()) {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.INVALID_QUERY,
                    emptyPage(normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
            return;
        }
        try {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.SUCCESS,
                    searchCreatureCatalogUseCase.execute(normalizedQuery.spec())));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.STORAGE_ERROR,
                    emptyPage(normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
        }
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        try {
            long creatureId = command == null ? NO_CREATURE_ID : command.creatureId();
            if (creatureId <= NO_CREATURE_ID) {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.NOT_FOUND,
                        null));
                return;
            }
            CreatureCatalogData.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.NOT_FOUND,
                        null));
            } else {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.SUCCESS,
                        detail));
            }
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                    CreaturesPublishedStateRepository.STORAGE_ERROR,
                    null));
        }
    }

    private record NormalizedCatalogCommand(boolean valid, CreatureCatalogData.CatalogSearchSpec spec) {

        private static final int DEFAULT_PAGE_SIZE = 50;
        private static final int MAX_PAGE_SIZE = 100;

        private static NormalizedCatalogCommand from(@Nullable RefreshCreatureCatalogCommand command) {
            RefreshCreatureCatalogCommand effectiveCommand =
                    command == null ? RefreshCreatureCatalogCommand.defaults() : command;
            String minimumChallengeRating = trimmedOrNull(effectiveCommand.challengeRatingMin());
            String maximumChallengeRating = trimmedOrNull(effectiveCommand.challengeRatingMax());
            Integer minimumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(minimumChallengeRating);
            Integer maximumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(maximumChallengeRating);
            int pageSize = normalizePageSize(effectiveCommand.pageSize());
            int pageOffset = Math.max(0, effectiveCommand.pageOffset());
            return new NormalizedCatalogCommand(
                    hasValidChallengeRatingRange(minimumChallengeRating, maximumChallengeRating, minimumXp, maximumXp),
                    new CreatureCatalogData.CatalogSearchSpec(
                            trimmedOrNull(effectiveCommand.nameQuery()),
                            minimumXp,
                            maximumXp,
                            normalizeValues(effectiveCommand.sizes()),
                            normalizeValues(effectiveCommand.creatureTypes()),
                            normalizeValues(effectiveCommand.creatureSubtypes()),
                            normalizeValues(effectiveCommand.biomes()),
                            normalizeValues(effectiveCommand.alignments()),
                            catalogSortFieldName(effectiveCommand.sortField()),
                            effectiveCommand.sortDirection() != CreatureSortDirection.DESCENDING,
                            pageSize,
                            pageOffset));
        }

        private int pageSize() {
            return spec.pageSize();
        }

        private int pageOffset() {
            return spec.pageOffset();
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

        private static @Nullable String trimmedOrNull(@Nullable String value) {
            if (value == null) {
                return null;
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }

        private static List<String> normalizeValues(List<String> values) {
            if (values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .map(NormalizedCatalogCommand::trimmedOrNull)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
        }

        private static String catalogSortFieldName(
                @Nullable CreatureCatalogSortField sortField
        ) {
            return sortField == null ? CreatureCatalogSortField.NAME.name() : sortField.name();
        }
    }

    private static CreatureCatalogData.CatalogPageData emptyPage(int pageSize, int pageOffset) {
        return new CreatureCatalogData.CatalogPageData(List.of(), 0, pageSize, pageOffset);
    }
}
