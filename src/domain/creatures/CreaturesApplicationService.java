package src.domain.creatures;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.creatures.runtime.port.CreaturesPublishedStateRepository;

/**
 * Public backend facade for creature catalog publication.
 */
@SuppressWarnings({
        "PMD.AvoidCatchingGenericException",
        "PMD.CouplingBetweenObjects",
        "PMD.ExcessiveImports"
})
public final class CreaturesApplicationService {

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public CreaturesApplicationService(
            CreatureCatalogLookup creatureCatalogLookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        CreatureCatalogLookup lookup = Objects.requireNonNull(creatureCatalogLookup, "creatureCatalogLookup");
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
                    CreaturesPublishedStateRepository.FilterOptionsStatus.SUCCESS,
                    options.values(),
                    options.challengeRatings()));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishFilterOptions(new CreaturesPublishedStateRepository.FilterOptionsPublication(
                    CreaturesPublishedStateRepository.FilterOptionsStatus.STORAGE_ERROR,
                    null,
                    List.of()));
        }
    }

    public void refreshCatalog(RefreshCreatureCatalogCommand command) {
        NormalizedCatalogCommand normalizedQuery = NormalizedCatalogCommand.from(command);
        if (!normalizedQuery.valid()) {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.CatalogPageStatus.INVALID_QUERY,
                    new CreatureCatalogLookup.CatalogPage(List.of(), 0, normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
            return;
        }
        try {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.CatalogPageStatus.SUCCESS,
                    searchCreatureCatalogUseCase.execute(normalizedQuery.spec())));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalogPage(new CreaturesPublishedStateRepository.CatalogPagePublication(
                    CreaturesPublishedStateRepository.CatalogPageStatus.STORAGE_ERROR,
                    new CreatureCatalogLookup.CatalogPage(List.of(), 0, normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
        }
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        try {
            long creatureId = command == null ? 0L : command.creatureId();
            if (creatureId <= 0L) {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.CreatureDetailStatus.NOT_FOUND,
                        Optional.empty()));
                return;
            }
            CreatureCatalogLookup.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.CreatureDetailStatus.NOT_FOUND,
                        Optional.empty()));
            } else {
                publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                        CreaturesPublishedStateRepository.CreatureDetailStatus.SUCCESS,
                        Optional.of(detail)));
            }
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCreatureDetail(new CreaturesPublishedStateRepository.CreatureDetailPublication(
                    CreaturesPublishedStateRepository.CreatureDetailStatus.STORAGE_ERROR,
                    Optional.empty()));
        }
    }

    private record NormalizedCatalogCommand(boolean valid, CreatureCatalogLookup.CatalogSearchSpec spec) {

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
                    new CreatureCatalogLookup.CatalogSearchSpec(
                            trimmedOrNull(effectiveCommand.nameQuery()),
                            minimumXp,
                            maximumXp,
                            normalizeValues(effectiveCommand.sizes()),
                            normalizeValues(effectiveCommand.creatureTypes()),
                            normalizeValues(effectiveCommand.creatureSubtypes()),
                            normalizeValues(effectiveCommand.biomes()),
                            normalizeValues(effectiveCommand.alignments()),
                            toPortSortField(effectiveCommand.sortField()),
                            toPortSortDirection(effectiveCommand.sortDirection()),
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

        private static CreatureCatalogLookup.SortField toPortSortField(@Nullable CreatureCatalogSortField sortField) {
            CreatureCatalogSortField effectiveSortField = sortField == null ? CreatureCatalogSortField.NAME : sortField;
            if (effectiveSortField == CreatureCatalogSortField.CHALLENGE_RATING) {
                return CreatureCatalogLookup.SortField.CHALLENGE_RATING;
            }
            if (effectiveSortField == CreatureCatalogSortField.XP) {
                return CreatureCatalogLookup.SortField.XP;
            }
            if (effectiveSortField == CreatureCatalogSortField.TYPE) {
                return CreatureCatalogLookup.SortField.TYPE;
            }
            if (effectiveSortField == CreatureCatalogSortField.SIZE) {
                return CreatureCatalogLookup.SortField.SIZE;
            }
            return CreatureCatalogLookup.SortField.NAME;
        }

        private static CreatureCatalogLookup.SortDirection toPortSortDirection(@Nullable CreatureSortDirection sortDirection) {
            return sortDirection == CreatureSortDirection.DESCENDING
                    ? CreatureCatalogLookup.SortDirection.DESCENDING
                    : CreatureCatalogLookup.SortDirection.ASCENDING;
        }
    }
}
