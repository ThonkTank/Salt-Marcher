package src.domain.creatures;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.creatures.runtime.port.CreaturesPublishedStateRepository;

/**
 * Public backend facade for creature catalog publication.
 */
@SuppressWarnings({
        "PMD.AvoidCatchingGenericException"
})
public final class CreaturesApplicationService {

    private static final long NO_CREATURE_ID = 0L;
    private static final CreatureCatalogLookup.DistinctFilterValues EMPTY_FILTER_VALUES =
            new CreatureCatalogLookup.DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of());

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
            publishedStateRepository.publishFilterOptions(new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    new CreatureFilterOptions(
                            options.values().sizes(),
                            options.values().types(),
                            options.values().subtypes(),
                            options.values().biomes(),
                            options.values().alignments(),
                            options.challengeRatings())));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishFilterOptions(new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    new CreatureFilterOptions(
                            EMPTY_FILTER_VALUES.sizes(),
                            EMPTY_FILTER_VALUES.types(),
                            EMPTY_FILTER_VALUES.subtypes(),
                            EMPTY_FILTER_VALUES.biomes(),
                            EMPTY_FILTER_VALUES.alignments(),
                            List.of())));
        }
    }

    public void refreshCatalog(RefreshCreatureCatalogCommand command) {
        NormalizedCatalogCommand normalizedQuery = NormalizedCatalogCommand.from(command);
        if (!normalizedQuery.valid()) {
            publishedStateRepository.publishCatalogPage(new CreatureCatalogPageResult(
                    CreatureQueryStatus.INVALID_QUERY,
                    CreatureCatalogPage.empty(normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
            return;
        }
        try {
            publishedStateRepository.publishCatalogPage(new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS,
                    searchCreatureCatalogUseCase.execute(normalizedQuery.spec())));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalogPage(new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(normalizedQuery.pageSize(), normalizedQuery.pageOffset())));
        }
    }

    public void selectCreatureDetail(SelectCreatureDetailCommand command) {
        try {
            long creatureId = command == null ? NO_CREATURE_ID : command.creatureId();
            if (creatureId <= NO_CREATURE_ID) {
                publishedStateRepository.publishCreatureDetail(new CreatureDetailResult(
                        CreatureLookupStatus.NOT_FOUND,
                        null));
                return;
            }
            CreatureCatalogLookup.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                publishedStateRepository.publishCreatureDetail(new CreatureDetailResult(
                        CreatureLookupStatus.NOT_FOUND,
                        null));
            } else {
                publishedStateRepository.publishCreatureDetail(new CreatureDetailResult(
                        CreatureLookupStatus.SUCCESS,
                        toPublishedCreatureDetail(detail)));
            }
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCreatureDetail(new CreatureDetailResult(
                    CreatureLookupStatus.STORAGE_ERROR,
                    null));
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
                            effectiveCommand.sortField() == null ? CreatureCatalogSortField.NAME : effectiveCommand.sortField(),
                            effectiveCommand.sortDirection() == null ? CreatureSortDirection.ASCENDING : effectiveCommand.sortDirection(),
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
    }

    private static CreatureDetail toPublishedCreatureDetail(CreatureCatalogLookup.CreatureProfile detail) {
        return new CreatureDetail(
                detail.id(),
                detail.name(),
                detail.size(),
                detail.creatureType(),
                detail.subtypes(),
                detail.biomes(),
                detail.alignment(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceExpression(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.armorClassNotes(),
                detail.walkSpeed(),
                detail.flySpeed(),
                detail.swimSpeed(),
                detail.climbSpeed(),
                detail.burrowSpeed(),
                detail.strength(),
                detail.dexterity(),
                detail.constitution(),
                detail.intelligence(),
                detail.wisdom(),
                detail.charisma(),
                detail.initiativeBonus(),
                detail.proficiencyBonus(),
                detail.savingThrows(),
                detail.skills(),
                detail.damageVulnerabilities(),
                detail.damageResistances(),
                detail.damageImmunities(),
                detail.conditionImmunities(),
                detail.senses(),
                detail.passivePerception(),
                detail.languages(),
                detail.legendaryActionCount(),
                detail.actions().stream()
                        .map(action -> new CreatureActionDetail(
                                action.actionType(),
                                action.name(),
                                action.description(),
                                action.toHitBonus()))
                        .toList());
    }
}
