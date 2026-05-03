package src.domain.creatures;

import java.util.ArrayList;
import java.util.List;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.EncounterCandidate;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.creatures.published.LoadCreatureFilterOptionsQuery;
import src.domain.creatures.application.LoadCreatureDetailUseCase;
import src.domain.creatures.application.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.application.LoadEncounterCandidatesUseCase;
import src.domain.creatures.application.SearchCreatureCatalogUseCase;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Public read-only backend facade for creature catalog access.
 */
public final class CreaturesApplicationService {

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final LoadEncounterCandidatesUseCase loadEncounterCandidatesUseCase;
    private final List<Consumer<CreatureFilterOptionsResult>> filterOptionsListeners = new ArrayList<>();
    private final List<Consumer<CreatureCatalogPageResult>> catalogListeners = new ArrayList<>();
    private final CreatureFilterOptionsModel filterOptionsModel = new CreatureFilterOptionsModel(
            this::currentFilterOptions,
            this::subscribeFilterOptionsListener);
    private final CreatureCatalogModel catalogModel = new CreatureCatalogModel(
            this::currentCatalogPage,
            this::subscribeCatalogListener);
    private CreatureFilterOptionsResult currentFilterOptions =
            new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty());
    private CreatureCatalogPageResult currentCatalogPage =
            new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0));

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
                    toPublishedFilterOptions(loadCreatureFilterOptionsUseCase.execute()));
        } catch (RuntimeException exception) {
            currentFilterOptions = new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreatureFilterOptions.empty());
        }
        notifyFilterOptionsListeners(currentFilterOptions);
        return currentFilterOptions;
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        try {
            SearchCreatureCatalogUseCase.SearchResult result = searchCreatureCatalogUseCase.execute(toCatalogQueryInput(query));
            if (result.invalidQuery()) {
                currentCatalogPage = new CreatureCatalogPageResult(
                        CreatureQueryStatus.INVALID_QUERY,
                        CreatureCatalogPage.empty(result.pageSize(), result.pageOffset()));
                notifyCatalogListeners(currentCatalogPage);
                return currentCatalogPage;
            }
            currentCatalogPage = new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS,
                    toPublishedCatalogPage(result.page()));
        } catch (RuntimeException exception) {
            CreatureCatalogQuery effectiveQuery = query == null ? CreatureCatalogQuery.defaults() : query;
            currentCatalogPage = new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(effectiveQuery.pageSize(), effectiveQuery.pageOffset()));
        }
        notifyCatalogListeners(currentCatalogPage);
        return currentCatalogPage;
    }

    public CreatureDetailResult loadCreatureDetail(LoadCreatureDetailQuery query) {
        try {
            long creatureId = query == null ? 0L : query.creatureId();
            CreatureCatalogLookup.CreatureProfile detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            return new CreatureDetailResult(CreatureLookupStatus.SUCCESS, toPublishedCreatureDetail(detail));
        } catch (RuntimeException exception) {
            return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        try {
            LoadEncounterCandidatesUseCase.LoadResult result =
                    loadEncounterCandidatesUseCase.execute(toCandidateQueryInput(query));
            if (result.invalidQuery()) {
                return new EncounterCandidatesResult(CreatureQueryStatus.INVALID_QUERY, List.of());
            }
            return new EncounterCandidatesResult(
                    CreatureQueryStatus.SUCCESS,
                    result.candidates().stream().map(CreaturesApplicationService::toPublishedEncounterCandidate).toList());
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

    private CreatureFilterOptionsResult currentFilterOptions() {
        return currentFilterOptions;
    }

    private CreatureCatalogPageResult currentCatalogPage() {
        return currentCatalogPage;
    }

    private Runnable subscribeFilterOptionsListener(Consumer<CreatureFilterOptionsResult> listener) {
        Consumer<CreatureFilterOptionsResult> safeListener = Objects.requireNonNull(listener, "listener");
        filterOptionsListeners.add(safeListener);
        return () -> filterOptionsListeners.remove(safeListener);
    }

    private Runnable subscribeCatalogListener(Consumer<CreatureCatalogPageResult> listener) {
        Consumer<CreatureCatalogPageResult> safeListener = Objects.requireNonNull(listener, "listener");
        catalogListeners.add(safeListener);
        return () -> catalogListeners.remove(safeListener);
    }

    private void notifyFilterOptionsListeners(CreatureFilterOptionsResult result) {
        for (Consumer<CreatureFilterOptionsResult> listener : List.copyOf(filterOptionsListeners)) {
            listener.accept(result);
        }
    }

    private void notifyCatalogListeners(CreatureCatalogPageResult result) {
        for (Consumer<CreatureCatalogPageResult> listener : List.copyOf(catalogListeners)) {
            listener.accept(result);
        }
    }

    private static CreatureFilterOptions toPublishedFilterOptions(LoadCreatureFilterOptionsUseCase.FilterOptions options) {
        return new CreatureFilterOptions(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings());
    }

    private static CreatureCatalogPage toPublishedCatalogPage(CreatureCatalogLookup.CatalogPage page) {
        return new CreatureCatalogPage(
                page.rows().stream().map(CreaturesApplicationService::toPublishedCatalogRow).toList(),
                page.totalCount(),
                page.pageSize(),
                page.pageOffset());
    }

    private static CreatureCatalogRow toPublishedCatalogRow(CreatureCatalogLookup.CatalogRow row) {
        return new CreatureCatalogRow(
                row.id(),
                row.name(),
                row.size(),
                row.creatureType(),
                row.alignment(),
                row.challengeRating(),
                row.xp(),
                row.hitPoints(),
                row.armorClass());
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
                detail.actions().stream().map(CreaturesApplicationService::toPublishedActionDetail).toList());
    }

    private static CreatureActionDetail toPublishedActionDetail(CreatureCatalogLookup.ActionProfile action) {
        return new CreatureActionDetail(
                action.actionType(),
                action.name(),
                action.description(),
                action.toHitBonus());
    }

    private static EncounterCandidate toPublishedEncounterCandidate(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
        return new EncounterCandidate(
                candidate.id(),
                candidate.name(),
                candidate.creatureType(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.hitDiceCount(),
                candidate.hitDiceSides(),
                candidate.hitDiceModifier(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount());
    }

    private static SearchCreatureCatalogUseCase.CatalogQueryInput toCatalogQueryInput(CreatureCatalogQuery query) {
        CreatureCatalogQuery effectiveQuery = query == null ? CreatureCatalogQuery.defaults() : query;
        return new SearchCreatureCatalogUseCase.CatalogQueryInput(
                effectiveQuery.nameQuery(),
                effectiveQuery.challengeRatingMin(),
                effectiveQuery.challengeRatingMax(),
                effectiveQuery.sizes(),
                effectiveQuery.types(),
                effectiveQuery.subtypes(),
                effectiveQuery.biomes(),
                effectiveQuery.alignments(),
                toPortSortField(effectiveQuery.sortField()),
                toPortSortDirection(effectiveQuery.sortDirection()),
                effectiveQuery.pageSize(),
                effectiveQuery.pageOffset());
    }

    private static CreatureCatalogLookup.SortField toPortSortField(src.domain.creatures.published.CreatureCatalogSortField sortField) {
        return switch (sortField == null ? src.domain.creatures.published.CreatureCatalogSortField.NAME : sortField) {
            case CHALLENGE_RATING -> CreatureCatalogLookup.SortField.CHALLENGE_RATING;
            case XP -> CreatureCatalogLookup.SortField.XP;
            case TYPE -> CreatureCatalogLookup.SortField.TYPE;
            case SIZE -> CreatureCatalogLookup.SortField.SIZE;
            case NAME -> CreatureCatalogLookup.SortField.NAME;
        };
    }

    private static CreatureCatalogLookup.SortDirection toPortSortDirection(src.domain.creatures.published.CreatureSortDirection sortDirection) {
        return sortDirection == src.domain.creatures.published.CreatureSortDirection.DESCENDING
                ? CreatureCatalogLookup.SortDirection.DESCENDING
                : CreatureCatalogLookup.SortDirection.ASCENDING;
    }

    private static LoadEncounterCandidatesUseCase.CandidateQueryInput toCandidateQueryInput(EncounterCandidateQuery query) {
        if (query == null) {
            return new LoadEncounterCandidatesUseCase.CandidateQueryInput(
                    List.of(),
                    List.of(),
                    List.of(),
                    0,
                    0,
                    0);
        }
        return new LoadEncounterCandidatesUseCase.CandidateQueryInput(
                query.types(),
                query.subtypes(),
                query.biomes(),
                query.minimumXp(),
                query.maximumXp(),
                query.limit());
    }
}
