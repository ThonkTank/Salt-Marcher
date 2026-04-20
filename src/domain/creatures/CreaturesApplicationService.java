package src.domain.creatures;

import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.EncounterCandidatesResult;
import src.domain.creatures.published.EncounterCandidateQuery;
import src.domain.creatures.application.CreatureQueryOperations;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.Objects;

/**
 * Public read-only backend facade for creature catalog access.
 */
public final class CreaturesApplicationService {

    @FunctionalInterface
    public interface Factory {

        CreaturesApplicationService create();
    }

    private final CreatureQueryOperations queries;

    public CreaturesApplicationService(CreatureCatalogQueryPort queryPort) {
        this.queries = new CreatureQueryOperations(Objects.requireNonNull(queryPort, "queryPort"));
    }

    public CreatureFilterOptionsResult loadFilterOptions() {
        return queries.loadFilterOptions();
    }

    public CreatureCatalogPageResult searchCatalog(CreatureCatalogQuery query) {
        return queries.searchCatalog(query);
    }

    public CreatureDetailResult loadCreatureDetail(long creatureId) {
        return queries.loadCreatureDetail(creatureId);
    }

    public EncounterCandidatesResult loadEncounterCandidates(EncounterCandidateQuery query) {
        return queries.loadEncounterCandidates(query);
    }
}
