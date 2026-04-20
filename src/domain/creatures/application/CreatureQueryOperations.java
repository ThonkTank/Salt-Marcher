package src.domain.creatures.application;

import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.List;

/**
 * Internal read coordinator for the public creatures API facade.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class CreatureQueryOperations {

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final LoadEncounterCandidatesUseCase loadEncounterCandidatesUseCase;

    public CreatureQueryOperations(CreatureCatalogQueryPort queryPort) {
        this.loadCreatureFilterOptionsUseCase = new LoadCreatureFilterOptionsUseCase(queryPort);
        this.searchCreatureCatalogUseCase = new SearchCreatureCatalogUseCase(queryPort);
        this.loadCreatureDetailUseCase = new LoadCreatureDetailUseCase(queryPort);
        this.loadEncounterCandidatesUseCase = new LoadEncounterCandidatesUseCase(queryPort);
    }

    public CreatureFilterOptionsResult loadFilterOptions() {
        try {
            return new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS,
                    loadCreatureFilterOptionsUseCase.execute());
        } catch (RuntimeException exception) {
            return new CreatureFilterOptionsResult(
                    CreatureReadStatus.STORAGE_ERROR,
                    CreatureFilterOptions.empty());
        }
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        try {
            SearchCreatureCatalogUseCase.SearchResult result = searchCreatureCatalogUseCase.execute(query);
            if (result.invalidQuery()) {
                return new CreatureCatalogPageResult(
                        CreatureQueryStatus.INVALID_QUERY,
                        CreatureCatalogPage.empty(result.pageSize(), result.pageOffset()));
            }
            return new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS,
                    result.page());
        } catch (RuntimeException exception) {
            return new CreatureCatalogPageResult(
                    CreatureQueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(query.pageSize(), query.pageOffset()));
        }
    }

    public CreatureDetailResult loadCreatureDetail(long creatureId) {
        try {
            CreatureDetail detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            return new CreatureDetailResult(CreatureLookupStatus.SUCCESS, detail);
        } catch (RuntimeException exception) {
            return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
        }
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        try {
            LoadEncounterCandidatesUseCase.LoadResult result = loadEncounterCandidatesUseCase.execute(query);
            if (result.invalidQuery()) {
                return new EncounterCandidatesResult(CreatureQueryStatus.INVALID_QUERY, List.of());
            }
            return new EncounterCandidatesResult(
                    CreatureQueryStatus.SUCCESS,
                    result.candidates());
        } catch (RuntimeException exception) {
            return new EncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of());
        }
    }
}
