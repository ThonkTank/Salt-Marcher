package src.domain.creatures.usecase;

import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureCatalogQuery;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.CreatureFilterOptions;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.api.EncounterCandidateQuery;
import src.domain.creatures.creaturesAPI;
import src.domain.creatures.repository.CreatureCatalogRepository;

import java.util.List;

/**
 * Internal read coordinator for the public creatures API facade.
 */
public final class CreatureQueryOperations {

    private final LoadCreatureFilterOptionsUseCase loadCreatureFilterOptionsUseCase;
    private final SearchCreatureCatalogUseCase searchCreatureCatalogUseCase;
    private final LoadCreatureDetailUseCase loadCreatureDetailUseCase;
    private final LoadEncounterCandidatesUseCase loadEncounterCandidatesUseCase;

    public CreatureQueryOperations(CreatureCatalogRepository repository) {
        this.loadCreatureFilterOptionsUseCase = new LoadCreatureFilterOptionsUseCase(repository);
        this.searchCreatureCatalogUseCase = new SearchCreatureCatalogUseCase(repository);
        this.loadCreatureDetailUseCase = new LoadCreatureDetailUseCase(repository);
        this.loadEncounterCandidatesUseCase = new LoadEncounterCandidatesUseCase(repository);
    }

    public creaturesAPI.CreatureFilterOptionsResult loadFilterOptions() {
        try {
            return new creaturesAPI.CreatureFilterOptionsResult(
                    creaturesAPI.ReadStatus.SUCCESS,
                    loadCreatureFilterOptionsUseCase.execute());
        } catch (RuntimeException exception) {
            return new creaturesAPI.CreatureFilterOptionsResult(
                    creaturesAPI.ReadStatus.STORAGE_ERROR,
                    CreatureFilterOptions.empty());
        }
    }

    public creaturesAPI.CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        try {
            SearchCreatureCatalogUseCase.SearchResult result = searchCreatureCatalogUseCase.execute(query);
            if (result.status() == SearchCreatureCatalogUseCase.SearchStatus.INVALID_QUERY) {
                return new creaturesAPI.CreatureCatalogPageResult(
                        creaturesAPI.QueryStatus.INVALID_QUERY,
                        CreatureCatalogPage.empty(result.pageSize(), result.pageOffset()));
            }
            return new creaturesAPI.CreatureCatalogPageResult(
                    creaturesAPI.QueryStatus.SUCCESS,
                    result.page());
        } catch (RuntimeException exception) {
            return new creaturesAPI.CreatureCatalogPageResult(
                    creaturesAPI.QueryStatus.STORAGE_ERROR,
                    CreatureCatalogPage.empty(query.pageSize(), query.pageOffset()));
        }
    }

    public creaturesAPI.CreatureDetailResult loadCreatureDetail(long creatureId) {
        try {
            CreatureDetail detail = loadCreatureDetailUseCase.execute(creatureId);
            if (detail == null) {
                return new creaturesAPI.CreatureDetailResult(creaturesAPI.LookupStatus.NOT_FOUND, null);
            }
            return new creaturesAPI.CreatureDetailResult(creaturesAPI.LookupStatus.SUCCESS, detail);
        } catch (RuntimeException exception) {
            return new creaturesAPI.CreatureDetailResult(creaturesAPI.LookupStatus.STORAGE_ERROR, null);
        }
    }

    public creaturesAPI.EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        try {
            LoadEncounterCandidatesUseCase.LoadResult result = loadEncounterCandidatesUseCase.execute(query);
            if (result.status() == LoadEncounterCandidatesUseCase.LoadStatus.INVALID_QUERY) {
                return new creaturesAPI.EncounterCandidatesResult(creaturesAPI.QueryStatus.INVALID_QUERY, List.of());
            }
            return new creaturesAPI.EncounterCandidatesResult(
                    creaturesAPI.QueryStatus.SUCCESS,
                    result.candidates());
        } catch (RuntimeException exception) {
            return new creaturesAPI.EncounterCandidatesResult(creaturesAPI.QueryStatus.STORAGE_ERROR, List.of());
        }
    }
}
