package src.domain.creatures;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.LoadEncounterCandidatesUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.EncounterCandidate;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.creatures.published.LoadCreatureFilterOptionsQuery;

/**
 * Public read-only backend facade for creature catalog access.
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
    private final LoadEncounterCandidatesUseCase loadEncounterCandidatesUseCase;
    private final List<Consumer<CreatureFilterOptionsResult>> filterOptionsListeners = new ArrayList<>();
    private final List<Consumer<CreatureCatalogPageResult>> catalogListeners = new ArrayList<>();
    private CreatureFilterOptionsResult currentFilterOptions =
            new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty());
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0));
    private final CreatureFilterOptionsModel filterOptionsModel = new CreatureFilterOptionsModel(
            () -> currentFilterOptions,
            listener -> ModelListeners.subscribe(filterOptionsListeners, listener));
    private final CreatureCatalogModel catalogModel = new CreatureCatalogModel(
            () -> currentCatalogPage,
            listener -> ModelListeners.subscribe(catalogListeners, listener));

    public CreaturesApplicationService(CreatureCatalogLookup creatureCatalogLookup) {
        CreatureCatalogLookup lookup = Objects.requireNonNull(creatureCatalogLookup, "creatureCatalogLookup");
        this.loadCreatureFilterOptionsUseCase = new LoadCreatureFilterOptionsUseCase(lookup);
        this.searchCreatureCatalogUseCase = new SearchCreatureCatalogUseCase(lookup);
        this.loadCreatureDetailUseCase = new LoadCreatureDetailUseCase(lookup);
        this.loadEncounterCandidatesUseCase = new LoadEncounterCandidatesUseCase(lookup);
    }

    public CreatureFilterOptionsResult loadFilterOptions(LoadCreatureFilterOptionsQuery query) {
        try {
            currentFilterOptions = new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    PublishedProjection.filterOptions(loadCreatureFilterOptionsUseCase.execute()));
        } catch (RuntimeException exception) {
            currentFilterOptions = new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreatureFilterOptions.empty());
        }
        ModelListeners.notifyListeners(filterOptionsListeners, currentFilterOptions);
        return currentFilterOptions;
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        NormalizedCatalogQuery normalizedQuery = NormalizedCatalogQuery.from(query);
        if (!normalizedQuery.valid()) {
            currentCatalogPage = new CreatureCatalogPageResult(
                    CreatureQueryStatus.INVALID_QUERY,
                    CreatureCatalogPage.empty(normalizedQuery.pageSize(), normalizedQuery.pageOffset()));
            ModelListeners.notifyListeners(catalogListeners, currentCatalogPage);
            return currentCatalogPage;
        }
        try {
            currentCatalogPage = new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS,
                    CreatureCatalogPage.fromPage(searchCreatureCatalogUseCase.execute(normalizedQuery.spec())));
        } catch (RuntimeException exception) {
            currentCatalogPage = new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(normalizedQuery.pageSize(), normalizedQuery.pageOffset()));
        }
        ModelListeners.notifyListeners(catalogListeners, currentCatalogPage);
        return currentCatalogPage;
    }

    public CreatureDetailResult loadCreatureDetail(LoadCreatureDetailQuery query) {
        try {
            long creatureId = query == null ? 0L : query.creatureId();
            CreatureCatalogLookup.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            return new CreatureDetailResult(CreatureLookupStatus.SUCCESS, PublishedProjection.creatureDetail(detail));
        } catch (RuntimeException exception) {
            return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        NormalizedEncounterCandidateQuery normalizedQuery = NormalizedEncounterCandidateQuery.from(query);
        if (!normalizedQuery.valid()) {
            return new EncounterCandidatesResult(CreatureQueryStatus.INVALID_QUERY, List.of());
        }
        try {
            return new EncounterCandidatesResult(
                    CreatureQueryStatus.SUCCESS,
                    loadEncounterCandidatesUseCase.execute(normalizedQuery.spec()).stream()
                            .map(PublishedProjection::encounterCandidate)
                            .toList());
        } catch (RuntimeException exception) {
            return new EncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of());
        }
    }

    public CreatureFilterOptionsModel loadFilterOptionsModel(LoadCreatureFilterOptionsQuery query) {
        Objects.requireNonNull(query, "query");
        return filterOptionsModel;
    }

    public CreatureCatalogModel loadCatalogModel(CreatureCatalogQuery query) {
        Objects.requireNonNull(query, "query");
        return catalogModel;
    }

    private record NormalizedCatalogQuery(boolean valid, CreatureCatalogLookup.CatalogSearchSpec spec) {

        private static final int DEFAULT_PAGE_SIZE = 50;
        private static final int MAX_PAGE_SIZE = 100;

        private static NormalizedCatalogQuery from(@Nullable CreatureCatalogQuery query) {
            CreatureCatalogQuery effectiveQuery = query == null ? CreatureCatalogQuery.defaults() : query;
            String minimumChallengeRating = trimmedOrNull(effectiveQuery.challengeRatingMin());
            String maximumChallengeRating = trimmedOrNull(effectiveQuery.challengeRatingMax());
            Integer minimumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(minimumChallengeRating);
            Integer maximumXp = LoadCreatureFilterOptionsUseCase.xpForChallengeRating(maximumChallengeRating);
            int pageSize = normalizePageSize(effectiveQuery.pageSize());
            int pageOffset = Math.max(0, effectiveQuery.pageOffset());
            return new NormalizedCatalogQuery(
                    hasValidChallengeRatingRange(minimumChallengeRating, maximumChallengeRating, minimumXp, maximumXp),
                    new CreatureCatalogLookup.CatalogSearchSpec(
                            trimmedOrNull(effectiveQuery.nameQuery()),
                            minimumXp,
                            maximumXp,
                            normalizeValues(effectiveQuery.sizes()),
                            normalizeValues(effectiveQuery.types()),
                            normalizeValues(effectiveQuery.subtypes()),
                            normalizeValues(effectiveQuery.biomes()),
                            normalizeValues(effectiveQuery.alignments()),
                            toPortSortField(effectiveQuery.sortField()),
                            toPortSortDirection(effectiveQuery.sortDirection()),
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
                    .map(NormalizedCatalogQuery::trimmedOrNull)
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

    private record NormalizedEncounterCandidateQuery(boolean valid, CreatureCatalogLookup.EncounterCandidateSpec spec) {

        private static final int DEFAULT_LIMIT = 250;
        private static final int MAX_LIMIT = 1000;

        private static NormalizedEncounterCandidateQuery from(@Nullable EncounterCandidateQuery query) {
            EncounterCandidateQuery effectiveQuery = query == null
                    ? new EncounterCandidateQuery(List.of(), List.of(), List.of(), 0, 0, 0)
                    : query;
            int minimumXp = Math.max(0, effectiveQuery.minimumXp());
            int maximumXp = effectiveQuery.maximumXp() <= 0 ? Integer.MAX_VALUE : effectiveQuery.maximumXp();
            return new NormalizedEncounterCandidateQuery(
                    minimumXp <= maximumXp,
                    new CreatureCatalogLookup.EncounterCandidateSpec(
                            effectiveQuery.types(),
                            effectiveQuery.subtypes(),
                            effectiveQuery.biomes(),
                            minimumXp,
                            maximumXp,
                            normalizeLimit(effectiveQuery.limit())));
        }

        private static int normalizeLimit(int limit) {
            if (limit <= 0) {
                return DEFAULT_LIMIT;
            }
            return Math.min(limit, MAX_LIMIT);
        }
    }

    private static final class PublishedProjection {

        private static CreatureFilterOptions filterOptions(LoadCreatureFilterOptionsUseCase.FilterOptions options) {
            return new CreatureFilterOptions(
                    options.sizes(),
                    options.types(),
                    options.subtypes(),
                    options.biomes(),
                    options.alignments(),
                    options.challengeRatings());
        }

        private static CreatureDetail creatureDetail(CreatureCatalogLookup.CreatureProfile detail) {
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
                    detail.actions().stream().map(CreatureActionDetail::fromProfile).toList());
        }

        private static EncounterCandidate encounterCandidate(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
            return EncounterCandidate.fromProfile(candidate);
        }
    }

    private static final class ModelListeners {

        private static <T> Runnable subscribe(List<Consumer<T>> listeners, Consumer<T> listener) {
            Consumer<T> safeListener = Objects.requireNonNull(listener, "listener");
            listeners.add(safeListener);
            return () -> listeners.remove(safeListener);
        }

        private static <T> void notifyListeners(List<Consumer<T>> listeners, T result) {
            for (Consumer<T> listener : List.copyOf(listeners)) {
                listener.accept(result);
            }
        }
    }
}
